var btoa = require('btoa');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn ;
var Game = require('../app/models/game');
var User = require('../app/models/user');
var primusHost = require('../app/primus');

var GAME_ERROR = {
    ROOM_FULL: 'Room is FULL!',
    PLAYING_WITH_SELF: 'You are not supposed to play with yourself in this room!',
    GAME_TERMINATED: 'Game is already terminated!',
    GAME_OVER: 'Game Over!',
};

var range = function (start, end, _step) {
    var step = _step || 1;
    var ret = [];

    for (var i = start; step >= 0 ? (i < end) : (i > end); i += step) {
        ret.push(i);
    }

    return ret;
};

var outputJson = function (res, error_code, data, msg) {
  var obj = {
    error_code: error_code,
    msg: msg,
    data: data
  };

  res.send(JSON.stringify(obj));
  res.end();
};

var createGame = function (userId, isWhite) {
    var game = new Game({
        status: 'created',
        players: isWhite ? [userId, null] : [null, userId],
        winner: null,
        settled: false,
        createTime: new Date(),
        updateTime: new Date(),
    });

    return game.save();
};

var getUsers = function (query, options, perPage, pageNum) {
    return User.paginate(query, Object.assign({
        limit: perPage,
        page: pageNum
    }, options))
    .then(function (result) {
        var users       = result.docs;
        var totalCount  = result.total;
        var totalPage   = result.pages;
        var perPage     = result.limit;
        var pageNum     = result.page;
        var pages       = [];
        var startPosition = perPage * (pageNum - 1);
        var endPosition   = startPosition + users.length - 1;

        for (var i = 1; i <= totalPage; i += 1) {
            pages.push(i);
        }

        return {
            users: users,
            totalCount: totalCount,
            totalPage: totalPage,
            perPage: perPage,
            pageNum: pageNum,
            pages: pages,
            startPosition: startPosition,
            endPosition: endPosition
        };
    });
};

var getLeaders = function (perPage, pageNum) {
    return getUsers({}, {sort: {'local.rank.rating': -1}}, perPage, pageNum);
};

var searchUserByName = function (query, perPage, pageNum) {
    var normalizeRegStr = function (str) {
        return query.replace(/(\.|\?|\/)/g, '\\$1');
    };
    var reg   = new RegExp(normalizeRegStr(query), 'i');
    var query = {
        $or: [
            { 'local.firstName': reg },
            { 'local.lastName': reg },
        ]
    };
    return getUsers(query, {sort: {'local.rank.rating': -1}}, perPage, pageNum);
};

