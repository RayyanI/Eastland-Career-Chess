var path = require('path');
var Primus = require('primus') ;
var Rooms = require('primus-rooms');
var Game = require('./models/game');
var User = require('./models/user');

//-----------------------------------------------------------------------------------------------------------
var LOBBY_ROOM      = 'lobby_ybbol';
var primus;
var allRooms;
var allPlayers;
var lobby;
//------------------------------------------------------------------------------------------------------------

var updateScore = function (playerIds, gameResult) {
    var fields = ['wins', 'draws', 'losses'];

    return Promise.all(
        playerIds.map(function (uid, i) {
            var obj  = {};
            var type = fields[1 + gameResult * Math.pow(-1, i + 1)];
            obj['local.score.' + type] = 1;

            return User.findByIdAndUpdate(uid, {
                $inc: obj
            });
        })
    )
};

var endGame = function (game, winner, reason) {
    game.status     = 'gameover';
    game.winner     = winner;
    game.endReason  = reason;
    game.updateTime = new Date();

    var gameResult = !winner ? 0 : (game.players[0] === winner ? 1 : -1);

    return Promise.all([
        game.save(),
        updateScore(game.players, gameResult)
    ])
    .then(function () {
        delete allRooms[game._id.toString()];
    })
    .catch(function (e) {
        console.log(e.stack);
    });
};

var addActivePlayer = function (username, sparkId) {
    allPlayers[username] = allPlayers[username] || [];
    allPlayers[username].push(sparkId);
};

var removeActivePlayer = function (username, sparkId) {
    allPlayers[username] = allPlayers[username].filter(function (sid) {
        return sid !== sparkId;
    });

    if (allPlayers[username].length === 0) {
        delete allPlayers[username];
    }
};

var removeActiveBySparkId = function (sparkId) {
    var toRemove = [];

    Object.keys(allPlayers).forEach(function (username) {
        allPlayers[username] = allPlayers[username].filter(function (sid) {
            return sid !== sparkId;
        })

        if (allPlayers[username].length === 0) {
            toRemove.push(username);
        }
    });

    toRemove.forEach(function (username) {
        delete allPlayers[username];
    });
};

