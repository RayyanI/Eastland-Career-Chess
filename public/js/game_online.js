'use strict';

(function () {
    var primus      = new Primus();
    var urlParts    = window.location.href.replace(/(\?|#).*$/, '').split('/');
    var gameId      = urlParts[urlParts.length - 1];

    var updateOpponentInfo = function (opponent) {
        var $container      = $('#component_info');
        var $opFirstName    = $('#player2_name');
        var $opFullName     = $('#opponent_fullname');
        var $opRank         = $('#opponent_rank');
        var $opWins         = $('#opponent_wins');
        var $opLosses       = $('#opponent_losses');
        var $opDraws        = $('#opponent_draws');

        if (!opponent || !opponent.local) {
            $container.hide();
            return;
        }

        var info = opponent.local;

        $container.show();
        $opFirstName.text(info.firstName);
        $opFullName.text(info.firstName + ' ' + info.lastName);
        $opRank.text(info.rank.rating);
        $opWins.text(info.score.wins);
        $opLosses.text(info.score.losses);
        $opDraws.text(info.score.draws);
    };

    initializeChess({
        gameId: gameId,
        onMove: function (data, api) {
            primus.write({
                action: 'move',
                room: data.gameId,
                data: {
                    gameId: data.gameId,
                    pgn: data.pgn,
                    username: data.username
                }
            });
        },
        onYouWin: function (data, api) {
            primus.write({
                action: 'gameover',
                room: data.gameId,
                data: {
                    gameId: data.gameId,
                    pgn: data.pgn,
                    username: data.username,
                    winSide: data.winSide
                }
            });
        },
        onOfferDrawClicked: function (data, api) {
            if (!confirm('Do you really want to call for a draw?')) return;
            primus.write({
                action: 'offerdraw',
                room: data.gameId,
                data: {
                    gameId: data.gameId
                }
            });
        },
        onResignClicked: function (data, api) {
            if (!confirm('Do you really want to resign?')) return;
            primus.write({
                action: 'resign',
                room: data.gameId,
                data: {
                    gameId: data.gameId,
                    side: data.side,
                    username: data.username
                }
            });
        },
        onLoad: function (data, api) {
            var orientation = data.orientation;
            var username    = data.username;
            var setupPrimus = function () {
                primus.on('data', function (msg) {
                    if (!msg || !msg.action)    return;

                    switch (msg.action) {
                        case 'players_update':
                            if (!msg.data.players) {
                                break;
                            }

                            var _opponent = msg.data.players.find(function (p) {
                                return p && p.local.email !== username;
                            });

                            if (!_opponent) {
                                break;
                            }

                            api.checkGame();
                            updateOpponentInfo(_opponent);
                            break;

                        case 'update':
                            api.updateByPgn(msg.data.pgn);
                            break;

                        case 'gameover':
                            api.updateStatus(api.BOARD_STATUS.GAME_OVER);

                            if (msg.data.isDraw) {
                                alert('Draw Game!');
                            } else if (msg.data.winSide === orientation) {
                                alert('You Win!');
                            } else {
                                alert('You Lose!');
                            }

                            break;

                        case 'offerdraw':
                            if (confirm('Opponent offered a draw, Accept or Not?')) {
                                primus.write({
                                    action: "acceptdraw",
                                    room: data.gameId,
                                    data: {
                                        gameId: data.gameId,
                                        username: data.username
                                    }
                                });
                            }
                            break;

                        case 'resign':
                            if (msg.data.side !== orientation) {
                                alert('You opponent resigned!');
                            }
                            break;
                    }
                });

                primus.write({
                    action: "join",
                    room: data.gameId,
                    data: {
                        gameId: data.gameId,
                        username: data.username,
                        side: orientation,
                    }
                });
            };

            setupPrimus();
        },
    });
})();
