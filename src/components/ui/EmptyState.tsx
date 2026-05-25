interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** @deprecated Ignored — use default icon */
  emoji?: string;
}

function RunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-primary-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 01-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  );
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="mb-4 p-4 rounded-full bg-primary-50 dark:bg-primary-900/30">
        <RunIcon />
      </div>
      <h3 className="text-lg font-semibold text-ink-primary dark:text-ink-dark-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mb-6 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}