var initialize = function (server) {
    primus          = new Primus(server, { transformer: "engine.io" });
    allRooms        = {} ;
    allPlayers      = {};
    lobby           = [];

    primus.plugin('rooms', Rooms);

    primus.save(path.join(__dirname, '..', 'public', 'js', 'primus.js'));

    primus.on("connection", function (spark) {
        console.log("Creating Connections");

        spark.on('data', function(data) {
            console.log("Data coming = " + JSON.stringify(data) ) ;

            data = data || {};

            var action  = data.action;
            var room    = data.room;
            var data    = data.data;
            var joinUser  = data.user;
            var player  = data.player;

            // join a room
            if (action === 'join') {
                addActivePlayer(data.username, spark.id);

                Game.findById(room)
                .then(function (game) {
                    return Promise.all(
                        game.players.map(function (uid) {
                            if (!uid) return Promise.resolve(null);
                            return User.findById(uid).then(function (user) {
                                            delete user.local.password;
                                            return user;
                                        });
                        })
                    );
                })
                .then(function (players) {
                    if (players.filter(function (p) { return p}).length === 2) {
                        allRooms[room] = true;
                    }

                    // console.log('rooms: ', Object.keys(allRooms).length);
                    // console.log('players: ', Object.keys(allPlayers).length);

                    spark.join(room, function () {
                        // send message to all clients except this one
                        process.nextTick(function () {
                            spark.room(room)
                                 .write({
                                     action: 'players_update',
                                     data: {
                                         username: data.username,
                                         side: data.side,
                                         players: players
                                     }
                                 });
                        })
                    });
                })
                .catch(function (e) {
                    console.log(e.stack);
                });
            }
            // leave a room
            else if (action === 'leave') {
                spark.leave(room, function () {
                    // send message to this client
                    spark.write('you left room ' + room);
                });
            }
            // waiting in lobby
            else if (action === 'lobby') {
                User.findOne({ 'local.email': data.username })
                .then(function (user) {
                    spark.join(LOBBY_ROOM, function () {
                        lobby.push({
                            sparkId: spark.id,
                            userId: user._id.toString()
                        });

                        // Easy Strategy: any 2 players will be paired.
                        if (lobby.length < 2)   return;

                        var lobbyObjs   = lobby.slice(0, 2);
                        var uids        = lobbyObjs
                                            .map(function (obj) {
                                                return obj.userId;
                                            });

                        uids.sort(function () {
                            return Math.random() > 0.5;
                        });

                        var newGame = new Game({
                            status: 'playing',
                            players: uids,
                            winner: null,
                            settled: false,
                            createTime: new Date(),
                            updateTime: new Date(),
                        });

                        lobby = lobby.slice(2);

                        return newGame.save()
                        .then(function (game) {
                            lobbyObjs.forEach(function (obj) {
                                var sp = primus.spark(obj.sparkId);

                                sp.leave(LOBBY_ROOM);
                                sp.write({
                                    action: 'paired',
                                    data: {
                                        gameId: game._id.toString(),
                                        gameUrl: '/game/' + game._id.toString()
                                    }
                                });
                            });
                        });
                    });
                })
                .catch(function (e) {
                    console.log(e.stack);
                });
            }
            // someone make a move
            else if (action == 'move') {
                if (!data || !data.gameId || !data.username || !data.pgn)   return;

                Promise.all([
                    Game.findById(data.gameId),
                    User.findOne({ 'local.email': data.username })
                ])
                .then(function (tuple) {
                    var game = tuple[0];
                    var user = tuple[1];

                    // Both gameId and username should be valid
                    if (!game || !user) return;
                    if (game.status !== 'playing')  throw new Error('You can only move in a playing game!');

                    game.pgn        = data.pgn;
                    game.updateTime = new Date();

                    return game.save();
                })
                .then(function () {
                    spark.room(room)
                         .except(spark.id)
                         .write({
                             action : 'update',
                             data : { pgn : data.pgn, user : data.user }
                         });
                })
                .catch(function (e) {
                    console.log(e.stack);
                });
            }
            else if (action === 'gameover') {
                if (!data || !data.gameId || !data.winSide)   return;

                Game.findById(data.gameId)
                .then(function (game) {
                    if (!game)  return;
                    if (game.status !== 'playing')  throw new Error('You can only set a playing game to game over!');

                    var winner = data.isDraw ? null : game.players[data.winSide === 'white' ? 0 : 1];
                    return endGame(game, winner, 'by move');
                })
                .then(function () {
                    spark.room(room)
                         .write({
                             action : 'gameover',
                             data : {
                                 isDraw: data.isDraw,
                                 winSide: data.winSide
                             }
                         });
                })
                .catch(function (e) {
                    console.log(e.stack);
                });
            }
            else if (action === 'offerdraw') {
                spark.room(room)
                     .except(spark.id)
                     .write({
                         action : 'offerdraw',
                         data : data
                     });
            }
            else if (action === 'acceptdraw') {
                Game.findById(data.gameId)
                .then(function (game) {
                    if (!game)  return;
                    if (game.status !== 'playing')  throw new Error('You can only set a playing game to game over!');

                    return endGame(game, null, 'negotiate');
                })
                .then(function () {
                    spark.room(room)
                    .write({
                        action : 'gameover',
                        data : {
                            isDraw: true,
                            winSide: null
                        }
                    });
                })
                .catch(function (e) {
                    console.log(e.stack);
                });
            }
            else if (action === 'resign') {
                Game.findById(data.gameId)
                .then(function (game) {
                    if (!game)  return;
                    if (game.status !== 'playing')  throw new Error('You can only resign a playing game');

                    var winner = game.players[data.side === 'white' ? 1 : 0]
                    return endGame(game, winner, 'resign')
                                .then(function () {
                                    return data.side === 'white' ? 'black' : 'white';
                                });
                })
                .then(function (winSide) {
                    spark.room(room)
                         .except(spark.id)
                         .write({
                             action : 'resign',
                             data : data
                         });

                    spark.room(room)
                         .write({
                              action : 'gameover',
                              data: {
                                  isDraw: false,
                                  winSide: winSide
                              }
                          });
                })
                .catch(function (e) {
                    console.log(e.stack);
                });
            }
        });
    });

    primus.on("disconnection", function (spark) {
        removeActiveBySparkId(spark.id);
        console.log(spark.id + ":: disconnected. ") ;
    });

    console.log('Websockets online..');
};

module.exports = {
    init: initialize,
    activeGameCount: function () {
        return Object.keys(allRooms).length;
    },
    activePlayerCount: function () {
        return Object.keys(allPlayers).length;
    }
};
