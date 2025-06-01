const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Add a basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  // Add better connection handling
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Simple game session store
const gameSessions = new Map();

// Define achievement types
const ACHIEVEMENTS = {
  FIRST_CORRECT: {
    id: 1,
    name: 'Speed Demon',
    description: 'First player to answer correctly',
    icon: '⚡'
  },
  PERFECT_SCORE: {
    id: 2,
    name: 'Perfect Score',
    description: 'Got all questions correct',
    icon: '🎯'
  },
  THREE_STREAK: {
    id: 3,
    name: 'Hat Trick',
    description: 'Three correct answers in a row',
    icon: '🎩'
  },
  FIVE_STREAK: {
    id: 4,
    name: 'On Fire',
    description: 'Five correct answers in a row',
    icon: '🔥'
  },
  COMEBACK: {
    id: 5,
    name: 'Comeback Kid',
    description: 'From bottom half to top three',
    icon: '🚀'
  }
};

// Helper function to get leaderboard data and emit leaderboard:show
const showLeaderboardToAll = (sessionId, gameSession) => {
  const leaderboard = Array.from(gameSession.players.values())
    .sort((a, b) => b.score - a.score)
    .map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      correctAnswers: player.correctAnswers || 0,
      streak: player.streak || 0,
      achievements: player.achievements || []
    }));
    
  const leaderboardData = {
    leaderboard: leaderboard || [],
    previousLeaderboard: gameSession.previousLeaderboard || [],
    correctAnswerIndex: gameSession.currentQuestion?.correct_index
  };
  
  io.to(`host:${sessionId}`).emit('leaderboard:show', leaderboardData);
  io.to(`players:${sessionId}`).emit('leaderboard:show', leaderboardData);
};

// Add a function to store current game state in the session
const storeGameState = (gameSession) => {
  if (!gameSession) return;
  
  // Store the current state in the session for reconnection
  gameSession.persistentState = {
    status: gameSession.status,
    questionIndex: gameSession.questionIndex,
    currentQuestion: gameSession.currentQuestion,
    leaderboard: Array.from(gameSession.players.values())
      .sort((a, b) => b.score - a.score)
      .map(player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        correctAnswers: player.correctAnswers || 0,
        streak: player.streak || 0,
        achievements: player.achievements || []
      }))
  };
};

// Helper function to award achievements
const awardAchievement = (sessionId, gameSession, playerId, achievementType) => {
  const player = gameSession.players.get(playerId);
  if (!player) return;
  
  // Initialize achievements array if it doesn't exist
  if (!player.achievements) {
    player.achievements = [];
  }
  
  // Check if player already has this achievement
  if (player.achievements.some(a => a.id === ACHIEVEMENTS[achievementType].id)) {
    return; // Already has this achievement
  }
  
  // Add the achievement
  const achievement = { ...ACHIEVEMENTS[achievementType], earnedAt: new Date().toISOString() };
  player.achievements.push(achievement);
  
  // Notify the player
  io.to(playerId).emit('achievement:earned', achievement);
  
  // Notify the host
  io.to(`host:${sessionId}`).emit('player:achievement', {
    playerId,
    playerName: player.name,
    achievement
  });
  
  console.log(`Player ${player.name} earned achievement: ${achievement.name}`);
};

// Helper function to check and award achievements
const checkAchievements = (sessionId, gameSession, playerId) => {
  const player = gameSession.players.get(playerId);
  if (!player) return;
  
  // Check for streak achievements
  if (player.streak === 3) {
    awardAchievement(sessionId, gameSession, playerId, 'THREE_STREAK');
  } else if (player.streak === 5) {
    awardAchievement(sessionId, gameSession, playerId, 'FIVE_STREAK');
  }
  
  // Check for first correct answer
  if (gameSession.questionFirstCorrect === playerId) {
    awardAchievement(sessionId, gameSession, playerId, 'FIRST_CORRECT');
  }
  
  // Check for perfect score at the end of the game
  if (gameSession.questionIndex === gameSession.quiz.questions.length - 1) {
    if (player.correctAnswers === gameSession.quiz.questions.length) {
      awardAchievement(sessionId, gameSession, playerId, 'PERFECT_SCORE');
    }
  }
  
  // Check for comeback kid (bottom half to top three)
  if (gameSession.previousLeaderboard && gameSession.previousLeaderboard.length > 0) {
    const playerCount = gameSession.previousLeaderboard.length;
    if (playerCount >= 6) { // Only check if there are enough players
      const prevPosition = gameSession.previousLeaderboard.findIndex(p => p.id === playerId);
      const halfwayPoint = Math.floor(playerCount / 2);
      
      if (prevPosition >= halfwayPoint) { // Was in bottom half
        const currentLeaderboard = Array.from(gameSession.players.values())
          .sort((a, b) => b.score - a.score);
        const currentPosition = currentLeaderboard.findIndex(p => p.id === playerId);
        
        if (currentPosition < 3) { // Now in top 3
          awardAchievement(sessionId, gameSession, playerId, 'COMEBACK');
        }
      }
    }
  }
};

