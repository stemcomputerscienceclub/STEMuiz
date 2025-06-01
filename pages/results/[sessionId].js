import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy, faMedal, faCrown, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import Navigation from '../../components/Navigation';

export default function QuizResults() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [results, setResults] = useState([]);
  const [quizInfo, setQuizInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (!sessionId) return;

    const fetchResults = async () => {
      try {
        // Fetch quiz session info
        const { data: session, error: sessionError } = await supabase
          .from('quiz_sessions')
          .select(`
            *,
            quiz:quiz_id (
              title,
              description
            )
          `)
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;
        setQuizInfo(session);

        // Fetch player results
        const { data: playerResults, error: resultsError } = await supabase
          .from('player_results')
          .select(`
            *,
            player:player_id (
              name
            )
          `)
          .eq('session_id', sessionId)
          .order('score', { ascending: false });

        if (resultsError) throw resultsError;
        setResults(playerResults);
      } catch (error) {
        addToast('Error fetching results', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [sessionId, addToast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-white text-4xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <Navigation />
      
      <div className="max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{quizInfo?.quiz?.title}</h1>
            <p className="text-white/80">{quizInfo?.quiz?.description}</p>
          </div>

          <div className="space-y-4">
            {results.map((result, index) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white/5 rounded-xl p-4 flex items-center space-x-4 ${
                  index === 0 ? 'border-2 border-yellow-400' : ''
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center">
                  {index === 0 ? (
                    <FontAwesomeIcon icon={faCrown} className="text-yellow-400 text-2xl" />
                  ) : index === 1 ? (
                    <FontAwesomeIcon icon={faTrophy} className="text-gray-400 text-2xl" />
                  ) : index === 2 ? (
                    <FontAwesomeIcon icon={faMedal} className="text-amber-600 text-2xl" />
                  ) : (
                    <span className="text-white/60 text-xl font-bold">{index + 1}</span>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-medium text-white">{result.player?.name}</h3>
                  <div className="flex items-center space-x-4 text-white/60 text-sm">
                    <span>Score: {result.score}</span>
                    <span>Correct: {result.correct_answers}/{result.total_questions}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{result.score}</div>
                  <div className="text-white/60 text-sm">points</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex justify-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/quizzes')}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            >
              Back to Quizzes
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(`/quiz/${quizInfo?.quiz_id}`)}
              className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
            >
              Play Again
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 