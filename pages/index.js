import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faUser, faSignInAlt, faUserPlus, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { db } from '../lib/supabase';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(user);
      } catch (error) {
        console.error('Auth error:', error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    getUser();
    
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handlePinChange = (idx, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newDigits = [...pinDigits];
    newDigits[idx] = value;
    setPinDigits(newDigits);
    if (value && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePinKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pinDigits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePinPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...pinDigits];
    
    // Fill in the digits from the pasted data
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    
    setPinDigits(newDigits);
    
    // Focus the next empty input or the last input if all are filled
    const nextEmptyIndex = newDigits.findIndex(digit => !digit);
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    inputRefs.current[focusIndex]?.focus();
  };

  const handleJoinGame = async (e) => {
    e.preventDefault();
    setError('');
    setIsJoining(true);

    const pin = pinDigits.join('');
    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      setIsJoining(false);
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name');
      setIsJoining(false);
      return;
    }

    try {
      // Store player name in localStorage BEFORE joining
      const playerName = name.trim();
      localStorage.setItem('playerName', playerName);
      
      const response = await db.joinGameSession({
        pin,
        playerName
      });

      if (!response || !response.sessionId) {
        throw new Error('Failed to join game. Please check the PIN and try again.');
      }

      // Store the game session ID
      localStorage.setItem('currentGameSession', response.sessionId);
      
      router.push(`/play/${response.sessionId}`);
    } catch (err) {
      console.error('Join game error:', err);
      setError(err.message || 'Failed to join game. Please check that the PIN matches.');
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-white" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 px-4 sm:px-6 lg:px-8">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-bold text-center text-white drop-shadow-lg mb-6"
      >
        Welcome to Kahoot Clone
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 shadow-xl border border-white/20"
      >
        <form onSubmit={handleJoinGame} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faKey} /> Game PIN
            </label>
            <div className="flex space-x-2 justify-center">
              {pinDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => inputRefs.current[idx] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinChange(idx, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(idx, e)}
                  onPaste={handlePinPaste}
                  className="w-10 sm:w-12 h-12 sm:h-14 text-xl sm:text-2xl text-center rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:border-indigo-400 transition-all shadow-md"
                  aria-label={`PIN digit ${idx + 1}`}
                  disabled={isJoining}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faUser} /> Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:border-indigo-400 transition-all shadow-md"
              placeholder="Enter your name"
              required
              disabled={isJoining}
            />
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center"
            >
              {error}
            </motion.p>
          )}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={isJoining}
            className="w-full flex justify-center py-3 px-4 rounded-lg text-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Joining...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSignInAlt} /> Join Game
              </>
            )}
          </motion.button>
        </form>
        {!user && (
          <div className="text-center mt-6 space-y-2">
            <p className="text-white/80">Want to create your own quiz?</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
              <a
                href="/auth/signin"
                className="text-indigo-300 hover:text-indigo-100 font-medium flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-indigo-300/30 hover:border-indigo-300/50 transition-all"
              >
                <FontAwesomeIcon icon={faSignInAlt} /> Sign in
              </a>
              <a
                href="/auth/signup"
                className="text-indigo-300 hover:text-indigo-100 font-medium flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-indigo-300/30 hover:border-indigo-300/50 transition-all"
              >
                <FontAwesomeIcon icon={faUserPlus} /> Sign up
              </a>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
} 