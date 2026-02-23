import type { CommunityPlan } from '../../types';
import { RACE_TYPE_LABELS, DIFFICULTY_LABELS } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface CommunityPlanCardProps {
  plan: CommunityPlan;
  onClick?: () => void;
  onUpvote?: () => void;
  hasUpvoted?: boolean;
}

export function CommunityPlanCard({ plan, onClick, onUpvote, hasUpvoted }: CommunityPlanCardProps) {
  return (
    <Card onClick={onClick} padding={false} className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 leading-snug">{plan.name}</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge label={RACE_TYPE_LABELS[plan.race_type]} color="#ef4444" />
              <Badge label={DIFFICULTY_LABELS[plan.difficulty]} color="#6b7280" />
              <Badge label={`${plan.duration_weeks}w`} color="#6b7280" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{plan.description}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onUpvote?.(); }}
            className={[
              'flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors',
              hasUpvoted
                ? 'text-accent-500 bg-accent-50 dark:bg-accent-900/30'
                : 'text-gray-400 bg-gray-50 dark:bg-gray-700',
            ].join(' ')}
          >
            <span className="text-base">{hasUpvoted ? '▲' : '△'}</span>
            <span className="text-xs font-medium">{plan.upvote_count}</span>
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <span className="text-amber-400 text-sm">★</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {plan.avg_rating > 0 ? plan.avg_rating.toFixed(1) : '—'}
              {plan.rating_count > 0 && ` (${plan.rating_count})`}
            </span>
          </div>
          {plan.author && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              by {plan.author.display_name}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

