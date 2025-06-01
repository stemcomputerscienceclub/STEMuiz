import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faQuestion, faClock, faImage, faRandom, faShuffle } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import Navigation from '../components/Navigation';

export default function CreateQuiz() {
  const router = useRouter();
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [randomQuestions, setRandomQuestions] = useState(false);
  const [questions, setQuestions] = useState([
    {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1000,
      timeLimit: 30,
      image: null,
      questionType: 'multiple_choice'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const addQuestion = (type = 'multiple_choice') => {
    const newQuestion = {
      question: '',
      options: type === 'true_false' ? ['True', 'False'] : ['', '', '', ''],
      correctAnswer: 0,
      points: 1000,
      timeLimit: 30,
      image: null,
      questionType: type
    };
    
    setQuestions([...questions, newQuestion]);
    setCurrentQuestion(questions.length);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) {
      addToast('Quiz must have at least one question', 'error');
      return;
    }
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
    setCurrentQuestion(Math.min(currentQuestion, newQuestions.length - 1));
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const changeQuestionType = (index, type) => {
    const newQuestions = [...questions];
    const currentQuestion = newQuestions[index];
    
    if (type === 'true_false') {
      newQuestions[index] = {
        ...currentQuestion,
        questionType: type,
        options: ['True', 'False'],
        correctAnswer: currentQuestion.correctAnswer > 1 ? 0 : currentQuestion.correctAnswer
      };
    } else {
      newQuestions[index] = {
        ...currentQuestion,
        questionType: type,
        options: currentQuestion.options.length !== 4 ? ['', '', '', ''] : currentQuestion.options
      };
    }
    
    setQuestions(newQuestions);
  };

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

      updateQuestion(questionIndex, 'image', publicUrl);
      addToast('Image uploaded successfully!', 'success');
    } catch (error) {
      addToast('Error uploading image', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        addToast('Please sign in to create a quiz', 'error');
        router.push('/auth/signin');
        return;
      }

      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert([
          {
            title,
            description,
            time_limit: timeLimit,
            random_questions: randomQuestions,
            created_by: user.id,
            questions: questions.map(q => ({
              ...q,
              image: q.image || null,
              questionType: q.questionType
            }))
          }
        ])
        .select()
        .single();

      if (quizError) throw quizError;

      addToast('Quiz created successfully!', 'success');
      router.push(`/quiz/${quiz.id}`);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <Navigation />
      
      <div className="max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20"
        >
          <h1 className="text-3xl font-bold text-white mb-6">Create New Quiz</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Quiz Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                placeholder="Enter quiz title"
                required
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                placeholder="Enter quiz description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Default Time Limit (seconds)
                </label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                  min={5}
                  max={300}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Random Question Order
                </label>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="randomQuestions"
                    checked={randomQuestions}
                    onChange={(e) => setRandomQuestions(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 border-white/50 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="randomQuestions" className="ml-2 text-white">
                    Shuffle questions for each game session
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Questions</h2>
                <div className="flex space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => addQuestion('true_false')}
                    className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Add True/False
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => addQuestion('multiple_choice')}
                    className="flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Add Multiple Choice
                  </motion.button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {questions.map((question, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white/5 rounded-xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-white">Question {index + 1}</h3>
                      <div className="flex space-x-3">
                        <select
                          value={question.questionType}
                          onChange={(e) => changeQuestionType(index, e.target.value)}
                          className="bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all px-3 py-1"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True/False</option>
                        </select>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(index)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-white text-sm font-medium mb-2">
                        Question Text
                      </label>
                      <input
                        type="text"
                        value={question.question}
                        onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                        placeholder="Enter your question"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-white text-sm font-medium mb-2">
                        Question Image (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(index, e.target.files[0])}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                      />
                      {question.image && (
                        <img
                          src={question.image}
                          alt="Question"
                          className="mt-2 max-h-40 rounded-lg"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          Points
                        </label>
                        <input
                          type="number"
                          value={question.points}
                          onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value))}
                          min={100}
                          step={100}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          Time Limit (seconds)
                        </label>
                        <input
                          type="number"
                          value={question.timeLimit}
                          onChange={(e) => updateQuestion(index, 'timeLimit', parseInt(e.target.value))}
                          min={5}
                          max={300}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Creating Quiz...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <FontAwesomeIcon icon={faSave} className="mr-2" />
                  Create Quiz
                </div>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
} 