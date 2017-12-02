# Web based multiplayer Chess for the Eastland Career Center
A multiplayer chess system designed for a club at the school. This application allows users to play chess in real time against one-another with rankings in the form of (W/L/ELO) being calculated for each user. Training features also exist

## Installation
```
Change the database settings at config/database.js
npm install
npm start
visit http://localhost:3000
```

### Prequisites
```
Node-JS
MongoDB
```
### Features

Matchmaking
```
A matchmaking system that connects two users together with similar elos ( if available ) and redirects them into a game of Chess.
```

Practice
```
Play against the Stockfish Chess engine to train your skills and improve your game. Details of the engine's thought process are also provided for additional incite
```

Play friends!
```
Play against a friend by sending them a random alphanumeric randomly generated link to ensure you play together
```
