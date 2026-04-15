import { useState, useEffect } from 'react';
import { Card } from './Card';

interface AchievementBadgeProps {
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  onUnlock?: () => void;
}

export function AchievementBadge({
  title,
  description,
  emoji,
  unlocked,
  progress = 0,
  maxProgress = 1,
  onUnlock,
}: AchievementBadgeProps) {
  const [justUnlocked, setJustUnlocked] = useState(false);
  const progressPercent = Math.min((progress / maxProgress) * 100, 100);

  useEffect(() => {
    if (unlocked && !justUnlocked) {
      setJustUnlocked(true);
      onUnlock?.();
      setTimeout(() => setJustUnlocked(false), 2000);
    }
  }, [unlocked, justUnlocked, onUnlock]);

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 ${
        unlocked
          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-700'
          : 'opacity-60'
      } ${justUnlocked ? 'scale-105 ring-2 ring-yellow-400' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`text-4xl transition-transform duration-300 ${unlocked ? 'scale-100' : 'scale-75 grayscale'} ${
            justUnlocked ? 'animate-bounce' : ''
          }`}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${unlocked ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
            {title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          {!unlocked && maxProgress > 1 && (
            <div className="mt-2">
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {progress} / {maxProgress}
              </p>
            </div>
          )}
        </div>
        {unlocked && (
          <div className="text-yellow-500 dark:text-yellow-400">✓</div>
        )}
      </div>
    </Card>
  );
}

