interface MetricChipProps {
  label: string;
  value: string;
  className?: string;
}

export function MetricChip({ label, value, className = '' }: MetricChipProps) {
  return (
    <div className={['flex flex-col min-w-0', className].join(' ')}>
      <span className="text-sm font-semibold text-ink-primary dark:text-ink-dark-primary tabular-nums truncate">
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
        {label}
      </span>
    </div>
  );
}
