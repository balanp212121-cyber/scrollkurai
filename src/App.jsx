import React, { useState, useEffect } from 'react';
import { supabase } from "./lib/supabase";
import DailyQuestCard from './components/DailyQuestCard';
import Confetti from './components/Confetti';
import { Zap, Trophy, Flame } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quest, setQuest] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user);
      if (session?.user) loadDashboard();
    });
  }, []);

  const loadDashboard = async () => {
    try {
      // Get user stats
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', (await supabase.auth.getUser()).data.user.id)
        .single();
      
      setUserStats(userData);

      // Get daily quest
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-daily-quest`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const questData = await response.json();
      if (questData.success) setQuest(questData.quest);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email: email,
            username: username,
            password_hash: 'managed_by_supabase'
          }]);

        if (profileError) throw profileError;

        alert('Account created! Please check your email to verify.');
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setUser(data.user);
        loadDashboard();
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setQuest(null);
    setUserStats(null);
  };

  const handleCompleteQuest = async (reflection) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-quest`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_quest_log_id: quest.quest_log_id,
            reflection_text: reflection
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setQuest({ ...quest, is_completed: true });
        setUserStats({
          ...userStats,
          xp: result.new_xp,
          level: result.new_level,
          streak: result.streak
        });
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw error;
    }
  };

  // Login/Signup Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-purple-500">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2 text-center">
            ScrollKurai
          </h1>
          <p className="text-purple-300 text-center mb-8">Brain Rot → True Potential</p>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignup && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-purple-500 focus:border-yellow-400 outline-none"
                required
              />
            )}
            
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-purple-500 focus:border-yellow-400 outline-none"
              required
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-purple-500 focus:border-yellow-400 outline-none"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform disabled:opacity-50"
            >
              {loading ? 'Loading...' : (isSignup ? 'Sign Up' : 'Sign In')}
            </button>
          </form>

          <button
            onClick={() => setIsSignup(!isSignup)}
            className="w-full mt-4 text-purple-300 hover:text-purple-100"
          >
            {isSignup ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4 md:p-8">
      <Confetti show={showConfetti} />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            ScrollKurai
          </h1>
          <button
            onClick={handleSignOut}
            className="bg-slate-800 text-white px-6 py-2 rounded-xl hover:bg-slate-700"
          >
            Sign Out
          </button>
        </div>

        {/* User Stats */}
        {userStats && (
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-6 border-2 border-blue-500">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-8 h-8 text-blue-300" />
                <span className="text-blue-200 text-sm font-bold">Level</span>
              </div>
              <p className="text-4xl font-bold text-white">{userStats.level}</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-2xl p-6 border-2 border-yellow-500">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-8 h-8 text-yellow-300" />
                <span className="text-yellow-200 text-sm font-bold">XP</span>
              </div>
              <p className="text-4xl font-bold text-white">{userStats.xp}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-2xl p-6 border-2 border-orange-500">
              <div className="flex items-center justify-between mb-2">
                <Flame className="w-8 h-8 text-orange-300" />
                <span className="text-orange-200 text-sm font-bold">Streak</span>
              </div>
              <p className="text-4xl font-bold text-white">{userStats.streak} 🔥</p>
            </div>
          </div>
        )}

        {/* XP Progress Bar */}
        {userStats && (
          <div className="bg-slate-900 rounded-2xl p-6 mb-8 border-2 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <span className="text-purple-300 font-semibold">Level {userStats.level} Progress</span>
              <span className="text-purple-300 text-sm">{userStats.xp % 1000} / 1000 XP</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full transition-all duration-1000"
                style={{ width: `${(userStats.xp % 1000) / 10}%` }}
              />
            </div>
          </div>
        )}

        {/* Daily Quest */}
        {quest ? (
          <DailyQuestCard
            quest={quest}
            onComplete={handleCompleteQuest}
            isCompleted={quest.is_completed}
          />
        ) : (
          <div className="bg-slate-900 rounded-3xl p-8 border-2 border-purple-500">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-purple-300">Loading your quest...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;