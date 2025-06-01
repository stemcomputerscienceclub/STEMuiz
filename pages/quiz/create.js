import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

export default function CreateQuiz() {
  const router = useRouter();
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([
    {
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      timeLimit: 30,
      points: 1000,
      imageUrl: null
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/signin');
      } else {
        setUser(user);
      }
    };
    getUser();
  }, [router]);

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const handleOptionChange = (questionIndex, optionIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        timeLimit: 30,
        points: 1000,
        imageUrl: null
      }
    ]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) {
      setError('User not loaded. Please wait and try again.');
      addToast('User not loaded. Please wait and try again.', 'error');
      return;
    }
    // Validate
    if (!title.trim()) {
      setError('Quiz title is required');
      addToast('Quiz title is required', 'error');
      return;
    }
    if (questions.some(q => !q.question.trim())) {
      setError('All questions must have content');
      addToast('All questions must have content', 'error');
      return;
    }
    if (questions.some(q => q.options.some(opt => !opt.trim()))) {
      setError('All options must have content');
      addToast('All options must have content', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Insert quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert([{ title, description, owner_id: user.id }])
        .select()
        .single();
      if (quizError) throw quizError;
      // 2. Insert questions
      for (const q of questions) {
        const { error: questionError } = await supabase
          .from('questions')
          .insert([{
            quiz_id: quiz.id,
            question: q.question,
            options: q.options,
            correct_index: q.correctIndex,
            time_limit: q.timeLimit,
            image_url: q.imageUrl,
            points: q.points
          }]);
        if (questionError) throw questionError;
      }
      addToast('Quiz created successfully!', 'success');
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || JSON.stringify(err) || 'An unexpected error occurred.');
      addToast(err.message || JSON.stringify(err) || 'An unexpected error occurred.', 'error');
      // eslint-disable-next-line no-console
      console.error('Quiz creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create New Quiz
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Fill in the details below to create your quiz.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Quiz Details */}
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quiz Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>
        {/* Questions */}
        <div className="space-y-6">
          {questions.map((question, qIndex) => (
            <div key={qIndex} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg space-y-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Question {qIndex + 1}</h3>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Question
                </label>
                <input
                  type="text"
                  value={question.question}
                  onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                  placeholder="Enter your question"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Time Limit (seconds)
                  </label>
                  <select
                    value={question.timeLimit}
                    onChange={(e) => handleQuestionChange(qIndex, 'timeLimit', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={20}>20 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={45}>45 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Points
                  </label>
                  <select
                    value={question.points}
                    onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value={500}>500 points</option>
                    <option value={1000}>1000 points</option>
                    <option value={1500}>1500 points</option>
                    <option value={2000}>2000 points</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Options
                </label>
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      checked={question.correctIndex === oIndex}
                      onChange={() => handleQuestionChange(qIndex, 'correctIndex', oIndex)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add Question
          </button>
        </div>
        {error && (
          <div className="text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !user}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
} 