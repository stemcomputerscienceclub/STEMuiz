import { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faSpinner, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      setSuccess(true);
      addToast('Password reset link sent! Please check your email.', 'success', 5000);
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
            <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-white/80">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </motion.div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-green-500/20 border border-green-500/50 rounded-lg text-center"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckCircle} className="w-8 h-8 text-green-300" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Check your email</h3>
              <p className="text-white/80">
                We've sent a password reset link to your email address. Please check your inbox and follow the instructions.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
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
                    Sending reset link...
                  </div>
                ) : (
                  'Send Reset Link'
                )}
              </motion.button>
            </form>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center"
          >
            <Link
              href="/auth/signin"
              className="text-white font-medium hover:text-white/90 transition-colors"
            >
              Back to Sign In
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
} 