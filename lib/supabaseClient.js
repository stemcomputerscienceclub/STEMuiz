import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:');
  if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!supabaseAnonKey) console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  throw new Error('Missing required Supabase configuration. Check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

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
      let isUnique = false;
      
      // Check if PIN is unique
      while (!isUnique) {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('id')
          .eq('pin', pin)
          .eq('status', 'active')
          .single();
        
        if (error && error.code === 'PGRST116') {
          // No results found, PIN is unique
          isUnique = true;
        } else {
          // Generate a new PIN and try again
          pin = generatePin();
        }
      }
      
      const { data, error } = await supabase
        .from('game_sessions')
        .insert([{
          quiz_id: quizId,
          host_id: hostId,
          pin,
          status: 'waiting',
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
      checkRateLimit(`join_game_${pin}_${playerName}`);
      
      // Find the active session with this PIN
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('pin', pin)
        .not('status', 'eq', 'ended')
        .maybeSingle();
      
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Game not found. Please check the PIN and try again.');
      if (session.status === 'active') throw new Error('This game has already started.');
      
      // Create a player entry
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{
          session_id: session.id,
          name: playerName,
          score: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (playerError) throw playerError;
      
      return {
        sessionId: session.id,
        playerId: player.id
      };
    } catch (error) {
      handleError(error, 'Failed to join game.');
    }
  },

  async updateGameSessionStatus({ sessionId, status }) {
    try {
      checkRateLimit(`update_session_${sessionId}`);
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Failed to update game status.');
    }
  },

  async getGameSession(sessionId) {
    try {
      checkRateLimit(`get_session_${sessionId}`);
      
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select(`
          *,
          quiz:quizzes (
            *,
            questions (
              *,
              options:question_options(*)
            )
          ),
          players (*)
        `)
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;
      
      // Sort the questions by ID to ensure consistent order
      if (session.quiz?.questions) {
        session.quiz.questions.sort((a, b) => a.id - b.id);
      }
      
      return session;
    } catch (error) {
      handleError(error, 'Failed to load game session.');
    }
  },

  async getGameResults(sessionId) {
    try {
      checkRateLimit(`get_results_${sessionId}`);
      
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select(`
          *,
          quiz:quizzes (
            *,
            questions (*)
          ),
          players:players (
            *,
            answers:player_answers (*)
          )
        `)
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;
      
      // Calculate accuracy for each player
      if (session.players) {
        for (const player of session.players) {
          if (player.answers && session.quiz.questions) {
            const totalQuestions = session.quiz.questions.length;
            const correctAnswers = player.answers.filter(answer => {
              const question = session.quiz.questions.find(q => q.id === answer.question_id);
              return question && answer.selected_option === question.correct_index;
            }).length;
            
            player.accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
          } else {
            player.accuracy = 0;
          }
        }
        
        // Sort players by score (highest first)
        session.players.sort((a, b) => b.score - a.score);
      }
      
      return session;
    } catch (error) {
      handleError(error, 'Failed to load game results.');
    }
  },

  async updatePlayerScore({ playerId, score }) {
    try {
      checkRateLimit(`update_score_${playerId}`);
      
      const { error } = await supabase
        .from('players')
        .update({ score, updated_at: new Date().toISOString() })
        .eq('id', playerId);
      
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Failed to update player score.');
    }
  },

  async getActiveGameSessions(hostId) {
    try {
      console.log('Getting active sessions for host:', hostId);
      checkRateLimit(`get_active_games_${hostId}`);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .select(`
          *,
          quiz:quizzes (
            title,
            description
          ),
          players (id)
        `)
        .eq('host_id', hostId)
        .not('status', 'eq', 'ended')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching active sessions:', error);
        throw error;
      }
      
      // Count players for each session
      const sessionsWithCounts = (data || []).map(session => ({
        ...session,
        player_count: session.players ? session.players.length : 0
      }));
      
      console.log('Found sessions:', sessionsWithCounts.length);
      return sessionsWithCounts;
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
      checkRateLimit(`end_session_${sessionId}`);
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Failed to end game session.');
    }
  },

  async deleteGameSession(sessionId) {
    try {
      checkRateLimit(`delete_session_${sessionId}`);
      
      // Delete related records first
      await supabase
        .from('player_answers')
        .delete()
        .eq('session_id', sessionId);
      
      await supabase
        .from('players')
        .delete()
        .eq('session_id', sessionId);
      
      // Then delete the session
      const { error } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Failed to delete game session.');
    }
  }
};