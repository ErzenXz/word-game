const themes = [
  "Animals",
  "Food",
  "Countries",
  "Sports",
  "Programming",
  "Music",
  "Movies",
  "Books",
  "Art",
  "History",
  "Science",
  "Technology",
  "Mythology",
  "Space",
  "Travel",
  "Fashion",
  "Nature",
  "Games",
  "Languages",
  "Celebrities",
  "Festivals",
  "Occupations",
  "Vehicles",
  "Emotions",
  "Hobbies",
  "Architecture",
  "Plants",
  "Instruments",
  "Colors",
  "Holidays",
  "Currencies",
  "Landmarks",
  "Anime",
  "Desserts",
  "Transportation",
  "Weather",
  "Mountains",
  "Oceans",
  "Jobs",
  "Furniture",
  "Clothing",
  "School Subjects",
  "Dances",
  "Board Games",
  "Video Games",
  "Fairy Tales",
  "Superheroes",
  "Cartoon Characters",
  "Marine Life",
  "Fruits",
  "Vegetables",
  "Insects",
  "Birds",
  "Aquatic Animals",
  "Flowers",
  "Trees",
  "Famous People",
  "Brands",
  "Vehicles",
  "Furniture",
  "Tools",
  "Baking",
  "Desserts",
  "Beverages",
  "Modes of Transportation",
  "Famous Landmarks",
  "Magical Creatures",
  "Social Media",
  "Cosmetics",
  "Desserts",
  "Famous Buildings",
  "Space Exploration",
  "Outer Space",
  "Famous Paintings",
  "Mythical Creatures",
  "Climates",
  "Seasons",
  "Rivers",
  "Cities",
  "Continents",
  "World Capitals",
  "Religions",
  "Jewelry",
  "Sports Equipment",
  "Hiking Gear",
  "Construction Tools",
  "Chemistry",
  "Physics",
  "Famous Inventions",
  "Fairy Tale Characters",
  "TV Shows",
  "Kitchen Appliances",
  "Construction Vehicles",
  "Festivals Around the World",
  "Music Genres",
  "Movies Genre",
  "Historic Events",
  "Prehistoric Animals",
  "Dog Breeds",
  "Cat Breeds",
];

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const gameLogic = {
  getRandomTheme: () => {
    return themes[Math.floor(Math.random() * themes.length)];
  },

  checkGuess: (guess, word) => {
    const correct = guess.toLowerCase() === word.toLowerCase();
    return { correct };
  },

  nextTurn: async (gameState) => {
    try {
      const currentIndex = gameState.players.findIndex(
        (p) => p.name === gameState.currentPlayer
      );

      // Simply move to the next player who has lives
      let nextIndex = (currentIndex + 1) % gameState.players.length;
      let loopCount = 0;

      while (loopCount < gameState.players.length) {
        const nextPlayer = gameState.players[nextIndex];
        if (nextPlayer && nextPlayer.lives > 0) {
          gameState.currentPlayer = nextPlayer.name;
          break;
        }
        nextIndex = (nextIndex + 1) % gameState.players.length;
        loopCount++;
      }

      // Reset round-specific state
      gameState.currentWord = "";
      gameState.theme = gameLogic.getRandomTheme();
      gameState.gamePhase = "drawing";
      gameState.roundTimer = 60;
      gameState.drawingData = [];
      gameState.wordHint = "";
      gameState.revealedLetters = 0;
      gameState.correctGuesses = 0;

      // Reset guessed status for all players
      gameState.players.forEach((player) => {
        player.guessedCorrectly = false;
      });

      return gameState;
    } catch (error) {
      console.error("Error in nextTurn:", error);
      return gameState;
    }
  },

  isGameOver: (gameState) => {
    const playersWithLives = gameState.players.filter((p) => p.lives > 0);
    return playersWithLives.length <= 1;
  },

  getWinner: (gameState) => {
    return gameState.players.reduce((prev, current) =>
      prev.score > current.score ? prev : current
    );
  },

  initializeGameState: (room) => {
    return {
      roomId: room.id,
      players: room.players.map((player) => ({
        ...player,
        guessedCorrectly: false,
        lives: 3,
        score: 0,
      })),
      currentPlayer: room.players[0].name,
      currentWord: "",
      theme: gameLogic.getRandomTheme(),
      gamePhase: "waiting",
      code: room.code,
      roundTimer: 60,
      roundStartTime: Date.now(),
      drawingData: [],
      wordHint: "",
      revealedLetters: 0,
      correctGuesses: 0,
    };
  },
};

module.exports = gameLogic;
