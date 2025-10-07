import React, { useState } from 'react';
import { Target, Trophy, Zap } from 'lucide-react';

const DailyQuestCard = ({ quest, onComplete, isCompleted }) => {
  const [showModal, setShowModal] = useState(false);
  const [reflection, setReflection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (reflection.trim().length < 15) {
      setError('Reflection must be at least 15 characters!');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      await onComplete(reflection);
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-3xl p-8 border-2 border-green-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-4xl">✓</div>
          <h2 className="text-3xl font-bold text-white">Quest Complete!</h2>
        </div>
        <p className="text-green-200">Come back tomorrow for a new quest! 🌟</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 border-2 border-purple-500">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Target className="w-10 h-10 text-yellow-400" />
            <h2 className="text-3xl font-bold text-white">Today's Quest</h2>
          </div>
          <div className="bg-yellow-400 px-4 py-2 rounded-full">
            <span className="text-slate-900 font-bold">250 XP</span>
          </div>
        </div>

        <div className="bg-slate-800 bg-opacity-50 rounded-xl p-6 mb-6">
          <p className="text-white text-2xl font-semibold">{quest.content}</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 py-5 rounded-xl font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-3"
        >
          <Trophy className="w-6 h-6" />
          Complete Quest & Reflect
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-2xl w-full border-2 border-purple-500">
            <h2 className="text-3xl font-bold text-white mb-6">Quest Reflection</h2>
            
            <label className="block text-purple-300 mb-3">{quest.reflection_prompt}</label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full h-40 bg-slate-800 text-white rounded-xl p-4 border-2 border-purple-500 focus:border-yellow-400 outline-none resize-none"
              placeholder="Share your experience... (minimum 15 characters)"
            />
            <div className="text-sm text-gray-400 mt-2">{reflection.length} / 15 characters</div>
            
            {error && <p className="text-red-400 mt-2">⚠️ {error}</p>}

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-slate-700 text-white py-4 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || reflection.length < 15}
                className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 py-4 rounded-xl font-bold disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Claim Reward 🏆'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DailyQuestCard;