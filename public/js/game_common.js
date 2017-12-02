'use strict';

(function (_global, _module, _define) {
    var BOARD_STATUS = {
        WAITING_JOIN: 0x0000,
        WAITING_MOVE: 0x0001,
        YOUR_TURN: 0x0002,
        GAME_OVER: 0x0003,
        CHECK: 0x0004,
        IN_CHECK: 0x0005,
    };

    var initializeChess = function (_opts) {
        var opts        = _opts || {};
        var gameId      = opts.gameId || 'local_game';
        var game        = new Chess();
        var $url        = $('#gameurl');
        var $board      = $('#board');
        var $status     = $('#game_status');
        var $pgn        = $('#game_pgn');
        var $offerDraw  = $('#startBtn');
        var $resign     = $('#clearBtn');
        var $downPgn    = $('#pgn_download');

        // Board not in position, means not in playing mode
        if (!$board || !$board.length)  return;

        var pgn             = $board.data('pgn');
        var orientation     = $board.data('orientation');
        var username        = $board.data('username');
        var serverStatus    = $board.data('status');
        var currentStatus   = null;

        if (pgn && pgn.length) {
            game.load_pgn(window.atob(pgn));
        }

        var position    = pgn && pgn.length > 0 ? game.fen() : 'start';
        var checkGame   = function checkGame() {
            // Assign appropriate strings for the depending on colour.
            var turnColour  = (game.turn() === 'w' ? 'white' : 'black');
            var lastColour  = (game.turn() === 'w' ? 'black' : 'white');
            var statusToSet = turnColour === orientation ?
                                BOARD_STATUS.YOUR_TURN :
                                BOARD_STATUS.WAITING_MOVE;

            var isDraw;
            var winSide;

            if (game.in_check()) {
                statusToSet = turnColour === orientation ?
                                BOARD_STATUS.IN_CHECK :
                                BOARD_STATUS.CHECK;
            }

            // Has the game ended? If so, how has it ended?
            if (game.game_over()) {
                statusToSet = BOARD_STATUS.GAME_OVER;

                // Send GAME_OVER to server only if you win
                if (turnColour !== orientation) {
                    if (game.in_checkmate()) {
                        isDraw  = false;
                        winSide = orientation;
                    } else if ( game.in_draw() ||
                                game.in_stalemate() ||
                                game.in_threefold_repition() ||
                                game.insufficient_material()) {
                        isDraw  = true;
                        winSide = null;
                    }

                    if (opts.onYouWin) {
                        opts.onYouWin({
                            gameId: gameId,
                            username: username,
                            winSide: turnColour === 'white' ? 'black' : 'white',
                            pgn: game.pgn(),
                        }, api);
                    }
                }

                if (opts.onGameOver) {
                    opts.onGameOver({
                        gameId: gameId,
                        winSide: turnColour === 'white' ? 'black' : 'white',
                        isLocalPlayerWin: turnColour !== orientation,
                        username: username,
                        pgn: game.pgn(),
                    }, api);
                }

                if (game.in_checkmate())        alert(lastColour + " has won the game by checkmate");
                else if (game.in_draw())        alert("It's a draw!");
                else if (game.in_stalemate())   alert("Stalemate!");
                else if (game.in_threefold_repition()) alert("Three move repition, the game is over.")
                else if (game.insufficient_material()) alert("There is not enough matieral. Game has ended as a draw.");
            }

            updateStatus(statusToSet);
        };

        var onDragStart = function onDragStart(source, piece, position, orientation){
          if (
              [
                  BOARD_STATUS.YOUR_TURN,
                  BOARD_STATUS.IN_CHECK
              ].indexOf(currentStatus) === -1 ||
              game.game_over() ||
              game.in_draw() ||
              // If the player is white then do not let the player move any of the black pieces.
              (orientation === 'white' && /^b/.test(piece)) ||
              // If the player is black then do not let the player move any of the white pieces.
              (orientation === 'black' && /^w/.test(piece))
             ) {
              return false;
            }
        };

        var onPieceDrop = function(source, target){
            // Check if that the player is moving is legal.
            var move = game.move({
                from: source,
                to: target,
                promotion: 'q' // NOTE: The game will always promote a pawn to a Queen for simplicity.
            });

            // If the move is illegal then return the piece back to its original position.
            if(move === null){
                return 'snapback';
            }
        };

        var onSnapEnd = function onSnapEnd(target){
            // Update the move made by the user on the Chess on the board itself.
            console.log('pgn updated', game.pgn());

            if (opts.onMove) {
                opts.onMove({
                    gameId: gameId,
                    username: username,
                    pgn: game.pgn(),
                    fen: game.fen()
                }, api);
            }

            updateByPgn();
        };

        var updateStatus = function (status) {
            var bgColor;
            var text;

            currentStatus = status;

            switch (status) {
                case BOARD_STATUS.WAITING_JOIN:
                    bgColor = 'rgb(250, 76, 156)';
                    text    = 'Waiting';
                    break;
                case BOARD_STATUS.WAITING_MOVE:
                    bgColor = 'rgb(47, 157, 227)';
                    text    = 'Opponent To Move';
                    break;
                case BOARD_STATUS.YOUR_TURN:
                    bgColor = 'rgb(245, 109, 43)';
                    text    = 'Your Turn';
                    break;
                case BOARD_STATUS.CHECK:
                    bgColor = 'rgb(4, 198, 0)';
                    text    = 'CHECK!';
                    break;
                case BOARD_STATUS.IN_CHECK:
                    bgColor = 'rgb(251, 55, 55)';
                    text    = 'Your are IN CHECK!';
                    break;
                default:
                    bgColor = '#666';
                    text    = 'Game Over';
                    break;
            }

            $status.attr('style', 'background: ' + bgColor + ' !important;');
            $status.find('h3').text(text);
        };

        var updateByPgn = function (pgn) {
            if (pgn && pgn.length) {
                game.load_pgn(pgn);
            }

            board.position(game.fen());

            var pgnText = game.pgn({
                newline_char: '\n',
                max_width: 5
            });
            var pgnHtml = pgnText.split('\n')
                                .reverse()
                                .join('<br />');

            $pgn.html(pgnHtml);

            if (pgnText.length > 0) {
                $downPgn.attr('href', 'data:text/plain;base64,' + window.btoa(pgnText))
                        .show();
            } else {
                $downPgn.hide();
            }

            checkGame();
        };

        var updateLink = function (url) {
            $url.html('<a href="' + url + '">' + url + '</a>');
        };

        var initButtons = function () {
            if (opts.onOfferDrawClicked) {
                $offerDraw.click(function () {
                    opts.onOfferDrawClicked({
                        gameId: gameId,
                        username: username
                    }, api);
                });
            } else {
                $offerDraw.hide();
            }

            if (opts.onResignClicked) {
                $resign.click(function () {
                    opts.onResignClicked({
                        gameId: gameId,
                        username: username,
                        side: orientation
                    }, api);
                });
            } else {
                $resign.hide();
            }
        };

        var boardConfig = {
            draggable: true,
            position: position,
            orientation: ['black', 'white'].indexOf(orientation) !== -1 ? orientation : 'white',
            onDragStart: onDragStart,
            onDrop: onPieceDrop,
            onSnapEnd: onSnapEnd,
            pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
        };
        var board = ChessBoard('board', boardConfig);
        var api = {
            BOARD_STATUS: BOARD_STATUS,
            updateLink: updateLink,
            updateStatus: updateStatus,
            updateByPgn: updateByPgn,
            checkGame: checkGame,
            moveChess: function (m) {
                game.move(m);
                updateByPgn();
            }
        };

        updateLink(window.location.href);
        initButtons();
        updateByPgn();

        if (opts.onLoad) {
            opts.onLoad({
                gameId: gameId,
                username: username,
                orientation: orientation
            }, api);
        }

        switch (serverStatus) {
            case 'created':
                updateStatus(BOARD_STATUS.WAITING_JOIN);
                break;
            case 'playing':
                checkGame();
                break;
        }
    };

    // export the function based on enviroment
    if (_module) {
        module.exports = initializeChess;
    } else if (_define) {
        define(initializeChess);
    }

    if (_global) {
        window.initializeChess = initializeChess;
    }
})(typeof window !== 'undefined', typeof module !== 'undefined', typeof define !== 'undefined');
