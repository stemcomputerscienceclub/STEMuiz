import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabaseClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSpinner, 
  faUsers, 
  faPlay, 
  faForwardStep,
  faStop
} from '@fortawesome/free-solid-svg-icons';
import { createSocketConnection } from '../../lib/socket';

export default function HostGame() {
  const router = useRouter();
  const { id: sessionId } = router.query;
  const [gameSession, setGameSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('waiting'); // waiting, active, completed
  const [leaderboard, setLeaderboard] = useState([]);
  const [previousLeaderboard, setPreviousLeaderboard] = useState([]);
  const [showingLeaderboard, setShowingLeaderboard] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(true);
  const [playerAnswers, setPlayerAnswers] = useState({});
  const [changedAnswers, setChangedAnswers] = useState({});
  
  const {
    players,
    addPlayer,
    removePlayer,
    updateLeaderboard,
    resetGame,
    leaderboard: storeLeaderboard
  } = useStore();

  // Check authentication
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.user) {
          router.replace('/auth/signin');
          return;
        }
        setUser(session.user);
      } catch (error) {
        console.error('Auth error:', error);
        setError('Authentication failed. Please sign in again.');
        router.replace('/auth/signin');
      }
    };
    checkUser();
  }, [router]);

  // Load game session
  useEffect(() => {
    if (!sessionId || !user) return;

    const loadGameSession = async () => {
      try {
        const data = await db.getGameSession(sessionId);
        if (!data) throw new Error('Game session not found');
        if (data.host_id !== user.id) throw new Error('You are not the host of this game');
        if (!data.quiz) throw new Error('Quiz not found');
        if (!data.quiz.questions?.length) throw new Error('This quiz has no questions');
        
        setGameSession(data);
        setError('');
      } catch (err) {
        console.error('Failed to load game session:', err);
        setError(err.message || 'Failed to load game session');
      } finally {
        setIsLoading(false);
      }
    };

    loadGameSession();
  }, [sessionId, user]);

  // Socket connection
  useEffect(() => {
    if (!sessionId || !user) return;

    try {
      const newSocket = createSocketConnection(
        sessionId,
        'host',
        null,
        console.log
      );

      newSocket.on('connect', () => {
        setError('');
      });

      newSocket.on('player:join', (player) => {
        console.log('Player joined:', player);
        addPlayer(player);
      });

      newSocket.on('player:leave', (playerId) => {
        console.log('Player left:', playerId);
        removePlayer(playerId);
      });

      newSocket.on('leaderboard:update', (data) => {
        if (!data || !Array.isArray(data.leaderboard)) {
          console.error('Invalid leaderboard data received', 'error');
          return;
        }

        console.log(`Leaderboard updated: ${data.leaderboard.length} players`);
        setLeaderboard(data.leaderboard || []);
        setPreviousLeaderboard(data.previousLeaderboard || []);
      });

      newSocket.on('leaderboard:show', (data) => {
        console.log('Leaderboard show event:', data);
        setLeaderboard(data.leaderboard || []);
        setPreviousLeaderboard(data.previousLeaderboard || []);
        setCorrectAnswerIndex(data.correctAnswerIndex);
        setShowLeaderboard(true);
      });

      newSocket.on('question:start', (data) => {
        console.log('Question start event:', data);
        setCurrentQuestion(data.question);
        startTimer(data.timeLimit || 30);
        setShowLeaderboard(false);
        setPlayerAnswers({});
        setChangedAnswers({});
      });

      setSocket(newSocket);

      return () => {
        try {
          if (newSocket) {
            // Remove event listeners before disconnecting
            newSocket.off('leaderboard:show');
            newSocket.off('question:start');
            newSocket.disconnect();
          }
        } catch (err) {
          console.error('Error disconnecting socket:', err);
        }
      };
    } catch (err) {
      console.error('Error creating socket connection:', err);
      setError('Failed to connect to game server');
    }
  }, [sessionId, user, addPlayer, removePlayer]);

  // Update the player:answer handler to track changed answers
  useEffect(() => {
    if (!socket) return;

    // Add event listener for player answers
    socket.on('player:answer', (data) => {
      console.log('Player answer received:', data);
      setPlayerAnswers(prev => ({
        ...prev,
        [data.playerId]: data.answer
      }));
      
      // Track which players have changed their answers
      if (data.hasChangedAnswer) {
        setChangedAnswers(prev => ({
          ...prev,
          [data.playerId]: true
        }));
      }
    });

    return () => {
      if (socket) {
        socket.off('player:answer');
      }
    };
  }, [socket]);

  // Add handler for game state restoration
  useEffect(() => {
    if (!socket) return;

    // Handle game state restoration when reconnecting
    socket.on('game:restore', (data) => {
      console.log('Restoring game state:', data);
      
      if (data.status === 'active') {
        setGameState('active');
        
        if (data.questionIndex >= 0) {
          setCurrentQuestionIndex(data.questionIndex);
          setCurrentQuestion(data.currentQuestion);
        }
        
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      }
    });

    return () => {
      if (socket) {
        socket.off('game:restore');
      }
    };
  }, [socket]);

  const startGame = async () => {
    try {
      if (players.length === 0) {
        setError('Cannot start game without players');
        return;
      }

      if (!gameSession?.quiz?.questions?.length) {
        setError('No questions found in the quiz');
        return;
      }

      await db.updateGameSessionStatus({ sessionId, status: 'active' });
      setGameState('active');
      socket.emit('game:start', gameSession.quiz);
      setCurrentQuestionIndex(0);
      socket.emit('question:start', { index: 0 });
    } catch (err) {
      console.error('Failed to start game:', err);
      setError(err.message || 'Failed to start game');
    }
  };

  const nextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= gameSession.quiz.questions.length) {
      endGame();
      return;
    }

    setCurrentQuestionIndex(nextIndex);
    setShowingLeaderboard(false);
    socket.emit('question:start', { index: nextIndex });
  };

  const skipQuestion = () => {
    socket.emit('question:skip');
    setShowingLeaderboard(true);
  };

  const endGame = async () => {
    try {
      await db.updateGameSessionStatus({ sessionId, status: 'completed' });
      socket.emit('game:end');
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to end game:', err);
      setError('Failed to end game');
    }
  };

  // Update the timer to emit question:end when time expires
  const startTimer = (duration) => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          
          // When timer ends, emit question:end to finalize answers
          socket.emit('question:end');
          
          // Show the leaderboard
          setShowLeaderboard(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimerInterval(interval);
  };

  // Update the skip button handler to handle different states
  const handleSkip = () => {
    if (showLeaderboard) {
      // If we're showing the leaderboard, move to next question or end game
      const isLastQuestion = currentQuestionIndex === gameSession.quiz.questions.length - 1;
      
      if (isLastQuestion) {
        handleEndGame();
      } else {
        handleNextQuestion();
      }
    } else {
      // Otherwise, skip current question
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setTimeLeft(0);
      socket.emit('question:skip');
      setShowLeaderboard(true);
    }
  };

  // Update start question function to reset the UI state
  const startQuestion = (index) => {
    if (!gameSession?.quiz?.questions || !gameSession.quiz.questions[index]) {
      console.error('Invalid question index', index);
      return;
    }

    setCurrentQuestionIndex(index);
    setShowLeaderboard(false);
    setPlayerAnswers({});
    
    // Reset timer to 0 until server confirms question start
    setTimeLeft(0);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    socket.emit('question:start', { index });
  };

  // Fix handleNextQuestion function
  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < gameSession.quiz.questions.length) {
      // First emit next:question to prepare players
      socket.emit('next:question');
      
      // Brief delay before starting the next question
      setTimeout(() => {
        startQuestion(nextIndex);
      }, 500);
    } else {
      // End of quiz
      handleEndGame();
    }
  };

  // Update the handleEndGame function to delete the session from the database
  const handleEndGame = async () => {
    try {
      // Emit game:end event to server
      socket.emit('game:end');
      
      // Update the session status in the database
      await db.updateGameSessionStatus({ sessionId, status: 'completed' });
      
      // Delete the session from the database
      await db.deleteGameSession(sessionId);
      
      console.log('Game ended and session deleted');
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to end game:', err);
      setError('Failed to end game: ' + err.message);
    }
  };

  // Toggle showing correct answers
  const toggleCorrectAnswer = () => {
    setShowCorrectAnswer(prev => !prev);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400 max-w-md text-center">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {gameState === 'waiting' ? (
        <div className="space-y-8">
          {/* Game PIN Display */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-xl text-center">
            <h2 className="text-2xl font-semibold mb-4">Game PIN</h2>
            <div className="text-6xl font-bold tracking-wider bg-white/5 py-8 rounded-lg mb-4 font-mono">
              {gameSession?.pin}
            </div>
          </div>

          {/* Players List */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faUsers} className="text-xl" />
                <h2 className="text-2xl font-bold">Players ({players.length})</h2>
              </div>
              
              <button
                onClick={startGame}
                disabled={players.length === 0}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-lg font-bold rounded-xl transition-all"
              >
                <FontAwesomeIcon icon={faPlay} className="mr-2 text-base" />
                Start Game
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {players.map(player => (
                <div
                  key={player.id}
                  className="bg-white/5 rounded-lg p-4 text-center"
                >
                  <span className="text-lg">{player.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Question */}
          <div className="bg-gray-900 p-6 rounded-xl shadow-lg mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                Question {currentQuestionIndex + 1} of {gameSession.quiz.questions.length}
              </h2>
              <div className="flex gap-4 items-center">
                <div className="px-4 py-2 bg-blue-500 rounded-lg">
                  {timeLeft}s
                </div>
                <button
                  onClick={toggleCorrectAnswer}
                  className={`px-4 py-2 ${showCorrectAnswer ? 'bg-green-600' : 'bg-gray-600'} rounded-lg text-sm`}
                  title={showCorrectAnswer ? "Hide correct answer" : "Show correct answer"}
                >
                  {showCorrectAnswer ? "Hide Answer" : "Show Answer"}
                </button>
                {!showLeaderboard ? (
                  <button
                    onClick={handleSkip}
                    className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
                  >
                    Skip
                  </button>
                ) : (
                  <button
                    onClick={handleSkip}
                    className={`px-6 py-2 ${
                      currentQuestionIndex === gameSession.quiz.questions.length - 1 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white rounded-lg text-sm`}
                  >
                    {currentQuestionIndex === gameSession.quiz.questions.length - 1 ? 'End Game' : 'Next'}
                  </button>
                )}
              </div>
            </div>
            
            {!showLeaderboard ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <p className="text-xl">{currentQuestion?.question || gameSession.quiz.questions[currentQuestionIndex]?.question}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(currentQuestion?.options || gameSession.quiz.questions[currentQuestionIndex]?.options || []).map((option, idx) => {
                    // Count how many players selected this option
                    const playersWithThisAnswer = Object.entries(playerAnswers)
                      .filter(([_, answer]) => answer === idx)
                      .map(([playerId]) => {
                        const player = players.find(p => p.id === playerId);
                        return {
                          id: playerId,
                          name: player?.name || 'Unknown',
                          hasChanged: changedAnswers[playerId]
                        };
                      });
                    
                    const playerCount = playersWithThisAnswer.length;
                    
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg ${
                          showCorrectAnswer && currentQuestion?.correct_index === idx 
                            ? 'bg-green-600' 
                            : 'bg-gray-700'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{option}</span>
                          {playerCount > 0 && (
                            <div className="flex items-center gap-2 mb-4">
                              <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                                {playerCount}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Show player names who selected this option */}
                        {playerCount > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {playersWithThisAnswer.map(player => (
                              <span 
                                key={player.id}
                                className={`text-xs px-2 py-1 rounded ${
                                  player.hasChanged ? 'bg-yellow-500/30 border border-yellow-500' : 'bg-blue-500/30'
                                }`}
                                title={player.hasChanged ? `${player.name} changed their answer` : player.name}
                              >
                                {player.name}
                                {player.hasChanged && ' *'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-sm text-gray-400">
                  Players selected answers: {Object.keys(playerAnswers).length}/{players.length}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold mb-4">Leaderboard</h3>
                {leaderboard.map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex justify-between items-center p-3 mb-2 rounded-lg bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{idx + 1}.</span>
                      <span>{player.name}</span>
                      {player.streak >= 3 && (
                        <span className="ml-2 text-yellow-400" title={`${player.streak} streak`}>
                          {player.streak >= 5 ? '🔥' : '🔥'} {player.streak}
                        </span>
                      )}
                      {player.achievements && player.achievements.length > 0 && (
                        <div className="ml-2 flex gap-1">
                          {player.achievements.map((achievement, i) => (
                            <span 
                              key={i}
                              title={achievement.name + ': ' + achievement.description}
                              className="cursor-help"
                            >
                              {achievement.icon}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-blue-400">{player.correctAnswers || 0} correct</span>
                      <span className="font-bold">{player.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}