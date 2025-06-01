import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/dashboard');
      }
    };
    checkUser();
  }, [router]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      addToast('Successfully signed in!', 'success');
      router.push('/dashboard');
    } catch (error) {
      setError(error.message);
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back!</h1>
            <p className="text-white/80">Sign in to your account</p>
          </motion.div>

          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faEnvelope} className="text-white/50" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faLock} className="text-white/50" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/auth/reset-password"
                className="text-sm text-white hover:text-white/90 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm"
              >
                {error}
              </motion.div>
            )}

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
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center"
          >
            <p className="text-white/80">
              Don't have an account?{' '}
              <Link
                href="/auth/signup"
                className="text-white font-medium hover:text-white/90 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
} 