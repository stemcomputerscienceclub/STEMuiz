import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faTimes, faUser, faSignInAlt, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Quizzes', href: '/quizzes' },
    { name: 'Create', href: '/create' },
  ];

  return (
    <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0">
              <span className="text-2xl font-bold text-white">Kahoot Clone</span>
            </Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium text-white hover:bg-white/10 transition-colors ${
                      router.pathname === item.href ? 'bg-white/20' : ''
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="ml-4 flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-white">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="flex items-center px-4 py-2 rounded-md text-sm font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    <FontAwesomeIcon icon={faSignInAlt} className="mr-2" />
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    <FontAwesomeIcon icon={faUserPlus} className="mr-2" />
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-white/10 focus:outline-none"
            >
              <FontAwesomeIcon icon={isOpen ? faTimes : faBars} className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/10 backdrop-blur-lg"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-white/10 transition-colors ${
                    router.pathname === item.href ? 'bg-white/20' : ''
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {user ? (
                <>
                  <div className="px-3 py-2 text-white">
                    <FontAwesomeIcon icon={faUser} className="mr-2" />
                    {user.email}
                  </div>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-white hover:bg-white/10 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <FontAwesomeIcon icon={faSignInAlt} className="mr-2" />
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <FontAwesomeIcon icon={faUserPlus} className="mr-2" />
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
} 