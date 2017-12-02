var glicko2     = require('glicko2');
var mongoose    = require('mongoose');
var User        = require('../app/models/user');
var Game        = require('../app/models/game');
var configDB    = require('../config/database.js');

mongoose.Promise = global.Promise;
mongoose.connect(configDB.url);

var concat = function (listOfList) {
    return [].concat.apply([], listOfList);
};

var toObjectId = function (str) {
    return mongoose.Types.ObjectId(str);
};

var settings =  {
    tau: 0.5,
    rating: 1000,
    rd: 200,
    vol: 0.06
};

var update = function (users, games) {
    var ranking = new glicko2.Glicko2(settings);

    var rankPlayers = users.reduce(function (obj, user) {
        var rating  = user.local.rank.rating;
        var rd      = user.local.rank.rd;
        var vol     = user.local.rank.vol;

        obj[user._id.toString()] = ranking.makePlayer(rating, rd, vol);
        return obj;
    }, {});

    var matches = games.map(function (game) {
        var ret = game.players.map(function (uid) {
            return rankPlayers[uid];
        });

        ret.push(!game.winner ? 0.5 : (game.players[0] === game.winner ? 1 : 0));
        return ret;
    });

    ranking.updateRatings(matches);

    return Promise.all(
        Object.keys(rankPlayers).map(function (uid) {
            var rankPlayer  = rankPlayers[uid];
            var newRank     = {
                rating: Math.round(rankPlayer.getRating()),
                rd: Math.round(rankPlayer.getRd()),
                vol: Math.round(rankPlayer.getVol() * 10000) / 10000
            };

            return User.findByIdAndUpdate(uid, {
                $set: { 'local.rank': newRank }
            });
        })
    )
    .then(function () {
        console.log(Object.keys(rankPlayers).length + ' players\' ranking updated!');
    });
};

Game.find({
    status: 'gameover',
    settled: false
})
.exec()
.then(function (games) {
    var playerIds = concat(games.map(function (game) {
        return game.players;
    }));

    return User.find({
        _id: {
            $in: playerIds.map(toObjectId)
        }
    })
    .exec()
    .then(function (users) {
        return update(users, games);
    })
    .then(function () {
        return Game.update({settled: false}, {$set: {settled: true}}, {multi: true});
    })
    .then(function () {
        console.log('done!');
    });
})
.catch(function (e) {
    console.log(e.stack);
})
.then(function () {
    mongoose.connection.close();
});
