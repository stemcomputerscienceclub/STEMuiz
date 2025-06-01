import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire } from '@fortawesome/free-solid-svg-icons';

export default function AnswerStreak({ streak }) {
  if (!streak || streak < 2) return null;

  return (
    <div className="fixed top-4 left-4 bg-orange-500/20 text-orange-400 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
      <FontAwesomeIcon icon={faFire} className="text-orange-500" />
      <span className="font-bold">{streak}x Streak!</span>
    </div>
  );
} 