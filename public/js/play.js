// Initalise Socket & Game Logic
var primus = new Primus();
var game = new Chess();

// Variables
var playerColour, board, finalUrl, gameId
// Inform the server that Client X has now joined the game room.
primus.write(
  {
  action: "join",
  room: gameId,
  data: {user: '<%= user.local.email %>'} // Send the username of the Client to the server.
  }
);


// Default Board Config
var cfg = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onPieceDrop,
  onSnapEnd: onSnapEnd
}

// Everytime data is received about a move being made, update this on the player's board.
primus.on('data', function(message) {
  // Check if a change to the board has been made and if there has been a change, let's update this on the opponents screen.
  if(message.action == 'update' && message.data.pos){
    game.load(message.data.pos);
    board.position(message.data.pos);
  }
});


// Extract the GameID from the request headers.
var finalUrl = "";
var gameId = getUrlVars()['gameId'];
// If this is already an existing gameroom then assign the user to play as black.
if(gameId) {
  finalUrl = window.location.href;
  var playerColour = "b";
} else {
// Generate a room number and assign that player as white.
  gameId = generateId(20);
  finalUrl = window.location.href + "?gameId="+gameId;
  var playerColour = "w";
}


// Provide the gameurl
document.getElementById('gameurl').innerHTML += "<a href='"+finalUrl+"'>"+finalUrl+"</a><br/><br/>";

// If the player is playing as black then provide the perspective of the board from black's point of view.
if(getUrlVars()['gameId']){
  board.orientation('black');
}



/////////////////////////////////
// FUNCTIONS
/////////////////////////////////


// Depending on the colour of the player, which pieces can the player move?
var onDragStart = function onDragStart (source, piece, position, orientation){
  if (
      game.game_over() ||
      game.in_draw() ||
      // If the player is white then do not let the player move any of the black pieces.
      (playerColour == 'w' && piece.search(/^b/) !== -1) ||
      // If the player is black then do not let the player move any of the white pieces.
      (playerColour == 'b' && piece.search(/^w/) !== -1)
     ) {
      return false;
    }
};


// Once a piece has been placed onto its desired square, check if the attempted move being made is legal.
var onPieceDrop = function(source, target){
  // Check if that the player is moving is legal.
  var move = game.move(
    {
    from: source,
    to: target,
    promotion: 'q' // NOTE: The game will always promote a pawn to a Queen for simplicity.
  });

  // If the move is illegal then return the piece back to its original position.
  if(move === null){
    return 'snapback';
  }
};

var onSnapEnd = function(){
  // Update the move made by the user on the Chess on the board itself.
  board.position(game.fen());
  primus.write(
    {
    action: 'data',
    room: gameId,
    data: {
          pos: game.fen(),
          date: new Date(),
          user: '<%= user.local.email %>'
          }
    }
  )
};


function getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}


// dec2hex :: Integer -> String
function dec2hex (dec) {
  return ('0' + dec.toString(16)).substr(-2)
}

// generateId :: Integer -> String
function generateId (len) {
  var arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return Array.from(arr).map(dec2hex).join('')
}

// Create the board using the default (board1) setting.
var board = ChessBoard('board', cfg);
