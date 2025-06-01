import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy, faMedal, faCrown, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

export default function LeaderboardChart({ leaderboard, previousLeaderboard = [] }) {
  // Calculate position changes
  const getPositionChange = (playerId) => {
    const currentIndex = leaderboard.findIndex(p => p.id === playerId);
    const previousIndex = previousLeaderboard.findIndex(p => p.id === playerId);
    
    if (previousIndex === -1) return 0; // New player
    return previousIndex - currentIndex;
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white/5 backdrop-blur-lg rounded-xl p-6 shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-center">Leaderboard</h2>
      <div className="space-y-4">
        {leaderboard.map((player, index) => {
          const positionChange = getPositionChange(player.id);
          const isTopThree = index < 3;
          
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-lg ${
                isTopThree ? 'bg-white/10' : 'bg-white/5'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center">
                  {index === 0 ? (
                    <FontAwesomeIcon icon={faCrown} className="text-yellow-400 text-xl" />
                  ) : index === 1 ? (
                    <FontAwesomeIcon icon={faTrophy} className="text-gray-400 text-xl" />
                  ) : index === 2 ? (
                    <FontAwesomeIcon icon={faMedal} className="text-amber-600 text-xl" />
                  ) : (
                    <span className="text-white/60 font-bold">{index + 1}</span>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{player.name}</span>
                    {positionChange !== 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`flex items-center ${
                          positionChange > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        <FontAwesomeIcon 
                          icon={positionChange > 0 ? faArrowUp : faArrowDown} 
                          className="text-sm"
                        />
                        <span className="text-sm ml-1">{Math.abs(positionChange)}</span>
                      </motion.div>
                    )}
                  </div>
                  <div className="text-sm text-white/60">
                    {player.correctAnswers || 0} correct answers
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-xl font-bold">{player.score}</div>
                <div className="text-sm text-white/60">points</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
