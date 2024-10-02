const socket = io();

const lobbyScreen = document.getElementById("lobby");
const gameScreen = document.getElementById("game");
const playerNameInput = document.getElementById("player-name");
const roomNameInput = document.getElementById("room-name");
const createRoomButton = document.getElementById("create-room");
const joinRoomButton = document.getElementById("join-room");
const roomList = document.getElementById("room-list");

const themeDisplay = document.getElementById("theme-display");
const timerDisplay = document.getElementById("timer");
const wordDisplay = document.getElementById("word-display");
const playersList = document.getElementById("players-list");
const guessInput = document.getElementById("guess-input");
const submitGuessButton = document.getElementById("submit-guess");
const canvas = document.getElementById("drawing-canvas");
const ctx = canvas.getContext("2d");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const sendMessageButton = document.getElementById("send-message");
const chatSidebar = document.getElementById("chat-sidebar");

let currentPlayer = "";
let myPlayer = "";
let currentRoom = "";
let gameState = {};
let isDrawing = false;
let roundTimer = null;
let wordHint = null;

const sounds = {
  incorrect_guess: new Audio("./effects//round-lose.wav"),
  letter_reveal: new Audio("./effects/letter-reveal.wav"),
  round_win: new Audio("./effects/round-win.wav"),
  round_lose: new Audio("./effects/round-lose.wav"),
  game_over: new Audio("./effects/game-over.wav"),
  new_round: new Audio("./effects/new-round.wav"),
};

createRoomButton.addEventListener("click", () => {
  const playerName = playerNameInput.value.trim();
  const roomName = roomNameInput.value.trim();
  if (playerName && roomName) {
    socket.emit("createRoom", { playerName, roomName });
    myPlayer = playerName;
  }
});

joinRoomButton.addEventListener("click", () => {
  const playerName = playerNameInput.value.trim();
  const roomId = roomNameInput.value.trim();
  if (playerName && roomId) {
    socket.emit("joinRoom", { playerName, roomId });
    myPlayer = playerName;
  }
});

socket.on("roomList", (rooms) => {
  console.log(rooms);
  roomList.innerHTML = "";
  rooms.forEach(([id, room]) => {
    const roomElement = document.createElement("div");
    roomElement.classList.add("room-item");
    roomElement.textContent = `${room.name} (${room.players.length} players)`;
    roomElement.addEventListener("click", () => {
      roomNameInput.value = room.code;
    });
    roomList.appendChild(roomElement);
  });
});

socket.on("roomJoined", ({ roomId, playerName }) => {
  currentPlayer = playerName;
  lobbyScreen.style.display = "none";
  gameScreen.style.display = "flex";
  chatSidebar.style.display = "flex";
  timerDisplay.textContent = socket.code;
  chatInput.value = " has joined!";
  sendMessageButton.click();
});

// RECEIVE MESSAGES

