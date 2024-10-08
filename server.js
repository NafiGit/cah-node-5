import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3001;

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// Game state
let players = [];
let currentCzar = null;
let blackCard = null;
let submittedCards = [];
let gameState = 'waiting';

const blackCards = [
  "Why can't I sleep at night?",
  "What's that smell?",
  "I got 99 problems but _ ain't one.",
  "What's the next Happy Meal toy?",
  "What's my secret power?"
];

const whiteCards = [
  "Aliens", "Batman", "Cats", "Donald Trump", "Explosions",
  "Free samples", "Ghosts", "Harry Potter", "Internet", "Jurassic Park",
  "Kanye West", "Lightsabers", "Memes", "Netflix", "Oprah",
  "Pizza", "Quicksand", "Reddit", "Socks", "Tacos"
];

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function dealCards() {
  players.forEach(player => {
    while (player.hand.length < 7) {
      player.hand.push(whiteCards[Math.floor(Math.random() * whiteCards.length)]);
    }
  });
}

function startNewRound() {
  gameState = 'playing';
  submittedCards = [];
  blackCard = blackCards[Math.floor(Math.random() * blackCards.length)];
  currentCzar = players[(players.indexOf(currentCzar) + 1) % players.length];
  dealCards();

  io.emit('newRound', { blackCard, czar: currentCzar.id });
  players.forEach(player => {
    io.to(player.id).emit('updateHand', player.hand);
  });
}

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join', (playerName) => {
    const player = { id: socket.id, name: playerName, score: 0, hand: [] };
    players.push(player);
    socket.emit('joined', player);
    io.emit('updatePlayers', players);

    if (players.length === 1) {
      currentCzar = player;
    }

    if (players.length >= 3 && gameState === 'waiting') {
      startNewRound();
    }
  });

  socket.on('playCard', (card) => {
    if (gameState === 'playing' && socket.id !== currentCzar.id) {
      const player = players.find(p => p.id === socket.id);
      if (player) {
        player.hand = player.hand.filter(c => c !== card);
        submittedCards.push({ playerId: socket.id, card });
        io.to(socket.id).emit('updateHand', player.hand);
        io.emit('cardPlayed', { playerId: socket.id, cardCount: submittedCards.length });

        if (submittedCards.length === players.length - 1) {
          gameState = 'selecting';
          io.emit('allCardsSubmitted', submittedCards);
        }
      }
    }
  });

  socket.on('selectWinner', (winningCard) => {
    if (gameState === 'selecting' && socket.id === currentCzar.id) {
      const winner = players.find(p => p.id === winningCard.playerId);
      if (winner) {
        winner.score += 1;
        io.emit('roundWinner', { winner: winner.id, card: winningCard.card });
        io.emit('updatePlayers', players);
        setTimeout(startNewRound, 5000);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    players = players.filter(p => p.id !== socket.id);
    io.emit('updatePlayers', players);

    if (players.length < 3) {
      gameState = 'waiting';
      io.emit('gameWaiting');
    } else if (currentCzar && currentCzar.id === socket.id) {
      startNewRound();
    }
  });
});

// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));