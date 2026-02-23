import type { TrainingPlan } from '../../types';
import { RACE_TYPE_LABELS, DIFFICULTY_LABELS, ACTIVITY_COLORS } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface PlanCardProps {
  plan: TrainingPlan;
  isActive?: boolean;
  onClick?: () => void;
}

const RACE_EMOJI: Record<string, string> = {
  '5k': '🏅',
  '10k': '🥈',
  'half_marathon': '🥇',
  'full_marathon': '🏆',
  'other': '🎽',
};

export function PlanCard({ plan, isActive, onClick }: PlanCardProps) {
  return (
    <Card onClick={onClick} className={isActive ? 'border-2 border-primary-500' : ''}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{RACE_EMOJI[plan.race_type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{plan.name}</h3>
            {isActive && (
              <Badge label="Active" color="#3b82f6" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={RACE_TYPE_LABELS[plan.race_type]} color={ACTIVITY_COLORS['race']} />
            <Badge label={DIFFICULTY_LABELS[plan.difficulty]} color="#6b7280" />
            <span className="text-xs text-gray-400 dark:text-gray-500">{plan.duration_weeks}w</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{plan.description}</p>
        </div>
      </div>
    </Card>
  );
}

