import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faImage, faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import { useToast } from '../../../contexts/ToastContext';
import Navigation from '../../../components/Navigation';

export default function EditQuiz() {
  const router = useRouter();
  const { id } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        console.log('Fetching quiz with ID:', id);

        // First check if user is authenticated
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError) {
          console.error('Auth error:', authError);
          throw authError;
        }
        if (!session?.user) {
          console.log('No authenticated user found');
          router.push('/auth/signin');
          return;
        }
        console.log('User authenticated:', session.user.id);

        // First fetch the quiz
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single();

        if (quizError) {
          console.error('Quiz fetch error:', quizError);
          throw quizError;
        }

        // Then fetch the questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', id)
          .order('created_at', { ascending: true });

        if (questionsError) {
          console.error('Questions fetch error:', questionsError);
          throw questionsError;
        }

        const fullQuiz = {
          ...quizData,
          questions: questionsData || []
        };

        console.log('Quiz loaded successfully:', fullQuiz);
        setQuiz(fullQuiz);
        setError(null);
      } catch (error) {
        console.error('Error in fetchQuiz:', error);
        setError(error.message || 'Error fetching quiz');
        addToast(error.message || 'Error fetching quiz', 'error');
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id, router, addToast]);

  const handleImageUpload = async (questionIndex, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `question-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

      const updatedQuestions = [...quiz.questions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        image_url: publicUrl
      };

      setQuiz({ ...quiz, questions: updatedQuestions });
      addToast('Image uploaded successfully', 'success');
    } catch (error) {
      addToast('Error uploading image', 'error');
    }
  };

  const handleSaveQuestion = async (index) => {
    try {
      setSaving(true);
      const question = quiz.questions[index];
      
      // Update existing question
      if (question.id) {
        const { error: questionError } = await supabase
          .from('questions')
          .update({
            question: question.question,
            options: question.options,
            correct_index: question.correct_index || 0,
            time_limit: question.time_limit || 30,
            points: question.points || 1000,
            updated_at: new Date().toISOString()
          })
          .eq('id', question.id);
        
        if (questionError) throw questionError;
      } 
      // Create new question
      else {
        const { data: newQuestion, error: questionError } = await supabase
          .from('questions')
          .insert([
            {
              quiz_id: quiz.id,
              question: question.question,
              options: question.options,
              correct_index: question.correct_index || 0,
              time_limit: question.time_limit || 30,
              points: question.points || 1000,
              created_at: new Date().toISOString()
            }
          ]);
        
        if (questionError) throw questionError;
        
        // Update question id in the local state
        if (newQuestion) {
          const updatedQuestions = [...quiz.questions];
          updatedQuestions[index] = {
            ...updatedQuestions[index],
            id: newQuestion[0].id
          };
          
          setQuiz({
            ...quiz,
            questions: updatedQuestions
          });
        }
      }
      
      addToast('Question saved successfully', 'success');
    } catch (error) {
      console.error('Error saving question:', error);
      addToast('Failed to save question', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addNewQuestion = () => {
    setQuiz({
      ...quiz,
      questions: [
        ...quiz.questions,
        {
          question: '',
          options: ['', '', '', ''],
          correct_index: 0,
          time_limit: 30,
          points: 1000
        }
      ]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // First update the quiz
      const { error: quizError } = await supabase
        .from('quizzes')
        .update({
          title: quiz.title,
          description: quiz.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (quizError) throw quizError;

      // Then update each question
      for (const question of quiz.questions) {
        if (question.id) {
          // Update existing question
          const { error: questionError } = await supabase
            .from('questions')
            .update({
              question: question.question,
              options: question.options,
              correct_index: question.correct_index,
              time_limit: question.time_limit,
              image_url: question.image_url,
              points: question.points || 1000,
              updated_at: new Date().toISOString()
            })
            .eq('id', question.id);

          if (questionError) throw questionError;
        } else {
          // Insert new question
          const { error: questionError } = await supabase
            .from('questions')
            .insert([{
              quiz_id: id,
              question: question.question,
              options: question.options,
              correct_index: question.correct_index,
              time_limit: question.time_limit,
              image_url: question.image_url,
              points: question.points || 1000,
              created_at: new Date().toISOString()
            }]);

          if (questionError) throw questionError;
        }
      }

      addToast('Quiz updated successfully', 'success');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error updating quiz:', error);
      addToast(error.message || 'Error updating quiz', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <FontAwesomeIcon icon={faSpinner} spin className="text-white text-4xl mb-4" />
            <p className="text-white text-lg">Loading quiz...</p>
          </div>
        </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Quiz</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Quiz Not Found</h2>
          <p className="text-white/80 mb-6">This quiz doesn't exist or you don't have permission to edit it.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Quiz Details Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Quiz Details</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">Quiz Title</label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                placeholder="Enter an engaging title for your quiz"
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Description</label>
              <textarea
                value={quiz.description}
                onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                placeholder="Describe what your quiz is about"
                rows="3"
                required
              />
            </div>

          </div>
        </div>

        {/* Questions Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Questions</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={addNewQuestion}
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-all flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} />
              Add Question
            </motion.button>
          </div>

          <div className="space-y-6">
            {quiz.questions.map((question, questionIndex) => (
              <motion.div
                key={questionIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-medium text-white">Question {questionIndex + 1}</h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => {
                      const updatedQuestions = quiz.questions.filter((_, i) => i !== questionIndex);
                      setQuiz({ ...quiz, questions: updatedQuestions });
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors p-2"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </motion.button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Question Text</label>
                    <input
                      type="text"
                      value={question.question}
                      onChange={(e) => {
                        const updatedQuestions = [...quiz.questions];
                        updatedQuestions[questionIndex] = {
                          ...question,
                          question: e.target.value
                        };
                        setQuiz({ ...quiz, questions: updatedQuestions });
                      }}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                      placeholder="Enter your question"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Options</label>
                    <div className="space-y-3">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-3">
                          <input
                            type="radio"
                            checked={question.correct_index === optionIndex}
                            onChange={(e) => {
                              const updatedQuestions = [...quiz.questions];
                              updatedQuestions[questionIndex] = {
                                ...question,
                                correct_index: optionIndex
                              };
                              setQuiz({ ...quiz, questions: updatedQuestions });
                            }}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-white/30 bg-white/5"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const updatedQuestions = [...quiz.questions];
                              const updatedOptions = [...question.options];
                              updatedOptions[optionIndex] = e.target.value;
                              updatedQuestions[questionIndex] = {
                                ...question,
                                options: updatedOptions
                              };
                              setQuiz({ ...quiz, questions: updatedQuestions });
                            }}
                            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                            placeholder={`Option ${optionIndex + 1}`}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Time Limit (seconds)</label>
                    <input
                      type="number"
                      value={question.time_limit}
                      onChange={(e) => {
                        const updatedQuestions = [...quiz.questions];
                        updatedQuestions[questionIndex] = {
                          ...question,
                          time_limit: parseInt(e.target.value)
                        };
                        setQuiz({ ...quiz, questions: updatedQuestions });
                      }}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                      min="5"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-white text-sm font-medium mb-2">Points</label>
                      <input
                        type="number"
                        value={question.points || 1000}
                        onChange={(e) => {
                          const updatedQuestions = [...quiz.questions];
                          updatedQuestions[questionIndex] = {
                            ...question,
                            points: parseInt(e.target.value)
                          };
                          setQuiz({ ...quiz, questions: updatedQuestions });
                        }}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                        min="100"
                        step="100"
                        required
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Add New Question Button at the end for easier access */}
          <div className="mt-6 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={addNewQuestion}
              className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-all flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} />
              Add New Question
            </motion.button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSave} />
                Save Changes
              </>
            )}
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
} 