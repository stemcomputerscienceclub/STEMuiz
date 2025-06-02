import { Server } from 'socket.io';

// Helper function to handle Socket.IO in a serverless environment
const ioHandler = (req, res) => {
  // Check if Socket.IO server is already initialized to prevent re-initialization
  // This is critical for serverless functions to maintain state between invocations
  if (!res.socket.server.io) {
    console.log('**** Initializing Socket.IO server in serverless environment ****');
    
    // Log request details for debugging
    console.log(`Request headers: ${JSON.stringify(req.headers)}`);
    console.log(`Connection protocol: ${req.headers['x-forwarded-proto'] || 'unknown'}`);
    console.log(`Connection host: ${req.headers['x-forwarded-host'] || req.headers.host || 'unknown'}`);
    
    // Create new Socket.IO instance
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      // Socket.IO Configuration optimized for Vercel serverless functions
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 60000,
      // Only use polling transport (no WebSockets in Vercel serverless)
      transports: ['polling'],
      cors: {
        // Accept connections from multiple origins
        origin: ['https://stemuiz.stemcsclub.org', 'http://localhost:3000'],
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Forwarded-Proto', 'X-Forwarded-Host'],
        maxAge: 86400
      },
      // Vercel-specific configuration
      allowEIO3: true,
      allowEIO4: true,
      serveClient: false,
      cookie: false,
      perMessageDeflate: false,
      httpCompression: false,
      // Allow query parameters in handshake
      allowRequest: (req, callback) => {
        // Accept all requests
        callback(null, true);
      }
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

    // Helper function to shuffle array (for randomizing questions)
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    // Helper function to finalize answers and calculate scores
    function finalizeAnswers(sessionId, gameSession) {
      if (!gameSession || !gameSession.currentQuestion) return;
      
      const correctIndex = gameSession.currentQuestion.correct_index;
      let firstCorrect = null;
      
      // Calculate scores and update player stats
      gameSession.playerAnswers.forEach((answer, playerId) => {
        const player = gameSession.players.get(playerId);
        if (!player) return;
        
        const isCorrect = answer.optionIndex === correctIndex;
        const timeBonus = Math.floor((1 - answer.timePercentage) * 50); // Up to 50 points for speed
        
        if (isCorrect) {
          // Base points for correct answer
          const basePoints = 100;
          
          // Streak bonus (10% per correct answer in streak, up to 50%)
          const streakMultiplier = player.streak ? Math.min(1.5, 1 + (player.streak * 0.1)) : 1;
          
          // Calculate total score for this question
          const questionScore = Math.floor((basePoints + timeBonus) * streakMultiplier);
          
          // Update player score
          player.score += questionScore;
          player.streak = (player.streak || 0) + 1;
          player.correctAnswers = (player.correctAnswers || 0) + 1;
          
          // Track first correct answer for achievement
          if (firstCorrect === null) {
            firstCorrect = playerId;
          }
        } else {
          // Reset streak on wrong answer
          player.streak = 0;
        }
        
        // Emit individual result to player
        io.to(playerId).emit('answer:result', {
          correct: isCorrect,
          correctIndex,
          points: isCorrect ? player.score : 0,
          streak: player.streak
        });
      });
      
      // Store first correct player for achievements
      gameSession.questionFirstCorrect = firstCorrect;
      
      // Store previous leaderboard for comeback achievement checking
      gameSession.previousLeaderboard = Array.from(gameSession.players.values())
        .sort((a, b) => b.score - a.score)
        .map(player => ({
          id: player.id,
          name: player.name,
          score: player.score
        }));
      
      // Check achievements for all players who answered
      gameSession.playerAnswers.forEach((_, playerId) => {
        checkAchievements(sessionId, gameSession, playerId);
      });
      
      // Clear answers for next question
      gameSession.playerAnswers = new Map();
    }

    // Socket.IO connection handler
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
      if (!gameSessions.has(sessionId)) {
        gameSessions.set(sessionId, {
          id: sessionId,
          status: 'waiting',
          players: new Map(),
          playerAnswers: new Map(),
          questionIndex: -1,
          quiz: null,
          currentQuestion: null
        });
      }
      
      const gameSession = gameSessions.get(sessionId);
      
      // Handle different roles
      if (role === 'host') {
        // Add to host room
        socket.join(`host:${sessionId}`);
        
        // Send current game state if available
        if (gameSession.persistentState) {
          socket.emit('game:restore', gameSession.persistentState);
        }
        
        // Host events
        socket.on('game:start', (quizData) => {
          if (!quizData || !quizData.questions || quizData.questions.length === 0) {
            socket.emit('error', { message: 'Invalid quiz data' });
            return;
          }
          
          gameSession.quiz = quizData;
          gameSession.status = 'active';
          gameSession.questionIndex = -1; // Will be incremented on first question
          
          // Randomize questions if option is set
          if (quizData.randomize_questions) {
            gameSession.quiz.questions = shuffleArray([...gameSession.quiz.questions]);
          }
          
          // Notify all players that game has started
          io.to(`players:${sessionId}`).emit('game:start');
          
          console.log(`Game started for session ${sessionId} with ${gameSession.quiz.questions.length} questions`);
        });
        
        socket.on('question:next', () => {
          if (gameSession.status !== 'active' || !gameSession.quiz) {
            socket.emit('error', { message: 'Game is not active' });
            return;
          }
          
          // Finalize previous question if there was one
          if (gameSession.questionIndex >= 0) {
            finalizeAnswers(sessionId, gameSession);
          }
          
          // Move to next question
          gameSession.questionIndex++;
          
          // Check if we've reached the end of the quiz
          if (gameSession.questionIndex >= gameSession.quiz.questions.length) {
            gameSession.status = 'completed';
            io.to(`host:${sessionId}`).emit('game:end');
            io.to(`players:${sessionId}`).emit('game:end');
            
            // Show final leaderboard
            showLeaderboardToAll(sessionId, gameSession);
            return;
          }
          
          // Get current question
          const currentQuestion = gameSession.quiz.questions[gameSession.questionIndex];
          gameSession.currentQuestion = currentQuestion;
          
          // Send question to host and players (without correct answer for players)
          const hostQuestion = { ...currentQuestion };
          const playerQuestion = { 
            ...currentQuestion,
            correct_index: undefined // Don't send correct answer to players
          };
          
          io.to(`host:${sessionId}`).emit('question:start', {
            question: hostQuestion,
            questionNumber: gameSession.questionIndex + 1,
            totalQuestions: gameSession.quiz.questions.length,
            timeLimit: currentQuestion.time_limit || 30
          });
          
          io.to(`players:${sessionId}`).emit('question:start', {
            question: playerQuestion,
            questionNumber: gameSession.questionIndex + 1,
            totalQuestions: gameSession.quiz.questions.length,
            timeLimit: currentQuestion.time_limit || 30
          });
          
          // Store game state for reconnections
          storeGameState(gameSession);
          
          console.log(`Question ${gameSession.questionIndex + 1} started for session ${sessionId}`);
        });
        
        socket.on('leaderboard:show', () => {
          showLeaderboardToAll(sessionId, gameSession);
        });
        
        socket.on('game:end', () => {
          gameSession.status = 'completed';
          io.to(`host:${sessionId}`).emit('game:end');
          io.to(`players:${sessionId}`).emit('game:end');
          
          // Show final leaderboard
          showLeaderboardToAll(sessionId, gameSession);
          
          console.log(`Game ended for session ${sessionId}`);
        });
      } else if (role === 'player') {
        // Generate a unique ID for this player
        const playerId = socket.id;
        
        // Add player to session
        if (!gameSession.players.has(playerId)) {
          gameSession.players.set(playerId, {
            id: playerId,
            name: name || `Player ${gameSession.players.size + 1}`,
            score: 0,
            streak: 0,
            correctAnswers: 0
          });
        }
        
        // Add to players room
        socket.join(`players:${sessionId}`);
        socket.join(playerId); // Individual room for player-specific messages
        
        // Notify host of new player
        io.to(`host:${sessionId}`).emit('player:join', {
          id: playerId,
          name: gameSession.players.get(playerId).name
        });
        
        // Player events
        socket.on('answer:submit', (data) => {
          if (gameSession.status !== 'active' || gameSession.questionIndex < 0) {
            socket.emit('error', { message: 'No active question' });
            return;
          }
          
          const { optionIndex, timePercentage } = data;
          const hasChangedAnswer = gameSession.playerAnswers.has(playerId);
          
          // Store player answer
          gameSession.playerAnswers.set(playerId, {
            playerId,
            optionIndex,
            timePercentage: timePercentage || 1.0,
            timestamp: Date.now()
          });
          
          // Notify host of player answer
          io.to(`host:${sessionId}`).emit('player:answer', {
            playerId,
            playerName: gameSession.players.get(playerId).name,
            answer: optionIndex,
            hasChangedAnswer
          });
          
          console.log(`Player ${playerId} answered question ${gameSession.questionIndex + 1} with option ${optionIndex}`);
        });
        
        // Handle disconnect
        socket.on('disconnect', () => {
          // Notify host of player leaving
          io.to(`host:${sessionId}`).emit('player:leave', playerId);
          
          console.log(`Player ${playerId} disconnected from session ${sessionId}`);
          
          // We don't remove the player from the session to preserve their score
          // gameSession.players.delete(playerId);
        });
      }
      
      // Common events for both host and player
      socket.on('disconnect', () => {
        console.log(`${role} disconnected from session ${sessionId}`);
        
        // Clean up empty sessions after some time
        if (role === 'host') {
          setTimeout(() => {
            const session = gameSessions.get(sessionId);
            if (session && io.sockets.adapter.rooms.get(`host:${sessionId}`)?.size === 0) {
              console.log(`Cleaning up inactive session ${sessionId}`);
              gameSessions.delete(sessionId);
            }
          }, 3600000); // 1 hour
        }
      });
    });

    // Store the io instance on the server object
    res.socket.server.io = io;
  }

  // Immediate success response required for Vercel serverless functions
  res.status(200).end();
  
  // Log connection details
  console.log(`Socket.IO handler completed for request ID: ${req.headers['x-vercel-id'] || 'unknown'}`);
};

export default ioHandler;

// Configure API route for serverless Socket.IO
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true, // Tell Next.js this is handled by Socket.IO
  },
};