const LEVELS = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Steady' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Max' },
] as const;

export function effortLabel(value: number | null | undefined): string | null {
  return LEVELS.find(level => level.value === value)?.label ?? null;
}

export function EffortPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-secondary dark:text-ink-dark-secondary mb-2">How hard was it?</p>
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map(level => {
          const selected = value === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={[
                'rounded-xl py-2 flex flex-col items-center border',
                selected
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-surface dark:bg-surface-dark border-border dark:border-border-dark text-ink-primary dark:text-ink-dark-primary',
              ].join(' ')}
            >
              <span className="text-sm font-semibold tabular-nums">{level.value}</span>
              <span className={`text-[10px] ${selected ? 'text-white/80' : 'text-ink-muted dark:text-ink-dark-muted'}`}>
                {level.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
