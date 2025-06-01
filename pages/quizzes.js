import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faClock, faUser, faPlay, faEdit, faTrash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import Navigation from '../components/Navigation';

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    fetchQuizzes();
    return () => subscription.unsubscribe();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select(`*, profiles:created_by (name)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuizzes(data);
    } catch (error) {
      addToast('Error fetching quizzes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);
      if (error) throw error;
      setQuizzes(quizzes.filter(quiz => quiz.id !== quizId));
      addToast('Quiz deleted successfully', 'success');
    } catch (error) {
      addToast('Error deleting quiz', 'error');
    }
  };

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quiz.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <Navigation />
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4 md:mb-0">Available Quizzes</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search quizzes..."
                className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50"
              />
            </div>
            <Link
              href="/create"
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
            >
              Create Quiz
            </Link>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-white text-4xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-xl border border-white/20"
              >
                <h2 className="text-xl font-semibold text-white mb-2">{quiz.title}</h2>
                <p className="text-white/80 mb-4 line-clamp-2">{quiz.description}</p>
                <div className="flex items-center space-x-4 text-white/60 text-sm mb-4">
                  <div className="flex items-center">
                    <FontAwesomeIcon icon={faClock} className="mr-1" />
                    {quiz.time_limit}s
                  </div>
                  <div className="flex items-center">
                    <FontAwesomeIcon icon={faUser} className="mr-1" />
                    {quiz.profiles?.name || 'Anonymous'}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Link
                    href={`/quiz/${quiz.id}`}
                    className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlay} className="mr-2" />
                    Play
                  </Link>
                  {user && user.id === quiz.created_by && (
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/edit/${quiz.id}`}
                        className="p-2 text-white/80 hover:text-white transition-colors"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </Link>
                      <button
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {!loading && filteredQuizzes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/80 text-lg">No quizzes found</p>
          </div>
        )}
      </div>
    </div>
  );
} 