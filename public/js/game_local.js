'use strict';

(function () {
    var level = (function () {
        var url     = window.location.href.replace(/(\?|#).*$/);
        var parts   = url.split('/')
        var lvl     = parseInt(parts[parts.length - 1], 10);

        return Math.min(20, Math.max(0, lvl));
    })();
    var stockfish = new Worker('/assets/js/stockfish.js');
    var openFishData = function (arg) {
        return arg.data;
    };
    var $output = $('#ai_output');

    initializeChess({
        onMove: function (data, api) {
            stockfish.postMessage('position fen ' + data.fen);
            stockfish.postMessage('go depth ' + level);
        },
        onGameOver: function (data, api) {
            api.updateStatus(api.BOARD_STATUS.GAME_OVER);
            alert('You ' + (data.isLocalPlayerWin ? 'Win' : 'Lose') + '!');
        },
        onLoad: function (data, api) {
            stockfish.onmessage = function (event) {
                var data = openFishData(event);
                var move;

                console.log('stockfish onmessage', data);
                if (!/^(option|id)/.test(data) && !/^\s*$/.test(data)) {
                    $output.prepend($('<li>' + data + '</li>'));
                }

                if (data === 'uciok') {
                    stockfish.postMessage('isready');
                }
                else if (data === 'readyok') {
                    stockfish.postMessage('ucinewgame');
                    api.updateStatus(api.BOARD_STATUS.YOUR_TURN);
                }
                else if (/^bestmove/.test(data)) {
                    move = data.split(/\s+/g)[1];

                    api.moveChess({
                        from: move.substr(0, 2),
                        to: move.substr(2)
                    });
                }
            };

            stockfish.postMessage('uci');

            api.updateStatus(api.BOARD_STATUS.WAITING_JOIN);
        }
    });
})();
