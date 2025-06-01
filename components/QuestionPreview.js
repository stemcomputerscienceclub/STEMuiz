import { useEffect, useState } from 'react';

export default function QuestionPreview({ question, onComplete }) {
  const [show, setShow] = useState(true);
  const [phase, setPhase] = useState('initial'); // initial, reveal, complete

  useEffect(() => {
    if (!question) return;

    let timers = [];

    // Initial display
    timers.push(setTimeout(() => {
      setPhase('reveal');
    }, 500)); // Reduced from 1000ms

    // Reveal animation
    timers.push(setTimeout(() => {
      setPhase('complete');
    }, 1500)); // Reduced from 2000ms

    // Complete
    timers.push(setTimeout(() => {
      setShow(false);
      onComplete?.();
    }, 2500)); // Reduced from 3000ms

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [question, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-50">
      <div className={`transform transition-all duration-300 ${
        phase === 'initial' ? 'scale-0 opacity-0' :
        phase === 'reveal' ? 'scale-110 opacity-1' :
        'scale-100 opacity-1'
      }`}>
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white">
            Get Ready!
          </h2>
          <div className="text-2xl text-gray-300">
            {question?.question}
          </div>
          {question?.image_url && (
            <img 
              src={question.image_url} 
              alt="Question" 
              className="max-w-md mx-auto rounded-lg"
            />
          )}
        </div>
      </div>
    </div>
  );
} 