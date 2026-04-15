import { useEffect, useState } from 'react';

interface CelebrationProps {
  show: boolean;
  message: string;
  emoji?: string;
  onComplete?: () => void;
}

export function Celebration({ show, message, emoji = '🎉', onComplete }: CelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setConfetti(true);
      const timer = setTimeout(() => {
        setConfetti(false);
        setTimeout(() => {
          setVisible(false);
          onComplete?.();
        }, 500);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Confetti effect */}
      {confetti && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][
                  Math.floor(Math.random() * 6)
                ],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Celebration message */}
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 transform transition-all duration-500 pointer-events-auto ${
          confetti ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="text-6xl animate-bounce">{emoji}</div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">{message}</p>
      </div>

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
}