io.on('connection', (socket) => {
  const { sessionId, role, name } = socket.handshake.query;
  
  if (!sessionId) {
    console.log('Connection attempt without session ID, disconnecting');
    socket.emit('error', { message: 'Session ID is required' });
    socket.disconnect();
    return;
  }

  console.log(`New ${role} connection for session ${sessionId}`);

  // Get or create game session
  let gameSession = gameSessions.get(sessionId);
  if (!gameSession) {
    console.log(`Creating new game session: ${sessionId}`);
    gameSession = {
      id: sessionId,
      players: new Map(),
      currentQuestion: null,
      questionIndex: -1,
      status: 'waiting',
      previousLeaderboard: [],
      answeredPlayers: new Set(),
      questionFirstCorrect: null
    };
    gameSessions.set(sessionId, gameSession);
  }

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${role} in session ${sessionId}:`, error);
  });

  // Handle host connection
  if (role === 'host') {
    socket.join(`host:${sessionId}`);
    
    // If there's a persistent state, send it to the reconnected host
    if (gameSession.persistentState) {
      console.log(`Restoring game state for host in session ${sessionId}`);
      
      // Send the current game state
      socket.emit('game:restore', {
        status: gameSession.persistentState.status,
        questionIndex: gameSession.persistentState.questionIndex,
        currentQuestion: gameSession.persistentState.currentQuestion,
        leaderboard: gameSession.persistentState.leaderboard
      });
    }
  }

  // Handle player connection
  if (role === 'player' && name) {
    // Check for duplicate names
    const isDuplicate = Array.from(gameSession.players.values())
      .some(p => p.name.toLowerCase() === name.toLowerCase());

    if (isDuplicate) {
      socket.emit('error', { message: 'Name already taken' });
      socket.disconnect();
      return;
    }

    socket.join(`players:${sessionId}`);
    gameSession.players.set(socket.id, {
      id: socket.id,
      name,
      score: 0,
      correctAnswers: 0,
      streak: 0,
      achievements: []
    });
    
    // Notify host of new player
    io.to(`host:${sessionId}`).emit('player:join', {
      id: socket.id,
      name,
      score: 0,
      correctAnswers: 0,
      streak: 0,
      achievements: []
    });
  }

  // Handle disconnection
  socket.on('disconnect', () => {
    if (role === 'player') {
      gameSession?.players.delete(socket.id);
      io.to(`host:${sessionId}`).emit('player:leave', socket.id);
    }
    
    // Clean up empty sessions
    if (gameSession?.players.size === 0) {
      gameSessions.delete(sessionId);
    }
  });

  // Game events
  socket.on('game:start', (quiz) => {
    if (role !== 'host') return;
    
    // If random_questions is enabled, shuffle the questions
    if (quiz.random_questions) {
      quiz.questions = shuffleArray([...quiz.questions]);
    }
    
    gameSession.quiz = quiz;
    gameSession.status = 'active';
    gameSession.questionIndex = -1;
    
    // Store the current state for potential reconnection
    storeGameState(gameSession);
    
    io.to(`players:${sessionId}`).emit('game:start');
    socket.emit('game:started');
  });

  // Add new handler for next:question
  socket.on('next:question', () => {
    if (role !== 'host') return;
    
    // Notify all players to prepare for the next question
    // This helps maintain socket connections during transitions
    io.to(`players:${sessionId}`).emit('next:question');
    
    console.log(`Host is preparing players for next question in session ${sessionId}`);
  });

  socket.on('question:start', ({ index }) => {
    if (role !== 'host') return;
    
    const question = gameSession.quiz.questions[index];
    if (!question) {
      console.error('Invalid question index:', index);
      return;
    }
    
    gameSession.currentQuestion = question;
    gameSession.questionIndex = index;
    gameSession.status = 'active';
    gameSession.questionFirstCorrect = null; // Reset first correct for new question
    
    // Store the current state for potential reconnection
    storeGameState(gameSession);
    
    // Reset answered players for new question - make it empty
    gameSession.answeredPlayers = new Set();
    
    // Send question to players (without correct answer)
    const sanitizedQuestion = {
      id: question.id,
      question: question.question,
      options: question.options,
      questionType: question.question_type || question.questionType || 'multiple_choice',
      points: question.points || 1000
    };
    
    // Set a consistent time limit for all clients
    const timeLimit = question.time_limit || question.timeLimit || 30;
    
    console.log('Sending question to players:', sanitizedQuestion);

    // First send a prepare event to all players
    io.to(`players:${sessionId}`).emit('next:question');
    
    // After a short delay, send the actual question
    setTimeout(() => {
      io.to(`players:${sessionId}`).emit('question:start', {
        question: sanitizedQuestion,
        timeLimit: timeLimit
      });
      
      // Send same event to host but include correct answer
      socket.emit('question:start', {
        question: {
          ...sanitizedQuestion,
          correct_index: question.correct_index
        },
        timeLimit: timeLimit
      });
    }, 500); // Short delay to ensure all clients are ready
  });

  // Update the answer:submit handler to track answer changes
  socket.on('answer:submit', ({ answer, timeSpent }) => {
    if (role !== 'player') return;
    
    const player = gameSession.players.get(socket.id);
    const question = gameSession.currentQuestion;
    
    if (!player || !question) return;
    
    // Check if this is a change from a previous answer
    const isChangingAnswer = player.currentAnswer !== undefined && player.currentAnswer !== answer;
    
    // Store the player's current answer - this can change until the question ends
    player.currentAnswer = answer;
    player.timeSpent = timeSpent;
    player.hasChangedAnswer = isChangingAnswer || player.hasChangedAnswer;
    
    // Notify host about this player's answer (without revealing if it's correct)
    io.to(`host:${sessionId}`).emit('player:answer', {
      playerId: socket.id,
      playerName: player.name,
      answer: answer,
      hasChangedAnswer: player.hasChangedAnswer
    });
    
    // Note: We don't update scores or send results yet - this happens when the question ends
    // Just acknowledge the answer was received
    socket.emit('answer:received', { answer });
  });

  // Add a new event for finalizing answers when the question ends
  socket.on('question:end', () => {
    if (role !== 'host') return;
    
    finalizeAnswers(sessionId, gameSession);
    
    // Send the updated leaderboard with correct answer
    showLeaderboardToAll(sessionId, gameSession);
  });

  // Update the skip button handler
  socket.on('question:skip', () => {
    if (role !== 'host') return;
    
    // Finalize all answers
    finalizeAnswers(sessionId, gameSession);
    
    // Notify all players the question was skipped
    io.to(`players:${sessionId}`).emit('question:skip');
    
    // Show leaderboard to all
    showLeaderboardToAll(sessionId, gameSession);
  });

  // Update the game:end handler to delete the session from database
  socket.on('game:end', async () => {
    if (role !== 'host') return;
    
    try {
      // Notify all players that the game has ended
      io.to(`players:${sessionId}`).emit('game:end', { cleanup: true });
      
      // Delete the game session from memory
      gameSessions.delete(sessionId);
      
      // Delete the session from the database
      // This should be handled by your database adapter
      // For example, if you're using a db object:
      socket.emit('db:delete_session', { sessionId });
      
      console.log(`Game session ${sessionId} ended and deleted`);
    } catch (err) {
      console.error(`Error ending game session ${sessionId}:`, err);
      socket.emit('error', { message: 'Failed to end game session' });
    }
  });
});

// Helper function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Update finalizeAnswers to include information about changed answers
function finalizeAnswers(sessionId, gameSession) {
  if (!gameSession.currentQuestion) return;
  
  const question = gameSession.currentQuestion;
  
  // Now add all players with answers to the answeredPlayers set
  gameSession.players.forEach((player, playerId) => {
    if (player.currentAnswer !== undefined) {
      gameSession.answeredPlayers.add(playerId);
    }
  });
  
  // Track if we've identified first correct player
  let firstCorrectFound = false;
  
  // Process all players' answers
  gameSession.players.forEach((player, playerId) => {
    // If player didn't answer, reset streak and send timeout result
    if (player.currentAnswer === undefined) {
      player.streak = 0;
      
      // Send timeout result to player
      io.to(playerId).emit('answer:result', {
        isCorrect: false,
        points: 0,
        totalScore: player.score,
        correctAnswer: question.correct_index,
        timeout: true,
        streak: 0
      });
    } else {
      // Process submitted answer
      const isCorrect = player.currentAnswer === question.correct_index;
      const timeSpent = player.timeSpent || 30; // Default to max time if not recorded
      const basePoints = question.points || 1000;
      
      // Calculate points
      const timeLimit = 30; // seconds
      const timeBonus = Math.max(0, (timeLimit - timeSpent) / timeLimit);
      const points = isCorrect ? Math.round(basePoints * (0.5 + timeBonus * 0.5)) : 0;
      
      // Check if this is the first correct answer
      if (isCorrect && !firstCorrectFound && !gameSession.questionFirstCorrect) {
        gameSession.questionFirstCorrect = playerId;
        firstCorrectFound = true;
      }
      
      // Update player stats
      player.score += points;
      if (isCorrect) {
        player.correctAnswers = (player.correctAnswers || 0) + 1;
        player.streak = (player.streak || 0) + 1;
      } else {
        player.streak = 0;
      }
      
      // Send result to player
      io.to(playerId).emit('answer:result', {
        isCorrect,
        points,
        totalScore: player.score,
        correctAnswer: question.correct_index,
        streak: player.streak,
        hasChangedAnswer: player.hasChangedAnswer
      });
      
      // Check and award achievements
      checkAchievements(sessionId, gameSession, playerId);
    }
    
    // Reset for next question
    delete player.currentAnswer;
    delete player.timeSpent;
    delete player.hasChangedAnswer;
  });
  
  // Store previous leaderboard for position changes
  gameSession.previousLeaderboard = Array.from(gameSession.players.values())
    .sort((a, b) => b.score - a.score)
    .map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      streak: player.streak
    }));
  
  // Store the current state for potential reconnection
  storeGameState(gameSession);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 