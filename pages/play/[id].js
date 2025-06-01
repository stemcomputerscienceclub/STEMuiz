import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useStore } from '../../lib/store';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSpinner, 
  faExclamationTriangle,
  faWifi,
  faWifiSlash,
  faTrophy,
  faCircleCheck,
  faCircleXmark
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../../contexts/ToastContext';
import CountdownAnimation from '../../components/CountdownAnimation';
import AnswerStreak from '../../components/AnswerStreak';
import PowerUps from '../../components/PowerUps';
import QuestionPreview from '../../components/QuestionPreview';
import LeaderboardChart from '../../components/LeaderboardChart';
import { createSocketConnection } from '../../lib/socket';

export default function PlayGame() {
  const router = useRouter();
  const { id: sessionId } = router.query;
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('connecting'); // connecting, waiting, active, completed, kicked
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerFinal, setAnswerFinal] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [kickMessage, setKickMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const [playerData, setPlayerData] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [endGameTimeout, setEndGameTimeout] = useState(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);
  const [answerStreak, setAnswerStreak] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [activePowerUps, setActivePowerUps] = useState(new Set());
  const [showCountdown, setShowCountdown] = useState(false);
  const [previousLeaderboard, setPreviousLeaderboard] = useState([]);
  const [timerInterval, setTimerInterval] = useState(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null);
  const [hasChangedAnswer, setHasChangedAnswer] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [showAchievement, setShowAchievement] = useState(null);

  const { leaderboard, updateLeaderboard } = useStore();
  const { addToast } = useToast();

  // Debug function
  const debugLog = (message, type = 'info') => {
    console.log(`[PlayGame] ${message}`);
    // Only show critical errors in toast
    if (type === 'error' && message.includes('Failed to connect')) {
      addToast(message, type);
    }
  };

  // Add a simplified join function
  const joinGame = () => {
    try {
      const playerName = localStorage.getItem('playerName');
      const currentSessionId = sessionId || localStorage.getItem('currentGameSession');
      
      if (!playerName || !currentSessionId) {
        throw new Error('Missing player name or session ID');
      }
      
      // Store current session
      localStorage.setItem('currentGameSession', currentSessionId);
      
      // Set player data
      setPlayerData({
        name: playerName,
        sessionId: currentSessionId
      });
      
      setIsConnecting(true);
      setError('');
      
      return true;
    } catch (err) {
      debugLog(`Join game error: ${err.message}`, 'error');
      setError('Failed to join game. Please try again.');
      return false;
    }
  };

  // Update the initialization effect
  useEffect(() => {
    if (!router.isReady) {
      debugLog('Router not ready yet');
      return;
    }

    // Try to join the game
    if (!joinGame()) {
      debugLog('Failed to join game, redirecting to home');
      router.replace('/');
    }

    // Don't clear data on unmount to preserve the session during navigation
  }, [router.isReady, sessionId, router]);

  // Add a separate effect for final cleanup
  useEffect(() => {
    return () => {
      // Only clear data when the game has actually ended
      if (gameEnded || error) {
        debugLog('Game ended or error occurred, cleaning up session data');
        localStorage.removeItem('currentGameSession');
        localStorage.removeItem('playerName');
      }
    };
  }, [gameEnded, error]);

  // Update the socket connection effect to prevent disconnection during navigation
  useEffect(() => {
    if (!playerData?.sessionId || !playerData?.name) {
      debugLog('No player data available yet');
      return;
    }

    let newSocket = null;
    
    try {
      debugLog(`Creating socket connection for ${playerData.name}`);
      newSocket = createSocketConnection(
        playerData.sessionId,
        'player',
        playerData.name,
        debugLog
      );
      
      // Set up event handlers
      newSocket.on('connect', () => {
        debugLog('Socket connected successfully', 'success');
        setGameState('waiting');
        setIsConnecting(false);
        setIsConnected(true);
        setError('');
      });
      
      newSocket.on('connect_error', (err) => {
        debugLog(`Connection error: ${err.message}`, 'error');
        setError('Failed to connect to game server. Please try again.');
        setIsConnecting(false);
        setIsConnected(false);
      });

      newSocket.on('disconnect', (reason) => {
        debugLog(`Socket disconnected: ${reason}`, 'error');
        setIsConnected(false);
      });

      newSocket.on('reconnect', () => {
        debugLog('Reconnected to server', 'success');
        setIsConnected(true);
      });

      newSocket.on('game:start', () => {
        debugLog('Game started, showing countdown');
        setGameState('active');
        setShowCountdown(true);
        setWaitingForNextQuestion(false);
        setCurrentQuestion(null);
        setShowAnswers(false);
        setSelectedAnswer(null);
        setAnswerSubmitted(false);
        setAnswerFinal(false);
        setFeedback(null);
        setShowPreview(false);
        setTimeLeft(0);
      });

      newSocket.on('question:start', (data) => {
        debugLog('Received question:start event');
        setShowLeaderboard(false);
        setWaitingForNextQuestion(false);
        setAnswerFinal(false);
        setSelectedAnswer(null);
        setAnswerSubmitted(false);
        setStartTime(Date.now());
        setHasChangedAnswer(false);
        handleQuestionStart(data);
      });

      newSocket.on('question:end', () => {
        debugLog('Question ended');
        setShowLeaderboard(true);
        setWaitingForNextQuestion(true);
        
        // Clear timer
        if (timerInterval) {
          clearInterval(timerInterval);
          setTimerInterval(null);
        }
        
        if (timeLeft > 0) {
          setTimeLeft(0);
        }
      });

      newSocket.on('answer:result', (data) => {
        debugLog('Received answer result:', data);
        
        // Finalize the answer
        setAnswerFinal(true);
        
        // Set correct answer index
        setCorrectAnswerIndex(data.correctAnswer);
        
        // Store feedback
        setFeedback({
          correct: data.isCorrect,
          points: data.points,
          totalScore: data.totalScore,
          streak: data.streak,
          timeout: data.timeout,
          hasChangedAnswer: data.hasChangedAnswer
        });

        // Update earned points
        setEarnedPoints(data.points);
        
        // Set showAnswers to true to display correct/wrong answer
        setShowAnswers(true);
      });

      newSocket.on('leaderboard:update', (data) => {
        if (!data || !data.leaderboard) {
          debugLog('Invalid leaderboard data received', 'error');
          return;
        }

        debugLog(`Leaderboard updated: ${data.leaderboard.length} players`);
        updateLeaderboard(data.leaderboard);
        setPreviousLeaderboard(data.previousLeaderboard || []);
      });

      newSocket.on('leaderboard:show', (data) => {
        debugLog('Leaderboard show event received');
        
        // Stop timer immediately
        if (timerInterval) {
          clearInterval(timerInterval);
          setTimerInterval(null);
        }
        
        // Set timeLeft to 0 to indicate question is over
        setTimeLeft(0);
        
        // Show leaderboard and set waiting state
        setShowLeaderboard(true);
        setWaitingForNextQuestion(true);
        
        // Update leaderboard data
        if (data && data.leaderboard) {
          updateLeaderboard(data.leaderboard);
          setPreviousLeaderboard(data.previousLeaderboard || []);
          
          // Store correct answer index
          if (data.correctAnswerIndex !== undefined) {
            setCorrectAnswerIndex(data.correctAnswerIndex);
          }
        }
        
        // If answer wasn't submitted, handle it as a timeout
        if (!answerSubmitted && currentQuestion) {
          handleAnswer(null);
        }
        
        debugLog('Leaderboard is now visible, waiting for host');
      });

      // Add handler for next:question event
      newSocket.on('next:question', () => {
        debugLog('Host is moving to next question, preparing...');
        // Keep the player in the game but show loading state
        setWaitingForNextQuestion(true);
        
        // Ensure socket is still connected
        if (!newSocket.connected) {
          debugLog('Socket disconnected during transition, attempting to reconnect...');
          newSocket.connect();
        }
        
        // Show a loading screen
        setShowLeaderboard(false);
        setGameState('active');
      });

      newSocket.on('game:end', (data = {}) => {
        debugLog('Game ended');
        setGameState('completed');
        setGameEnded(true);
        
        if (data.cleanup) {
          localStorage.removeItem('currentGameSession');
          localStorage.removeItem('playerName');
        }
        
        // Show final leaderboard for 5 minutes before redirecting
        const timeout = setTimeout(() => {
          router.replace('/');
        }, 300000); // 5 minutes
        
        setEndGameTimeout(timeout);
      });

      newSocket.on('session:end', ({ cleanup }) => {
        debugLog('Session ended by host');
        // Clear any existing timeouts
        if (endGameTimeout) {
          clearTimeout(endGameTimeout);
        }
        
        if (cleanup) {
          localStorage.removeItem('currentGameSession');
          localStorage.removeItem('playerName');
        }
        
        // Show a message briefly before redirecting
        addToast('The host has ended the session', 'info');
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      });

      newSocket.on('session:cleanup', () => {
        debugLog('Cleaning up session data');
        localStorage.removeItem('currentGameSession');
        localStorage.removeItem('playerName');
      });

      newSocket.on('player:kicked', () => {
        const msg = 'You have been kicked from the game';
        debugLog(msg, 'error');
        setGameState('kicked');
        setKickMessage(msg);
        localStorage.removeItem('currentGameSession');
        setTimeout(() => {
          debugLog('Redirecting to home after being kicked');
          router.replace('/');
        }, 2000);
      });

      newSocket.on('error', ({ message }) => {
        debugLog(`Game error: ${message}`, 'error');
        setError(message || 'An error occurred');
        setIsConnecting(false);
        if (message.includes('not found') || message.includes('invalid')) {
          localStorage.removeItem('currentGameSession');
        }
      });

      newSocket.on('question:skip', () => {
        debugLog('Question skipped by host');
        
        // Clear timer immediately
        if (timerInterval) {
          clearInterval(timerInterval);
          setTimerInterval(null);
        }
        
        setTimeLeft(0);
        
        // Finalize the answer
        setAnswerFinal(true);
        
        // Show leaderboard immediately
        setShowLeaderboard(true);
        setWaitingForNextQuestion(true);
      });

      newSocket.on('answer:visibility', ({ showAnswers: show, correctIndex }) => {
        debugLog(`Answer visibility changed: ${show}`);
        setShowAnswers(show);
        if (show && answerSubmitted) {
          const isCorrect = selectedAnswer === correctIndex;
          setFeedback({
            correct: isCorrect,
            message: isCorrect ? 'Correct!' : 'Wrong answer!'
          });
          
          if (isCorrect) {
            setAnswerStreak(prev => prev + 1);
          } else {
            setAnswerStreak(0);
          }
        }
      });

      newSocket.on('achievement:earned', (achievement) => {
        console.log('Achievement earned:', achievement);
        
        // Add to achievements list
        setAchievements(prev => [...prev, achievement]);
        
        // Show achievement notification
        setShowAchievement(achievement);
        
        // Clear notification after 5 seconds
        setTimeout(() => {
          setShowAchievement(null);
        }, 5000);
      });

      setSocket(newSocket);
    } catch (err) {
      debugLog(`Error creating socket: ${err.message}`, 'error');
      setError(`Failed to create socket connection: ${err.message}`);
      setIsConnecting(false);
    }
    
    // Updated cleanup function - don't disconnect socket on page navigation
    return () => {
      if (endGameTimeout) clearTimeout(endGameTimeout);
      
      // Only disconnect the socket if the game has actually ended
      // This prevents disconnection during normal navigation
      if (gameEnded || error) {
        debugLog('Cleaning up socket connection due to game end or error');
        if (newSocket) {
          try {
            newSocket.disconnect();
          } catch (err) {
            debugLog(`Error disconnecting socket: ${err.message}`, 'error');
          }
        }
      } else {
        debugLog('Preserving socket connection during navigation');
      }
    };
  }, [playerData, gameEnded, error, endGameTimeout]);

  // Cleanup timer on unmount or when game state changes
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  const startTimer = (duration) => {
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          
          // Finalize the answer when time runs out
          setAnswerFinal(true);
          
          // If no answer was submitted, handle as null
          if (!answerSubmitted) {
            handleAnswer(null);
          }
          
          // Show leaderboard when time ends
          setShowLeaderboard(true);
          setWaitingForNextQuestion(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimerInterval(interval);
  };

  const handlePowerUp = (powerUp) => {
    setActivePowerUps(prev => new Set([...prev, powerUp.id]));
    
    switch (powerUp.id) {
      case 'time':
        // Add time to the current timer
        setTimeLeft(prev => {
          const newTime = prev + 5;
          // Update the interval to use the new time
          if (timerInterval) {
            clearInterval(timerInterval);
            const newInterval = setInterval(() => {
              setTimeLeft(current => {
                if (current <= 1) {
                  clearInterval(newInterval);
                  if (!answerSubmitted) {
                    handleAnswer(null);
                  }
                  return 0;
                }
                return current - 1;
              });
            }, 1000);
            setTimerInterval(newInterval);
          }
          return newTime;
        });
        break;
      // Other power-ups are handled in answer submission
    }
  };

  const handleAnswer = (answerIndex) => {
    if (answerFinal || !currentQuestion) return;

    // Check if this is a change from a previous answer
    if (answerSubmitted && selectedAnswer !== answerIndex) {
      setHasChangedAnswer(true);
      
      // Show a brief toast notification
      addToast('Answer changed! Time keeps counting from the beginning.', 'info');
    }

    // Update the selected answer
    setSelectedAnswer(answerIndex);
    
    // Don't reset the start time when changing answers
    // This ensures the time spent is calculated from when the question was first shown
    // setStartTime(Date.now());
    
    // Mark that an answer has been selected, but not finalized
    setAnswerSubmitted(true);
    
    // Send the answer to the server
    const timeSpent = (Date.now() - startTime) / 1000;
    
    socket.emit('answer:submit', {
      answer: answerIndex,
      timeSpent
    });
  };

  const handleQuestionStart = (data) => {
    debugLog('Handling question start with data:', 'info');
    debugLog(JSON.stringify(data, null, 2), 'info');

    if (!data || !data.question) {
      debugLog('Invalid question data received - missing question object', 'error');
      return;
    }

    const { question, timeLimit } = data;
    
    debugLog(`New question received: ${question.question}`);
    debugLog(`Question details: ${JSON.stringify({
      hasQuestion: !!question,
      timeLimit,
      options: question.options?.length
    })}`);

    // Ensure we have a valid question
    if (!question || !question.options || !timeLimit) {
      debugLog('Invalid question data received - missing required fields', 'error');
      return;
    }

    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    setShowCountdown(false);
    setWaitingForNextQuestion(false);
    setShowPreview(true);
    setCurrentQuestion({
      ...question
    });
    setTimeLeft(timeLimit);
    setSelectedAnswer(null);
    setAnswerSubmitted(false);
    setAnswerFinal(false);
    setFeedback(null);
    setStartTime(Date.now());
    setShowAnswers(false);
    setActivePowerUps(new Set());
    setError('');

    // Start the timer after preview animation
    setTimeout(() => {
      debugLog('Question preview complete, starting timer');
      setShowPreview(false);
      startTimer(timeLimit);
    }, 2500);
  };

  // Helper function to get answer button styles
  const getAnswerButtonStyle = (index) => {
    const baseStyle = "w-full p-8 rounded-xl text-2xl font-bold transition-all duration-300 transform hover:scale-105 ";
    
    // Adjust colors based on question type (true/false or multiple choice)
    const colors = currentQuestion?.questionType === 'true_false' 
      ? ["bg-green-500 hover:bg-green-600", "bg-red-500 hover:bg-red-600"]
      : [
        "bg-red-500 hover:bg-red-600",
        "bg-blue-500 hover:bg-blue-600", 
        "bg-yellow-500 hover:bg-yellow-600",
        "bg-green-500 hover:bg-green-600"
      ];

    if (answerFinal) {
      // Only show correct/incorrect when the answer is finalized
      if (showAnswers) {
        if (index === correctAnswerIndex) {
          return baseStyle + "bg-green-500 border-4 border-white";
        } else if (index === selectedAnswer) {
          return baseStyle + "bg-red-500 border-4 border-white opacity-50";
        }
        return baseStyle + colors[index % colors.length] + " opacity-50";
      }
      return baseStyle + colors[index % colors.length] + (index === selectedAnswer ? " border-4 border-white" : " opacity-50");
    } else {
      // During active question, highlight the selected answer
      // Add a different border style if the answer has been changed
      return baseStyle + colors[index % colors.length] + (index === selectedAnswer 
        ? (hasChangedAnswer ? " border-4 border-yellow-300 border-dashed" : " border-4 border-white") 
        : "");
    }
  };

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <FontAwesomeIcon icon={faSpinner} spin className="text-6xl text-indigo-500 mb-4" />
        <p className="text-xl">Connecting to game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-xl text-center max-w-md">
          <FontAwesomeIcon 
            icon={faExclamationTriangle} 
            className="text-6xl text-red-500 mb-4" 
          />
          <h2 className="text-2xl font-bold text-red-500 mb-4">
            {error}
          </h2>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="animate-bounce mb-8">
          <FontAwesomeIcon icon={faSpinner} className="text-6xl text-indigo-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4">
          You're in!
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Waiting for the host to start the game...
        </p>
        {playerData?.name && (
          <div className="mt-8 text-2xl font-bold text-indigo-500">
            Playing as: {playerData.name}
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'completed') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <FontAwesomeIcon icon={faTrophy} className="text-6xl text-yellow-500 mb-4" />
            <h2 className="text-3xl font-bold">Game Over!</h2>
          </div>
          
          <div className="space-y-6">
            {leaderboard.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-6 rounded-xl ${
                  index === 0 ? 'bg-yellow-500/20 border-2 border-yellow-500' :
                  index === 1 ? 'bg-gray-400/20 border-2 border-gray-400' :
                  index === 2 ? 'bg-orange-500/20 border-2 border-orange-500' :
                  'bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold">{index + 1}</span>
                  <span className="text-2xl">{player.name}</span>
                </div>
                <span className="text-2xl font-bold">{player.score}</span>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => router.push('/')}
            className="w-full mt-8 px-6 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xl font-bold transition-colors"
          >
            Play Another Game
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'kicked') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg text-center max-w-md">
          <FontAwesomeIcon 
            icon={faExclamationTriangle} 
            className="text-4xl text-red-600 dark:text-red-400 mb-4" 
          />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            {kickMessage}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Redirecting to home page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Connection Status */}
      <div className={`fixed top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full ${
        isConnected ? 'bg-green-500/20' : 'bg-red-500/20'
      }`}>
        <FontAwesomeIcon icon={isConnected ? faWifi : faWifiSlash} />
        <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
      </div>

      {showCountdown && (
        <CountdownAnimation />
      )}
      
      {showPreview && currentQuestion && (
        <QuestionPreview 
          question={currentQuestion}
        />
      )}

      <AnswerStreak streak={answerStreak} />
      
      {gameState === 'active' && !showPreview && (
        <PowerUps 
          onUsePowerUp={handlePowerUp}
          streak={answerStreak}
        />
      )}

      {currentQuestion ? (
        <div className="p-4">
          {/* Timer */}
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-indigo-500">
              {timeLeft}
            </div>
          </div>

          {/* Question */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-2">{currentQuestion.question}</h2>
              </div>
              {currentQuestion.image_url && (
                <img
                  src={currentQuestion.image_url}
                  alt="Question"
                  className="max-h-64 mx-auto rounded-xl mb-4"
                />
              )}
            </div>
          </div>

          {/* Answer Grid */}
          <div className="max-w-4xl mx-auto grid grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={answerFinal}
                className={getAnswerButtonStyle(index)}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {showAnswers && feedback && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center p-8 rounded-xl max-w-4xl w-full">
                <FontAwesomeIcon 
                  icon={feedback.correct ? faCircleCheck : faCircleXmark}
                  className={`text-8xl mb-4 ${feedback.correct ? 'text-green-500' : 'text-red-500'}`}
                />
                <h3 className={`text-4xl font-bold mb-4 ${
                  feedback.correct ? 'text-green-500' : 'text-red-500'
                }`}>
                  {feedback.message}
                </h3>
                {feedback.points > 0 && (
                  <div className="text-xl font-bold text-yellow-500">
                    +{feedback.points} points
                  </div>
                )}
                {answerStreak > 1 && (
                  <div className="text-2xl font-bold text-blue-400 mt-2">
                    {answerStreak}x Streak!
                  </div>
                )}
                
                {/* Show leaderboard after feedback */}
                <div className="mt-8">
                  <LeaderboardChart 
                    leaderboard={leaderboard}
                    previousLeaderboard={previousLeaderboard}
                  />
                </div>
                
                {waitingForNextQuestion && (
                  <div className="mt-8 text-xl text-blue-400">
                    Get ready for the next question!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-bounce mb-4">
              <FontAwesomeIcon icon={faSpinner} className="text-4xl text-indigo-500" />
            </div>
            <p className="text-xl">
              Get ready for the next question!
            </p>
          </div>
        </div>
      )}

      {/* Achievement Notification */}
      {showAchievement && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black px-6 py-4 rounded-lg shadow-lg z-50 animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{showAchievement.icon}</span>
            <div>
              <div className="font-bold">{showAchievement.name}</div>
              <div className="text-sm">{showAchievement.description}</div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Overlay */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-2xl w-full">
            {feedback && answerFinal && (
              <div className="mb-6 text-center">
                <div className={`text-2xl font-bold mb-2 ${feedback.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback.timeout ? 'Time\'s up!' : feedback.correct ? 'Correct!' : 'Wrong answer!'}
                </div>
                {feedback.points > 0 && (
                  <div className="text-xl font-bold text-yellow-500">
                    +{feedback.points} points
                  </div>
                )}
                {feedback.streak > 1 && (
                  <div className="text-lg text-blue-400 mt-1">
                    {feedback.streak} correct in a row!
                  </div>
                )}
                {feedback.hasChangedAnswer && (
                  <div className="text-sm text-yellow-400 mt-1">
                    You changed your answer, so time was counted from the beginning.
                  </div>
                )}
                {currentQuestion && correctAnswerIndex !== null && answerFinal && (
                  <div className="mt-4 p-3 bg-white/10 rounded-lg">
                    <div className="text-sm text-gray-300 mb-1">Correct answer:</div>
                    <div className="font-medium">
                      {currentQuestion.options[correctAnswerIndex]}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
              <FontAwesomeIcon icon={faTrophy} className="text-yellow-500" />
              Scoreboard
            </h2>
            
            <div className="space-y-4">
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    index === 0 ? 'bg-yellow-500/20 border-2 border-yellow-500' :
                    index === 1 ? 'bg-gray-400/20 border-2 border-gray-400' :
                    index === 2 ? 'bg-orange-500/20 border-2 border-orange-500' :
                    'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">{index + 1}</span>
                    <span className="text-xl">{player.name}</span>
                    {player.achievements && player.achievements.length > 0 && (
                      <div className="flex gap-1">
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
                    <span className="text-lg text-blue-400">
                      {player.correctAnswers || 0} correct
                    </span>
                    <span className="text-xl font-bold">{player.score}</span>
                  </div>
                </div>
              ))}
            </div>

            {waitingForNextQuestion && (
              <div className="mt-8 text-center">
                <div className="animate-pulse text-xl text-blue-400">
                  Waiting for host to continue…
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 