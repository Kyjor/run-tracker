
interface ProgressBarProps {
  value: number;    // 0-100
  className?: string;
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  className = '',
  color = 'bg-primary-500',
  height = 8,
  showLabel = false,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

