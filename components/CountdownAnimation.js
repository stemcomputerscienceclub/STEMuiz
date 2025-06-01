import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CountdownAnimation({ onComplete }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="text-9xl font-bold text-white mb-4">
            {count}
          </div>
          <div className="text-2xl text-white/80">
            {count === 0 ? 'Go!' : 'Get Ready!'}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
} 