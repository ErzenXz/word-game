const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const gameLogic = require("./gameLogic");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const prisma = new PrismaClient();

app.use(express.static("client"));

const rooms = new Map();

function initializeGame(roomId) {
  const gameState = rooms.get(roomId);
  if (!gameState) return;

  gameState.currentPlayer = gameState.players[0].name;
  gameState.gamePhase = "drawing";
  gameState.theme = gameLogic.getRandomTheme();
  gameState.roundTimer = 60;
  gameState.drawingData = [];
  gameState.isActive = true;

  io.to(roomId).emit("gameState", sanitizeGameState(gameState));
  io.to(roomId).emit("startDrawing", {
    playerName: gameState.currentPlayer,
    theme: gameState.theme,
  });
}

function sanitizeGameState(gameState) {
  return {
    players: gameState.players.map((player) => ({
      name: player.name,
      score: player.score,
      lives: player.lives,
      isActive: player.isActive,
      guessedCorrectly: player.guessedCorrectly,
    })),
    currentPlayer: gameState.currentPlayer,
    currentWord: gameState.currentWord,
    theme: gameState.theme,
    gamePhase: gameState.gamePhase,
    roundTimer: gameState.roundTimer,
    code: gameState.code,
    wordHint: gameState.wordHint,
  };
}

