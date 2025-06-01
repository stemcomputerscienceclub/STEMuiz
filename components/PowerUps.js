import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBolt, 
  faShield, 
  faClock,
  faLock
} from '@fortawesome/free-solid-svg-icons';

export default function PowerUps({ onUsePowerUp, streak = 0 }) {
  const [usedPowerUps, setUsedPowerUps] = useState(new Set());

  const powerUps = [
    {
      id: 'double',
      name: 'Double Points',
      icon: faBolt,
      requiredStreak: 3,
      description: 'Double points for your next correct answer'
    },
    {
      id: 'shield',
      name: 'Answer Shield',
      icon: faShield,
      requiredStreak: 4,
      description: 'Protect against one wrong answer'
    },
    {
      id: 'time',
      name: 'Extra Time',
      icon: faClock,
      requiredStreak: 5,
      description: '+5 seconds for this question'
    }
  ];

  const handleUsePowerUp = (powerUp) => {
    if (usedPowerUps.has(powerUp.id)) return;
    setUsedPowerUps(prev => new Set([...prev, powerUp.id]));
    onUsePowerUp?.(powerUp);
  };

  return (
    <div className="fixed bottom-4 left-4 flex flex-col gap-2">
      {powerUps.map(powerUp => (
        <button
          key={powerUp.id}
          onClick={() => handleUsePowerUp(powerUp)}
          disabled={streak < powerUp.requiredStreak || usedPowerUps.has(powerUp.id)}
          className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${streak >= powerUp.requiredStreak && !usedPowerUps.has(powerUp.id)
              ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          <FontAwesomeIcon 
            icon={streak >= powerUp.requiredStreak ? powerUp.icon : faLock} 
            className={streak >= powerUp.requiredStreak ? 'text-yellow-300' : ''} 
          />
          <span>{powerUp.name}</span>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-black/80 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {powerUp.description}
            {streak < powerUp.requiredStreak && (
              <div className="mt-1 text-xs text-gray-400">
                Requires {powerUp.requiredStreak}x streak
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
} 