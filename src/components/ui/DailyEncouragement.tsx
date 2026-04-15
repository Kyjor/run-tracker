import { useEffect, useState } from 'react';
import { Card } from './Card';
import { getEncouragingMessage } from '../../utils/encouragingMessages';
import type { RunStats } from '../../types';

interface DailyEncouragementProps {
  stats: RunStats | null;
  hasRunToday: boolean;
}

const ENCOURAGEMENT_MESSAGES = [
  "You've got this! 💪",
  "Every step forward is progress! 🚀",
  "Consistency beats perfection! ⭐",
  "You're building something amazing! 🌟",
  "Small steps, big results! 🎯",
  "Your future self will thank you! 🙏",
  "Progress, not perfection! ✨",
  "You're stronger than you think! 💎",
];

export function DailyEncouragement({ stats, hasRunToday }: DailyEncouragementProps) {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (hasRunToday && stats) {
      setMessage(getEncouragingMessage('run'));
    } else if (stats && stats.current_streak > 0) {
      setMessage(getEncouragingMessage('streak', stats.current_streak));
    } else {
      const randomMsg = ENCOURAGEMENT_MESSAGES[Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)];
      setMessage(randomMsg);
    }
  }, [stats, hasRunToday]);

  if (!message) return null;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-0">
      <div className="flex items-center gap-3">
        <div className="text-3xl">💚</div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{message}</p>
      </div>
    </Card>
  );
}