io.on("connection", (socket) => {
  console.log(
    "New client connected " + socket.id + " " + socket.handshake.address
  );

  // Send the list of rooms to the client
  socket.emit("roomList", Array.from(rooms.entries()));

  socket.on("createRoom", async ({ playerName, roomName }) => {
    try {
      let roomCode;
      let existingRoom;

      do {
        roomCode = Math.floor(100000 + Math.random() * 900000);
        existingRoom = await prisma.room.findUnique({
          where: { code: roomCode },
        });
      } while (existingRoom);

      const theme = await gameLogic.getRandomTheme();

      const room = await prisma.room.create({
        data: {
          name: roomName,
          code: roomCode,
          players: {
            create: {
              name: playerName,
              lives: 3,
              score: 0,
            },
          },
        },
        include: {
          players: true,
        },
      });

      const gameState = gameLogic.initializeGameState(room);
      rooms.set(room.id, gameState);

      socket.join(room.id);
      socket.roomId = room.id;
      socket.playerName = playerName;

      io.to(room.id).emit("roomJoined", {
        roomId: room.id,
        playerName,
        code: roomCode,
      });

      io.to(room.id).emit("gameState", sanitizeGameState(gameState));
      io.emit("roomList", Array.from(rooms.entries()));
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", {
        message: "Error creating room. Please try again.",
      });
    }
  });

  socket.on("joinRoom", async ({ playerName, roomId }) => {
    try {
      let codeJoin = Number(roomId);
      const existingRoom = await prisma.room.findUnique({
        where: { code: codeJoin },
      });

      if (!existingRoom) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      const room = await prisma.room.update({
        where: { code: codeJoin },
        data: {
          players: {
            create: {
              name: playerName,
              lives: 3,
              score: 0,
            },
          },
        },
        include: {
          players: true,
        },
      });

      socket.join(room.id);
      socket.roomId = room.id;
      socket.code = codeJoin;
      socket.playerName = playerName;

      let gameState = rooms.get(room.id);
      if (!gameState) {
        gameState = gameLogic.initializeGameState(room);
        rooms.set(room.id, gameState);
      } else {
        gameState.players = room.players;
      }

      if (gameState.players.length === 2 && gameState.gamePhase === "waiting") {
        initializeGame(room.id);
      }

      io.to(room.id).emit("roomJoined", { roomId: room.id, playerName });
      io.to(room.id).emit("gameState", sanitizeGameState(gameState));
      io.emit("roomList", Array.from(rooms.entries()));
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Error joining room" });
    }
  });

  socket.on("draw", ({ x, y, isDrawing, size, color }) => {
    const gameState = rooms.get(socket.roomId);
    if (gameState && gameState.currentPlayer === socket.playerName) {
      gameState.drawingData.push({ x, y, isDrawing, size, color });
      io.to(socket.roomId).emit("drawUpdate", { x, y, isDrawing, size, color });
    }
  });

  socket.on("chooseWord", ({ word }) => {
    const gameState = rooms.get(socket.roomId);
    if (
      !gameState ||
      gameState.gamePhase !== "drawing" ||
      gameState.currentPlayer !== socket.playerName
    ) {
      return;
    }

    gameState.currentWord = word;
    gameState.gamePhase = "guessing";
    gameState.roundStartTime = Date.now();
    gameState.roundTimer = 60;
    gameState.wordHint = "_ ".repeat(word.length);
    gameState.revealedLetters = 0;
    gameState.correctGuesses = 0;

    // Reset guessed status for all players
    gameState.players.forEach((player) => {
      player.guessedCorrectly = false;
    });

    if (gameState.roundTimeout) {
      clearTimeout(gameState.roundTimeout);
    }

    io.to(socket.roomId).emit("gameState", sanitizeGameState(gameState));
    io.to(socket.roomId).emit("startRound", {
      roundTimer: gameState.roundTimer,
    });

    gameState.roundTimeout = setTimeout(() => {
      endRound(socket.roomId);
    }, gameState.roundTimer * 1000);
  });

  socket.on("makeGuess", ({ guess }) => {
    const gameState = rooms.get(socket.roomId);
    if (
      !gameState ||
      gameState.gamePhase !== "guessing" ||
      gameState.currentPlayer === socket.playerName
    ) {
      return;
    }

    const player = gameState.players.find((p) => p.name === socket.playerName);

    // Don't allow guessing if player already guessed correctly
    if (player.guessedCorrectly) return;

    const result = gameLogic.checkGuess(guess, gameState.currentWord);

    if (result.correct) {
      player.guessedCorrectly = true;
      player.score += Math.ceil(gameState.roundTimer / 2);
      gameState.correctGuesses++;

      socket.emit("guessResult", {
        correct: true,
        score: player.score,
        soundEffect: "correct_guess",
      });

      // Update game state for all players but don't end the round
      io.to(socket.roomId).emit("gameState", sanitizeGameState(gameState));
    } else {
      if (player.lives > 0) {
        player.lives--;
      }

      socket.emit("guessResult", {
        correct: false,
        lives: player.lives,
        soundEffect: "incorrect_guess",
      });

      io.to(socket.roomId).emit("gameState", sanitizeGameState(gameState));
    }
  });

  socket.on("requestLetterReveal", () => {
    const gameState = rooms.get(socket.roomId);
    if (!gameState || gameState.gamePhase !== "guessing") return;

    const word = gameState.currentWord;
    const currentHint = gameState.wordHint.split(" ");
    const hiddenIndices = currentHint.reduce((acc, char, index) => {
      if (char === "_") acc.push(index);
      return acc;
    }, []);

    if (hiddenIndices.length > 0) {
      const revealIndex =
        hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      currentHint[revealIndex] = word[revealIndex];
      gameState.wordHint = currentHint.join(" ");
      gameState.revealedLetters++;

      io.to(socket.roomId).emit("letterRevealed", {
        wordHint: gameState.wordHint,
        soundEffect: "letter_reveal",
      });
    }
  });

  socket.on("sendMessage", async ({ message }) => {
    try {
      const chatMessage = await prisma.roomChat.create({
        data: {
          message,
          roomId: socket.roomId,
        },
      });

      io.to(socket.roomId).emit("message", {
        message: chatMessage.message,
        playerName: socket.playerName,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", { message: "Error sending message" });
    }
  });

  // KEEP alive to check if the user is still connected
  const pingInterval = setInterval(() => {
    socket.emit("ping", Date.now());
  }, 1000);

  let pongReceived = true;

  socket.on("pong", (time) => {
    pongReceived = true;
    //console.log("Pong received in " + (Date.now() - new Date(time)) + "ms");
  });

  const checkConnectionInterval = setInterval(() => {
    if (!pongReceived) {
      // console.log("Client did not respond to ping, disconnecting...");
      socket.disconnect();
    }
    pongReceived = false;
  }, 5000);

  socket.on("disconnect", async () => {
    console.log("Client disconnected");
    if (socket.roomId) {
      const gameState = rooms.get(socket.roomId);
      if (gameState) {
        gameState.players = gameState.players.filter(
          (p) => p.name !== socket.playerName
        );
        if (gameState.players.length > 0 && !gameLogic.isGameOver(gameState)) {
          if (gameState.currentPlayer === socket.playerName) {
            await gameLogic.nextTurn(gameState);
          }

          io.to(socket.roomId).emit("gameState", sanitizeGameState(gameState));
          io.to(socket.roomId).emit("playerLeft", socket.playerName);
        } else {
          rooms.delete(socket.roomId);
          io.to(socket.roomId).emit("gameOver", {
            winner: null,
            reason: "Not enough players",
          });
        }
      }
      await prisma.player.deleteMany({
        where: {
          name: socket.playerName,
          roomId: String(socket.roomId),
        },
      });
      io.emit("roomList", Array.from(rooms.entries()));
    }
  });
});

