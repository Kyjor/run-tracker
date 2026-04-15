/**
 * Duolingo-style encouraging messages for various achievements
 */

const STREAK_MESSAGES = [
  "🔥 Amazing! Your streak is on fire!",
  "💪 You're building an incredible habit!",
  "🌟 Consistency is your superpower!",
  "🎯 You're crushing it!",
  "⚡ Keep the momentum going!",
];

const GOAL_COMPLETE_MESSAGES = [
  "🎉 Goal achieved! You're unstoppable!",
  "🏆 Mission accomplished!",
  "✨ You did it! So proud!",
  "🚀 Goal crushed! What's next?",
  "💎 Excellence achieved!",
];

const RUN_COMPLETE_MESSAGES = [
  "🏃 Great run! You're getting stronger!",
  "💚 Every step counts!",
  "🌟 You're building something amazing!",
  "🔥 That was awesome!",
  "💪 Progress made!",
];

const WEEK_COMPLETE_MESSAGES = [
  "🎊 Perfect week! You're a champion!",
  "⭐ 7 days of dedication!",
  "🏅 Week complete! Incredible work!",
  "💫 You finished strong!",
  "🎯 Consistency wins!",
];

export function getStreakMessage(streak: number): string {
  if (streak >= 30) return "🔥 30 day streak! You're a legend!";
  if (streak >= 14) return "🌟 Two weeks strong! Keep it up!";
  if (streak >= 7) return "💪 Week streak! You're on fire!";
  return STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
}

export function getGoalCompleteMessage(): string {
  return GOAL_COMPLETE_MESSAGES[Math.floor(Math.random() * GOAL_COMPLETE_MESSAGES.length)];
}

export function getRunCompleteMessage(): string {
  return RUN_COMPLETE_MESSAGES[Math.floor(Math.random() * RUN_COMPLETE_MESSAGES.length)];
}

export function getWeekCompleteMessage(): string {
  return WEEK_COMPLETE_MESSAGES[Math.floor(Math.random() * WEEK_COMPLETE_MESSAGES.length)];
}

export function getEncouragingMessage(context: 'streak' | 'goal' | 'run' | 'week', value?: number): string {
  switch (context) {
    case 'streak':
      return getStreakMessage(value ?? 0);
    case 'goal':
      return getGoalCompleteMessage();
    case 'run':
      return getRunCompleteMessage();
    case 'week':
      return getWeekCompleteMessage();
    default:
      return "Great job! 🎉";
  }
}

