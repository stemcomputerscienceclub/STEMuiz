import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

export default function Layout({ children }) {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (user) {
          // Try to fetch profile from Supabase
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', user.id)
            .single();
          
          // If the profile exists, use it
          if (profileData && !error) {
            setProfile(profileData);
          } else {
            // If the profile doesn't exist or there was an error, create a fallback profile
            console.warn('Profile not found or error fetching profile, using fallback data');
            const fallbackProfile = {
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              avatar_url: null
            };
            
            setProfile(fallbackProfile);
            
            // Try to create the profile for future use
            try {
              await supabase
                .from('profiles')
                .upsert([{ 
                  id: user.id,
                  name: fallbackProfile.name,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }], { onConflict: 'id' });
            } catch (createError) {
              console.error('Failed to create profile:', createError);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error in getUser:', error);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    getUser();
    
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });
    
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <nav className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center">
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  STEMuiz
                </span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
                aria-label="Toggle dark mode"
              >
                <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
              </button>

              {user ? (
                <div className="flex items-center space-x-4">
                  {profile && (
                    <div className="flex items-center space-x-2">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.name || 'User Avatar'}
                          className="w-8 h-8 rounded-full object-cover border border-white"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                          {profile.name ? profile.name[0].toUpperCase() : user.email[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-white font-medium">{profile.name || user.email}</span>
                    </div>
                  )}
                  <Link
                    href="/dashboard"
                    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = '/auth/signin';
                    }}
                    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
} 