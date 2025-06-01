import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);

    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return faCheckCircle;
      case 'error':
        return faExclamationCircle;
      default:
        return faInfoCircle;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.3 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={`${getColor(toast.type)} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]`}
            >
              <FontAwesomeIcon icon={getIcon(toast.type)} className="text-xl" />
              <p className="flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
} 