function revealLetter(roomId) {
  const gameState = rooms.get(roomId);
  if (!gameState || gameState.gamePhase !== "guessing") return;

  const hiddenIndices = gameState.wordHint
    .split(" ")
    .reduce((acc, char, index) => {
      if (char === "_") acc.push(index);
      return acc;
    }, []);

  if (hiddenIndices.length > 0) {
    const revealIndex =
      hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    const hintArray = gameState.wordHint.split(" ");
    hintArray[revealIndex] = gameState.currentWord[revealIndex];
    gameState.wordHint = hintArray.join(" ");
    gameState.revealedLetters++;

    io.to(roomId).emit("letterRevealed", {
      wordHint: gameState.wordHint,
      soundEffect: "letter_reveal",
    });
  }

  if (gameState.revealedLetters >= gameState.currentWord.length) {
    endRound(roomId);
  }
}

function endRound(roomId) {
  const gameState = rooms.get(roomId);
  if (!gameState || gameState.gamePhase !== "guessing") return;

  if (gameState.roundTimeout) {
    clearTimeout(gameState.roundTimeout);
  }

  // Calculate scores based on correct guesses
  gameState.players.forEach((player) => {
    if (player.guessedCorrectly) {
      player.score += 50;
    }
  });

  gameState.gamePhase = "roundEnd";

  io.to(roomId).emit("roundEnd", {
    word: gameState.currentWord,
    correctGuesses: gameState.correctGuesses,
    gameOver: false,
    soundEffect: gameState.correctGuesses > 0 ? "round_win" : "round_lose",
  });

  // Start next round after delay
  setTimeout(async () => {
    // Use await here since nextTurn is async
    await gameLogic.nextTurn(gameState);

    console.log("Next turn - Current player:", gameState.currentPlayer); // Debug log

    gameState.roundTimer = 60;
    gameState.gamePhase = "drawing";
    gameState.theme = gameLogic.getRandomTheme();
    gameState.drawingData = [];
    gameState.wordHint = "";
    gameState.currentWord = ""; // Clear the current word

    // Reset guessed status for all players
    gameState.players.forEach((player) => {
      player.guessedCorrectly = false;
    });

    // Emit the updated game state to all players
    io.to(roomId).emit("gameState", sanitizeGameState(gameState));

    // Emit the start drawing event to all players
    io.to(roomId).emit("startDrawing", {
      playerName: gameState.currentPlayer,
      theme: gameState.theme,
    });
  }, 3000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