socket.on("message", ({ message, playerName }) => {
  const messageElement = document.createElement("div");
  messageElement.classList.add("chat-message");
  messageElement.textContent = `${playerName}: ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

sendMessageButton.addEventListener("click", () => {
  const message = chatInput.value.trim();

  if (message) {
    socket.emit("sendMessage", { message });
    chatInput.value = "";
  }
});

submitGuessButton.addEventListener("click", () => {
  const input = guessInput.value.trim();
  if (!input) return;

  if (
    gameState.gamePhase === "drawing" &&
    gameState.currentPlayer === myPlayer
  ) {
    // Drawing player is setting the word
    socket.emit("chooseWord", { word: input });
    guessInput.value = "";
    guessInput.disabled = true;
    submitGuessButton.disabled = true;
  } else if (
    gameState.gamePhase === "guessing" &&
    gameState.currentPlayer !== myPlayer
  ) {
    // Other players are guessing
    socket.emit("makeGuess", { guess: input });
    guessInput.value = "";
  }
});

socket.on("gameState", (state) => {
  console.log("Received game state:", state);
  gameState = state;

  if (state.roundTimer) {
    timerDisplay.textContent = state.roundTimer;
  }

  updateGameState(state);
});

function updateGameState(state) {
  if (state.theme) {
    themeDisplay.textContent = `Theme: ${state.theme}`;
  }

  if (state.roundTimer) {
    timerDisplay.textContent = state.roundTimer;
  }

  if (state.gamePhase === "drawing") {
    if (state.currentPlayer === myPlayer) {
      wordDisplay.textContent = `Choose a word related to: ${state.theme}`;
      guessInput.disabled = false;
      submitGuessButton.disabled = false;
      guessInput.placeholder = `Enter a ${state.theme} word to draw`;
      submitGuessButton.textContent = "Set Word";
      canvas.style.pointerEvents = "auto";
    } else {
      wordDisplay.textContent = `${state.currentPlayer} is choosing a word...`;
      guessInput.disabled = true;
      submitGuessButton.disabled = true;
      canvas.style.pointerEvents = "none";
    }
  } else if (state.gamePhase === "guessing") {
    if (state.currentPlayer === myPlayer) {
      wordDisplay.textContent = `Your word: ${state.currentWord}`;
      guessInput.disabled = true;
      submitGuessButton.disabled = true;
      canvas.style.pointerEvents = "auto";
    } else {
      wordDisplay.textContent =
        state.wordHint || "_ ".repeat(state.currentWord?.length || 5);
      if (!state.playerGuessedCorrectly) {
        guessInput.disabled = false;
        submitGuessButton.disabled = false;
        guessInput.placeholder = "Enter your guess";
        submitGuessButton.textContent = "Guess";
      }
      canvas.style.pointerEvents = "none";
    }
  }

  // Update players list
  playersList.innerHTML = "";
  state.players.forEach((player) => {
    const playerCard = document.createElement("div");
    playerCard.classList.add("player-card");
    if (player.name === state.currentPlayer) {
      playerCard.classList.add("current-player");
    }
    if (player.guessedCorrectly) {
      playerCard.classList.add("guessed-correctly");
    }
    playerCard.innerHTML = `
      <div class='player-card-name'>
        ${player.name} 
        ${player.name === state.currentPlayer ? "(Drawing)" : ""}
        ${player.guessedCorrectly ? "(Guessed!)" : ""}
      </div>
      <div class='player-card-score'>Score: ${player.score}</div>
      <div class='player-card-lives'>${"❤️".repeat(player.lives)}</div>
    `;
    playersList.appendChild(playerCard);
  });
}

function updateInputState(state) {
  if (state.gamePhase === "drawing" && state.currentPlayer === myPlayer) {
    canvas.style.pointerEvents = "auto";
    guessInput.disabled = false;
    submitGuessButton.disabled = false;
    guessInput.placeholder = `Enter a ${state.theme} word to draw`;
    submitGuessButton.textContent = "Set Word";
  } else if (
    state.gamePhase === "guessing" &&
    state.currentPlayer !== myPlayer
  ) {
    canvas.style.pointerEvents = "none";
    guessInput.disabled = false;
    submitGuessButton.disabled = false;
    guessInput.placeholder = "Enter your guess";
    submitGuessButton.textContent = "Guess";
  } else {
    canvas.style.pointerEvents = "none";
    guessInput.disabled = true;
    submitGuessButton.disabled = true;
    guessInput.placeholder = "Waiting for next turn...";
  }
}

socket.on("startDrawing", ({ playerName, theme }) => {
  themeDisplay.textContent = `Theme: ${theme}`;
  if (playerName === myPlayer) {
    wordDisplay.textContent = "Choose a word to draw";
    guessInput.placeholder = `Enter a ${theme} word to draw`;
    submitGuessButton.textContent = "Set Word";
    guessInput.disabled = false;
    submitGuessButton.disabled = false;
  } else {
    wordDisplay.textContent = `${playerName} is choosing a word...`;
    guessInput.placeholder = "Waiting for word...";
    guessInput.disabled = true;
    submitGuessButton.disabled = true;
  }
  clearCanvas();
});

// Drawing functionality
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

// Set drawing color
function setColor(color) {
  ctx.fillStyle = color;
}

// Set drawing size
function setSize(size) {
  ctx.lineWidth = size;
}

let history = [];
let currentStep = -1;
let currentLine = [];

function startDrawing(e) {
  isDrawing = true;
  currentLine = [];
  draw(e);
}

function draw(e) {
  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Draw a circle at the current position
  ctx.beginPath();
  ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw intermediate circles to fill gaps
  if (currentLine.length > 0) {
    const lastPoint = currentLine[currentLine.length - 1];
    drawLineBetweenPoints(lastPoint.x, lastPoint.y, x, y);
  }

  // Add the current point to the line
  currentLine.push({ x, y });

  // Emit the drawing event
  socket.emit("draw", {
    x,
    y,
    isDrawing: true,
    size: ctx.lineWidth,
    color: ctx.fillStyle,
  });
}

// Stop drawing when the mouse is released
function stopDrawing() {
  if (!isDrawing) return;

  isDrawing = false;
  socket.emit("draw", {
    x: null,
    y: null,
    isDrawing: false,
    size: 0,
    color: "",
  });

  if (currentLine.length > 0) {
    history = history.slice(0, currentStep + 1);
    history.push({
      line: [...currentLine],
      size: ctx.lineWidth,
      color: ctx.strokeStyle,
    });
    currentStep++;
  }

  currentLine = [];
}

// Clear the canvas
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Undo the last drawing action
function undo() {
  if (currentStep >= 0) {
    currentStep--;
    redraw();
  }
}

// Redo the next drawing action
function redo() {
  if (currentStep < history.length - 1) {
    currentStep++;
    redraw();
  }
}

// Redraw the canvas based on the history
function redraw() {
  clearCanvas();
  ctx.beginPath();

  // Replay the history, drawing each saved line with its original size and color
  for (let i = 0; i <= currentStep; i++) {
    const { line, size, color } = history[i];

    // Set the brush properties for this line
    ctx.lineWidth = size;
    ctx.strokeStyle = color;

    for (let j = 0; j < line.length; j++) {
      const { x, y } = line[j];
      if (j === 0) {
        ctx.beginPath();
        ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const lastPoint = line[j - 1];
        drawLineBetweenPoints(lastPoint.x, lastPoint.y, x, y);
      }
    }
  }
}

// Helper function to draw circles between two points
function drawLineBetweenPoints(x1, y1, x2, y2) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const numCircles = Math.ceil(distance / (ctx.lineWidth / 2));

  for (let i = 1; i < numCircles; i++) {
    const interpolatedX = x1 + (x2 - x1) * (i / numCircles);
    const interpolatedY = y1 + (y2 - y1) * (i / numCircles);

    ctx.beginPath();
    ctx.arc(interpolatedX, interpolatedY, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Handle drawing updates from other users
socket.on("drawUpdate", ({ x, y, isDrawing, size, color }) => {
  if (!isDrawing || x === null || y === null) {
    ctx.beginPath();
    currentLine = [];
    return;
  }

  ctx.lineWidth = size;
  ctx.fillStyle = color;

  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw intermediate circles to fill gaps
  if (currentLine.length > 0) {
    const lastPoint = currentLine[currentLine.length - 1];
    drawLineBetweenPoints(lastPoint.x, lastPoint.y, x, y);
  }

  // Add the received point to the line
  currentLine.push({ x, y });

  ctx.beginPath();
});

socket.on("startRound", ({ roundTimer: duration }) => {
  console.log("Round started with timer:", duration);
  startTimer(duration);

  if (gameState.currentPlayer !== myPlayer) {
    guessInput.disabled = false;
    submitGuessButton.disabled = false;
    guessInput.placeholder = "Enter your guess";
    submitGuessButton.textContent = "Guess";
  }
  playSound("new_round");
});

socket.on("roundEnd", ({ word, guessedCorrectly, gameOver }) => {
  if (roundTimer) {
    clearInterval(roundTimer);
  }

  wordDisplay.textContent = `Round ended! The word was: ${word}`;
  guessInput.disabled = true;
  submitGuessButton.disabled = true;

  if (!gameOver) {
    playSound(guessedCorrectly ? "round_win" : "round_lose");
  }
});

socket.on("letterRevealed", ({ wordHint: newHint }) => {
  wordHint = newHint;
  if (gameState.currentPlayer !== myPlayer) {
    wordDisplay.textContent = wordHint;
  }
});

socket.on("startChoosing", ({ playerName, theme }) => {
  themeDisplay.textContent = `Theme: ${theme}`;
  if (playerName === myPlayer) {
    guessInput.placeholder = `Enter a ${theme} word for others to guess`;
    submitGuessButton.textContent = "Set Word";
    guessInput.disabled = false;
    submitGuessButton.disabled = false;
  } else {
    guessInput.placeholder = "Waiting for word...";
    guessInput.disabled = true;
    submitGuessButton.disabled = true;
  }
});

// Add guess result handler
socket.on("guessResult", ({ correct, lives, score, soundEffect }) => {
  if (correct) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("correct-guess");
    messageElement.textContent =
      "Correct guess! Keep watching until the round ends.";
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Disable guessing for this player but keep the round active
    guessInput.disabled = true;
    submitGuessButton.disabled = true;
    guessInput.placeholder = "You got it right! Wait for round to end.";
  }
  playSound(soundEffect);
});

socket.on("playerLeft", (playerName) => {
  const messageElement = document.createElement("div");
  messageElement.classList.add("system-message");
  messageElement.textContent = `${playerName} has left the game.`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("gameOver", ({ winner, reason }) => {
  const gameOverMessage = winner
    ? `Game Over! The winner is ${winner}`
    : `Game Over! ${reason || "No winner this time."}`;
  const messageElement = document.createElement("div");
  messageElement.classList.add("game-over-message");
  messageElement.textContent = gameOverMessage;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  playSound("game_over");
});

function startTimer(duration) {
  if (roundTimer) {
    clearInterval(roundTimer);
  }

  let timeLeft = duration;
  timerDisplay.textContent = timeLeft;

  roundTimer = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    console.log("Time left:", timeLeft);

    if (timeLeft <= 0) {
      clearInterval(roundTimer);
    }
  }, 1000);
}

function playSound(soundEffect) {
  if (sounds[soundEffect]) {
    sounds[soundEffect]
      .play()
      .catch((e) => console.error("Error playing sound:", e));
  }
}

socket.on("error", (error) => {
  messageArea.textContent = error.message;
});

socket.on("ping", () => {
  socket.emit("pong");
});
