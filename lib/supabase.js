import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Rate limiting helper
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100; // per minute

const checkRateLimit = (key) => {
  const now = Date.now();
  const userRequests = rateLimits.get(key) || [];
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    throw new Error('Too many requests. Please try again later.');
  }
  
  recentRequests.push(now);
  rateLimits.set(key, recentRequests);
};

// Error handling helper
const handleError = (error, customMessage) => {
  console.error('Database error:', error);
  
  // Handle specific Supabase errors
  if (error.code === '23505') {
    throw new Error('This item already exists.');
  }
  if (error.code === '23503') {
    throw new Error('Referenced item does not exist.');
  }
  if (error.code === '42501') {
    throw new Error('You do not have permission to perform this action.');
  }
  if (error.message?.includes('row-level security')) {
    throw new Error('You do not have permission to perform this action. Please sign in again.');
  }
  
  throw new Error(customMessage || 'An unexpected error occurred.');
};

// Authentication check helper
const checkAuth = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('You must be signed in to perform this action.');
  }
  return session.user.id;
};

// Helper functions for common database operations
export const db = {
  // Quiz operations
  async createQuiz({ title, description, ownerId }) {
    try {
      checkRateLimit(`create_quiz_${ownerId}`);
      await checkAuth(); // Ensure user is authenticated
      
      const { data, error } = await supabase
        .from('quizzes')
        .insert([{ 
          title, 
          description, 
          owner_id: ownerId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Failed to create quiz.');
    }
  },

  async getQuizzesByUser(userId) {
    try {
      console.log('Fetching quizzes for user:', userId);
      checkRateLimit(`get_quizzes_${userId}`);
      
      // First try without the questions count
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching quizzes:', error);
        throw error;
      }

      console.log('Found quizzes:', data?.length || 0);

      // Then get the questions count separately
      const quizzesWithCount = await Promise.all(
        (data || []).map(async (quiz) => {
          const { count, error: countError } = await supabase
            .from('questions')
            .select('id', { count: 'exact' })
            .eq('quiz_id', quiz.id);
          
          if (countError) {
            console.error('Error counting questions for quiz:', quiz.id, countError);
          }
          
          return {
            ...quiz,
            questions_count: countError ? 0 : count
          };
        })
      );
      
      return quizzesWithCount;
    } catch (error) {
      console.error('Error in getQuizzesByUser:', error);
      if (error.message?.includes('JWT')) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      throw error;
    }
  },

  async getQuizById(quizId) {
    try {
      checkRateLimit(`get_quiz_${quizId}`);
      
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select(`
          *,
          questions (
            *,
            options:question_options(*)
          )
        `)
        .eq('id', quizId)
        .single();
      
      if (quizError) throw quizError;
      return quiz;
    } catch (error) {
      handleError(error, 'Failed to load quiz.');
    }
  },

  async deleteQuiz(quizId) {
    try {
      checkRateLimit(`delete_quiz_${quizId}`);
      
      // Delete all related data first (cascade delete)
      const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .eq('quiz_id', quizId);
      
      if (questionsError) throw questionsError;
      
      const { error: quizError } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);
      
      if (quizError) throw quizError;
    } catch (error) {
      handleError(error, 'Failed to delete quiz.');
    }
  },

  // Question operations
  async addQuestionToQuiz({ quizId, question, options, correctIndex, timeLimit, imageUrl }) {
    try {
      checkRateLimit(`add_question_${quizId}`);
      
      const { data, error } = await supabase
        .from('questions')
        .insert([{
          quiz_id: quizId,
          question,
          options,
          correct_index: correctIndex,
          time_limit: timeLimit,
          image_url: imageUrl,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Failed to add question.');
    }
  },

  async updateQuestion({ questionId, question, options, correctIndex, timeLimit, imageUrl }) {
    try {
      checkRateLimit(`update_question_${questionId}`);
      
      const { data, error } = await supabase
        .from('questions')
        .update({
          question,
          options,
          correct_index: correctIndex,
          time_limit: timeLimit,
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Failed to update question.');
    }
  },

  async deleteQuestion(questionId) {
    try {
      checkRateLimit(`delete_question_${questionId}`);
      
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);
      
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Failed to delete question.');
    }
  },

  // Game session operations
  async createGameSession({ quizId, hostId }) {
    try {
      checkRateLimit(`create_game_${hostId}`);
      
      // Generate a unique 6-digit PIN
      const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();
      let pin = generatePin();
      let attempts = 0;
      const maxAttempts = 10;

      // Keep trying until we find a unique PIN
      while (attempts < maxAttempts) {
        const { data: existing } = await supabase
          .from('game_sessions')
          .select('id')
          .eq('pin', pin)
          .eq('status', 'waiting')
          .single();

        if (!existing) break;
        pin = generatePin();
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique game PIN. Please try again.');
      }

      const { data, error } = await supabase
        .from('game_sessions')
        .insert([{
          quiz_id: quizId,
          host_id: hostId,
          status: 'waiting',
          pin,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Failed to create game session.');
    }
  },

  async joinGameSession({ pin, playerName }) {
    try {
      if (!pin || !playerName) {
        throw new Error('PIN and player name are required.');
      }

      // Find the game session by PIN
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('pin', pin)
        .eq('status', 'waiting')
        .single();

      if (sessionError || !session) {
        throw new Error('Game not found or already started.');
      }
      
      // Check if a player with this name already exists in this session
      const { data: existingPlayers, error: checkError } = await supabase
        .from('player_sessions')
        .select('*')
        .eq('game_session_id', session.id)
        .eq('name', playerName);
        
      if (checkError) {
        console.error('Error checking existing players:', checkError);
        throw checkError;
      }
      
      // If player with same name exists, reject the join attempt
      if (existingPlayers && existingPlayers.length > 0) {
        throw new Error('This name is already taken in the game. Please choose another name.');
      }

      // Add player to the session using player_sessions table
      const { data: player, error: playerError } = await supabase
        .from('player_sessions')
        .insert([{
          game_session_id: session.id,
          name: playerName,
          score: 0
        }])
        .select()
        .single();

      if (playerError) {
        if (playerError.code === '23505') {
          throw new Error('This name is already taken in the game.');
        }
        throw playerError;
      }

      return {
        sessionId: session.id,
        playerId: player.id,
        pin: session.pin
      };
    } catch (error) {
      handleError(error, 'Failed to join game.');
    }
  },

  async updateGameSessionStatus({ sessionId, status }) {
    try {
      checkRateLimit(`update_game_${sessionId}`);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Failed to update game status.');
    }
  },

  async getGameSession(sessionId) {
    try {
      console.log('Loading game session:', sessionId);
      checkRateLimit(`get_game_${sessionId}`);
      
      // First get the basic session info
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) {
        console.error('Error loading session:', sessionError);
        throw sessionError;
      }

      if (!session) {
        throw new Error('Game session not found');
      }

      // Get the quiz details
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', session.quiz_id)
        .single();
        
      if (quizError) {
        console.error('Error loading quiz:', quizError);
        throw quizError;
      }

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Get questions with their options (stored in the options column)
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', session.quiz_id)
        .order('created_at', { ascending: true });

      if (questionsError) {
        console.error('Error loading questions:', questionsError);
        throw questionsError;
      }

      // Format questions to ensure options are in the correct format
      const questionsWithOptions = (questions || []).map(question => ({
        ...question,
        options: Array.isArray(question.options) ? question.options : []
      }));

      // Get players
      const { data: players, error: playersError } = await supabase
        .from('player_sessions')
        .select('*')
        .eq('game_session_id', sessionId);
      
      if (playersError) {
        console.error('Error loading players:', playersError);
        throw playersError;
      }

      // Combine all data
      const fullSession = {
        ...session,
        quiz: {
          ...quiz,
          questions: questionsWithOptions
        },
        players: players || []
      };

      console.log('Successfully loaded game session with', 
        players?.length || 0, 'players and',
        questionsWithOptions?.length || 0, 'questions'
      );

      return fullSession;
    } catch (error) {
      console.error('Error in getGameSession:', error);
      if (error.message?.includes('JWT')) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      throw error;
    }
  },

  async updatePlayerScore({ playerId, score }) {
    try {
      checkRateLimit(`update_score_${playerId}`);
      
      const { data, error } = await supabase
        .from('player_sessions')
        .update({ 
          score,
          updated_at: new Date().toISOString()
        })
        .eq('id', playerId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Failed to update player score.');
    }
  },

  async getActiveGameSessions(hostId) {
    try {
      console.log('Fetching active sessions for host:', hostId);
      checkRateLimit(`get_active_games_${hostId}`);
      
      // First get the game sessions with quiz titles
      const { data: sessions, error: sessionsError } = await supabase
        .from('game_sessions')
        .select(`
          *,
          quiz:quizzes (
            id,
            title
          ),
          players:player_sessions (*)
        `)
        .eq('host_id', hostId)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false });
      
      if (sessionsError) {
        console.error('Error fetching active sessions:', sessionsError);
        throw sessionsError;
      }

      console.log('Found active sessions:', sessions?.length || 0);

      // Then get the question counts for each quiz separately
      const processedData = await Promise.all((sessions || []).map(async (session) => {
        let questionCount = 0;
        if (session.quiz?.id) {
          const { count, error: countError } = await supabase
            .from('questions')
            .select('*', { count: 'exact' })
            .eq('quiz_id', session.quiz.id);
          
          if (countError) {
            console.error('Error counting questions for quiz:', session.quiz.id, countError);
          } else {
            questionCount = count || 0;
          }
        }

        return {
          ...session,
          playerCount: session.players?.length || 0,
          questionCount,
          quiz: {
            ...session.quiz,
            title: session.quiz?.title || 'Untitled Quiz'
          }
        };
      }));

      return processedData;
    } catch (error) {
      console.error('Error in getActiveGameSessions:', error);
      if (error.message?.includes('JWT')) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      throw error;
    }
  },

  async endGameSession(sessionId) {
    try {
      console.log('Ending game session:', sessionId);
      checkRateLimit(`end_game_${sessionId}`);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) {
        console.error('Error ending game session:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in endGameSession:', error);
      throw error;
    }
  },

  async deleteGameSession(sessionId) {
    try {
      console.log('Deleting game session:', sessionId);
      checkRateLimit(`delete_game_${sessionId}`);
      
      // First delete all player sessions
      const { error: playerError } = await supabase
        .from('player_sessions')
        .delete()
        .eq('game_session_id', sessionId);
      
      if (playerError) {
        console.error('Error deleting player sessions:', playerError);
        throw playerError;
      }

      // Then delete the game session
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (sessionError) {
        console.error('Error deleting game session:', sessionError);
        throw sessionError;
      }

      console.log('Successfully deleted game session and all player data');
      return true;
    } catch (error) {
      console.error('Error in deleteGameSession:', error);
      throw error;
    }
  },

  // Add a function to delete a game session
  async deleteGameSession(sessionId) {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const { error } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting game session:', error);
      throw error;
    }
  },
}; 