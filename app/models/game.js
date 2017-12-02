var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;

// define the schema for our user model
var gameSchema = mongoose.Schema({
    status: String,
    players: Array,
    winner: String,
    pgn: String,
    endReason: String,
    settled: Boolean,
    updateTime: Date,
    createTime: Date,
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Game', gameSchema);
