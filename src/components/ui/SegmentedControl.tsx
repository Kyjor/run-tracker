interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={[
        'flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800/80 border border-border dark:border-border-dark',
        className,
      ].join(' ')}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 text-sm font-medium py-2 rounded-xl transition-all duration-200',
            value === opt.value
              ? 'bg-white dark:bg-gray-700 text-ink-primary dark:text-ink-dark-primary shadow-sm'
              : 'text-ink-secondary dark:text-ink-dark-secondary',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