module.exports = function(app, passport) {
    app.post('/game/create', ensureLoggedIn('/login'), function(req, res) {
        var userId = req.user._id.toString();

        console.log('to create a game', userId);

        createGame(userId, true)
        .then(function (game) {
            // req.redirect('/game/' + gameId);
            outputJson(res, 0, { gameId: game._id.toString() });
        })
        .catch(function (e) {
            console.log(e.stack);
        });
    });

    app.post('/game/create/:gametype', ensureLoggedIn('/login'), function(req, res) {
        var userId = req.user._id.toString();
        var isWhite = req.params.gametype === 'white';

        createGame(userId, isWhite)
        .then(function (gameId) {
            // req.redirect('/game/' + gameId);
            outputJson(res, 0, { gameId: gameId });
        });
    });

// normal routes ===============================================================

    // show the home page (will also have our login links)
    // PROFILE SECTION =========================
    app.get('/play', ensureLoggedIn('/login'), function(req, res) {
        res.render('play.ejs', {
            user : req.user
        });
    });

    app.get('/game/local', ensureLoggedIn('/login'), function (req, res) {
        res.redirect('/game/local/10');
    });

    app.get('/game/local/:level', ensureLoggedIn('/login'), function (req, res) {
        var level = parseInt(req.params.level, 10);

        if (parseInt(req.params.level, 10) === NaN) {
            return res.redirect('/game/local/10');
        }

        res.render('game_local.ejs', {
            user: req.user,
            level: level
        });
    });

    // GAME PAGE WITH FRIENDS =====================
    app.get('/game/:id', ensureLoggedIn('/login'), function(req, res) {
        Game.findById(req.params.id)
        .then(function (game) {
            var userId = req.user._id.toString();
            var players = game.players;
            var p = Promise.resolve(game);
            var error;

            switch (game.status) {
                case 'terminated': {
                    error = GAME_ERROR.GAME_TERMINATED;
                    break;
                }
                case 'gameover': {
                    error = GAME_ERROR.GAME_OVER;
                    break;
                }
                case 'created': {
                    if (players.indexOf(userId) !== -1) {
                        // do nothing, you are waiting for friends to join.
                    } else {
                        game.players = !!players[0] ? [players[0], userId] : [userId, players[1]];
                        game.status  = 'playing';
                        game.updateTime = new Date();
                        p = game.save();
                    }
                    break;
                }
                case 'playing': {
                    if (players.indexOf(userId) === -1) {
                        error = GAME_ERROR.ROOM_FULL;
                    }
                    break;
                }
            }

            p.then(function (game) {
                game.pgn         = game.pgn ? btoa(game.pgn) : '';
                game.orientation = game.players.indexOf(userId) === 1 ? 'black' : 'white';
                res.render('game_online.ejs', {
                    error: error,
                    game: game,
                    user: req.user
                });
            })
        })
        .catch(function (e) {
            console.log(e.stack);
        });
    });

    // EXAMPLE SECTION =========================
    app.get('/example', ensureLoggedIn('/login'), function(req, res) {
        res.render('profile0.ejs', {
            user : req.user
        });
    });
    // INDEX PAGE =========================
    app.get('/', ensureLoggedIn('/login'), function(req, res) {
        res.render('index.ejs', {
            user : req.user,
            activeGameCount: primusHost.activeGameCount(),
            activePlayerCount: primusHost.activePlayerCount(),
        });
    });

    // LEADERBOARD PAGE =========================
    app.get('/leaderboards', ensureLoggedIn('/login'), function(req, res) {
        getLeaders(25, 1)
        .then(function (data) {
            res.render('leaderboards.ejs', Object.assign(data, {
                user : req.user,
                searchText: '',
                showPosition: true
            }));
        })
        .catch(function (e) {
            console.log(e.stack);
        })
    });

    app.get('/leaderboards/:perPage/:pageNum', ensureLoggedIn('/login'), function(req, res) {
        var perPage = parseInt(req.params.perPage, 10);
        var pageNum = parseInt(req.params.pageNum, 10);

        if ([10, 25, 50, 100].indexOf(perPage)) {
            return res.redirect('/leaderboards');
        }

        if (pageNum <= 0) {
            pageNum = 1;
        }

        getLeaders(perPage, pageNum)
        .then(function (data) {
            res.render('leaderboards.ejs', Object.assign(data, {
                user : req.user,
                searchText: '',
                showPosition: true
            }));
        })
        .catch(function (e) {
            console.log(e.stack);
        });
    });

    // SEARCH USER PAGE =========================
    app.get('/search/user/:query/:perPage/:pageNum', ensureLoggedIn('/login'), function(req, res) {
        var perPage = parseInt(req.params.perPage, 10);
        var pageNum = parseInt(req.params.pageNum, 10);

        if ([10, 25, 50, 100].indexOf(perPage)) {
            return res.redirect('/search/user/' + req.params.query + '/10/1');
        }

        if (pageNum <= 0) {
            pageNum = 1;
        }

        searchUserByName(req.params.query, perPage, pageNum)
        .then(function (data) {
            res.render('search_user.ejs', Object.assign(data, {
                user : req.user,
                searchText: req.params.query,
                showPosition: false
            }));
        })
        .catch(function (e) {
            console.log(e.stack);
        });
    });

    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
        // LOGIN ===============================
        // show the login form
        app.get('/login', function(req, res) {
            res.render('login.ejs', { message: req.flash('loginMessage') });
        });

        // process the login form
        /*
        successRedirect : '/profile', // redirect to the secure profile section
        successRedirect : req.session.redirectTo ? req.session.redirectTo : '/profile',
        */
        app.post('/login', passport.authenticate('local-login', {

            successReturnToOrRedirect: '/profile',
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }) );

        // SIGNUP =================================
        // show the signup form
        app.get('/signup', function(req, res) {
            var d = new Date();
            var y = d.getFullYear();

            res.render('signup.ejs', {
                message: req.flash('signupMessage'),
                years: range(y, y - 100, -1),
                months: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(','),
                dates: range(1, 32)
            });
        });

        // process the signup form
        app.post('/signup', passport.authenticate('local-signup', {
            successRedirect : '/', // redirect to the secure profile section
            failureRedirect : '/signup', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));


// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------
        app.get('/connect/local', function(req, res) {
            res.render('connect-local.ejs', { message: req.flash('loginMessage') });
        });
        app.post('/connect/local', passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });


};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();


    res.redirect('/');
}

function isLoggedInProfile(req, res, next) {
    if (req.isAuthenticated())
        return next();


    res.redirect('/login');
}
