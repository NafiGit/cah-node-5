import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, Laugh } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  score: number;
}

interface SubmittedCard {
  playerId: string;
  card: string;
}

// Connect to the Socket.IO server
const socket: Socket = io();

function App() {
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState('waiting');
  const [blackCard, setBlackCard] = useState('');
  const [hand, setHand] = useState<string[]>([]);
  const [isCzar, setIsCzar] = useState(false);
  const [submittedCards, setSubmittedCards] = useState<SubmittedCard[]>([]);
  const [winner, setWinner] = useState<{ id: string; card: string } | null>(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('joined', (player: Player) => {
      console.log('Joined game:', player);
      setGameState('joined');
    });

    socket.on('updatePlayers', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    socket.on('newRound', ({ blackCard, czar }) => {
      setBlackCard(blackCard);
      setIsCzar(czar === socket.id);
      setGameState('playing');
      setSubmittedCards([]);
      setWinner(null);
    });

    socket.on('updateHand', (newHand: string[]) => {
      setHand(newHand);
    });

    socket.on('cardPlayed', ({ playerId, cardCount }) => {
      console.log(`Player ${playerId} played a card. Total cards: ${cardCount}`);
    });

    socket.on('allCardsSubmitted', (cards: SubmittedCard[]) => {
      setSubmittedCards(cards);
      setGameState('selecting');
    });

    socket.on('roundWinner', ({ winner, card }) => {
      setWinner({ id: winner, card });
      setGameState('roundEnd');
    });

    socket.on('gameWaiting', () => {
      setGameState('waiting');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('joined');
      socket.off('updatePlayers');
      socket.off('newRound');
      socket.off('updateHand');
      socket.off('cardPlayed');
      socket.off('allCardsSubmitted');
      socket.off('roundWinner');
      socket.off('gameWaiting');
    };
  }, []);

  const joinGame = () => {
    if (playerName.trim()) {
      console.log('Joining game with name:', playerName);
      socket.emit('join', playerName);
    }
  };

  const playCard = (card: string) => {
    if (!isCzar && gameState === 'playing') {
      socket.emit('playCard', card);
    }
  };

  const selectWinner = (card: SubmittedCard) => {
    if (isCzar && gameState === 'selecting') {
      socket.emit('selectWinner', card);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Cards Against Humanity</h1>
      {gameState === 'waiting' && (
        <div className="bg-white p-8 rounded-lg shadow-md">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-2 mb-4 border rounded"
          />
          <button
            onClick={joinGame}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Join Game
          </button>
        </div>
      )}
      {gameState !== 'waiting' && (
        <div className="w-full max-w-4xl">
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <h2 className="text-2xl font-bold mb-2">Players:</h2>
            <div className="flex flex-wrap gap-2">
              {players.map((player) => (
                <div key={player.id} className="flex items-center bg-gray-100 p-2 rounded">
                  <User className="mr-2" />
                  <span>{player.name} (Score: {player.score})</span>
                  {isCzar && player.id === socket.id && <Laugh className="ml-2" />}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-black text-white p-4 rounded-lg shadow-md mb-4">
            <h2 className="text-xl font-bold mb-2">Black Card:</h2>
            <p>{blackCard}</p>
          </div>
          {!isCzar && gameState === 'playing' && (
            <div className="bg-white p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">Your Hand:</h2>
              <div className="flex flex-wrap gap-2">
                {hand.map((card, index) => (
                  <button
                    key={index}
                    onClick={() => playCard(card)}
                    className="bg-gray-200 p-2 rounded hover:bg-gray-300"
                  >
                    {card}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isCzar && gameState === 'selecting' && (
            <div className="bg-white p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">Select the Winner:</h2>
              <div className="flex flex-wrap gap-2">
                {submittedCards.map((card, index) => (
                  <button
                    key={index}
                    onClick={() => selectWinner(card)}
                    className="bg-gray-200 p-2 rounded hover:bg-gray-300"
                  >
                    {card.card}
                  </button>
                ))}
              </div>
            </div>
          )}
          {gameState === 'roundEnd' && winner && (
            <div className="bg-green-100 p-4 rounded-lg shadow-md mb-4">
              <h2 className="text-xl font-bold mb-2">Round Winner:</h2>
              <p>{players.find(p => p.id === winner.id)?.name} won with: {winner.card}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;