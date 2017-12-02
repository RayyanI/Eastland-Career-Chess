# Chess

### Steps.
## Change the database settings at config/database.js
## npm install
## npm start
## visit http://localhost:3000

#
*/

implementation notes:

There should be three options inside of the game:

  1 --> Play Random
  The requesting user should have his unique identifier recorded and be added to the lobby queue. Once an opponent has been found
 then the two players should be matched up. As they are matched up a unique and randomly generated gameID will be created
  which will be a string of letters and characters.

  2 --> Play AI
  The requesting user will be asked to select a difficulty of the Artifical Intelligence that he would like to play against.
  This difficulty will vary from the numbers 1 --> 10, one being the easiest game mode and 10 being the hardest game mode. The AI engine
  that I will use for this will be Stockfish.

  3 --> Play Friend
  The requesting user will be brought to a game and be playing as the colour white on the board. Additionally, the user will be provided
  with a unique and randomly generated link containing the gameID which consists of 20 characters and letters. This gameID can be sent
  to the opponent and then the opponent can join the game and play as black.



NOTE: An important thing to note is that this does not include the implementation of Glicko-2 which will be used to calculate the relative
skill levels of the players on the system.
