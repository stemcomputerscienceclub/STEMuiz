import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

const icons = {
  success: faCheckCircle,
  error: faExclamationCircle,
  info: faInfoCircle,
};

const colors = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  React.useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`fixed bottom-4 right-4 flex items-center p-4 rounded-lg shadow-lg ${colors[type]} text-white min-w-[300px] max-w-md`}
    >
      <FontAwesomeIcon icon={icons[type]} className="w-5 h-5 mr-3" />
      <p className="flex-1">{message}</p>
      <button
        onClick={onClose}
        className="ml-4 hover:opacity-80 transition-opacity"
      >
        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
      </button>
    </motion.div>
  );
} 