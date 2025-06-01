import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/supabase.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faPlay, 
  faEdit, 
  faSpinner, 
  faExclamationTriangle, 
  faSignOut,
  faStop,
  faTrash,
  faEllipsisVertical
} from '@fortawesome/free-solid-svg-icons';

export default function Dashboard() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [startingGame, setStartingGame] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

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
        console.error('Auth error:', error.message);
        setError('Authentication failed. Please try signing in again.');
        router.replace('/auth/signin');
      }
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          setError(null);
          console.log('Loading data for user:', user.id);
          
          // Load quizzes first
          let userQuizzes;
          try {
            userQuizzes = await db.getQuizzesByUser(user.id);
            console.log('Loaded quizzes:', userQuizzes?.length || 0);
          } catch (quizError) {
            console.error('Error loading quizzes:', quizError);
            throw new Error('Failed to load quizzes: ' + quizError.message);
          }

          // Then load active sessions
          let activeGames;
          try {
            activeGames = await db.getActiveGameSessions(user.id);
            console.log('Loaded active sessions:', activeGames?.length || 0);
          } catch (sessionError) {
            console.error('Error loading active sessions:', sessionError);
            
            // Don't throw error for relationship issues, just set empty array
            if (sessionError.message?.includes('relationship') || 
                sessionError.message?.includes('schema cache')) {
              console.log('Using empty active sessions array due to schema issue');
              activeGames = [];
            } else {
              throw new Error('Failed to load active sessions: ' + sessionError.message);
            }
          }

          setQuizzes(userQuizzes || []);
          setActiveSessions(activeGames || []);
          setError(null);
        } catch (error) {
          console.error('Error in loadData:', error);
          
          // Check for specific error types
          if (error.message?.includes('permission denied')) {
            setError('Permission denied. Please check your access rights.');
          } else if (error.message?.includes('sign in again')) {
            console.log('Session expired, signing out...');
            await supabase.auth.signOut();
            router.replace('/auth/signin');
            return;
          } else {
            setError(error.message || 'Failed to load your data. Please try again.');
          }
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (user) {
      loadData();
    }
  }, [user, router]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/auth/signin');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    }
  };

  const handleCreateQuiz = () => {
    router.push('/quiz/create');
  };

  const handleStartGame = async (quizId) => {
    setStartingGame(quizId);
    setError(null);
    try {
      const gameSession = await db.createGameSession({
        quizId,
        hostId: user.id
      });
      router.push(`/host/${gameSession.id}`);
    } catch (error) {
      console.error('Error starting game:', error);
      if (error.message?.includes('sign in again')) {
        await supabase.auth.signOut();
        router.replace('/auth/signin');
        return;
      }
      setError('Failed to start the game. Please try again.');
      setStartingGame(null);
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      setActionInProgress(sessionId);
      await db.endGameSession(sessionId);
      
      // Update the sessions list
      const activeGames = await db.getActiveGameSessions(user.id);
      setActiveSessions(activeGames || []);
      setError(null);
    } catch (error) {
      console.error('Error ending session:', error);
      setError('Failed to end game session. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      setActionInProgress(sessionId);
      await db.deleteGameSession(sessionId);
      
      // Update the sessions list
      const activeGames = await db.getActiveGameSessions(user.id);
      setActiveSessions(activeGames || []);
      setShowConfirmDelete(null);
      setError(null);
    } catch (error) {
      console.error('Error deleting session:', error);
      setError('Failed to delete game session. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-gray-600 dark:text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading your quizzes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          {user && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Signed in as {user.email}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateQuiz}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Create New Quiz
          </button>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <FontAwesomeIcon icon={faSignOut} className="mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400 flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {error}
        </div>
      )}

      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Active Game Sessions
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {session.quiz.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      PIN: {session.pin}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => handleEndSession(session.id)}
                      disabled={actionInProgress === session.id}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="End Session"
                    >
                      <FontAwesomeIcon icon={faStop} />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{session.playerCount} players</span>
                  <span>{session.questionCount} questions</span>
                </div>
                <div className="flex flex-row gap-2">
                  <button
                    onClick={() => router.push(`/host/${session.id}`)}
                    disabled={actionInProgress === session.id}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionInProgress === session.id ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Processing...
                      </>
                    ) : (
                      'Continue Hosting'
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    disabled={actionInProgress === session.id}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Session"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          My Quizzes
        </h2>
        {quizzes.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 max-w-lg mx-auto">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven't created any quizzes yet.
              </p>
              <button
                onClick={handleCreateQuiz}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                Create Your First Quiz
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 space-y-4"
              >
                <h3 className="text-lg font-medium text-gray-900 dark:text-white line-clamp-2">
                  {quiz.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">
                  {quiz.description || 'No description'}
                </p>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {quiz.questions_count || 0} questions
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Created {new Date(quiz.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleStartGame(quiz.id)}
                    disabled={startingGame === quiz.id}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {startingGame === quiz.id ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPlay} className="mr-2" />
                        Start Game
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => router.push(`/quiz/edit/${quiz.id}`)}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                  >
                    <FontAwesomeIcon icon={faEdit} className="mr-2" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 