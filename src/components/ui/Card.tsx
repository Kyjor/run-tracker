import type { ReactNode } from 'react';
import { PressableScale } from '../motion/PressableScale';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: boolean;
}

export function Card({ children, className = '', onClick, padding = true }: CardProps) {
  const base = [
    'bg-surface dark:bg-surface-dark-elevated rounded-card shadow-card dark:shadow-card-dark',
    'border border-border dark:border-border-dark overflow-hidden',
    padding ? 'p-4' : '',
    className,
  ].join(' ');

  if (onClick) {
    return (
      <PressableScale onClick={onClick} className={[base, 'cursor-pointer'].join(' ')}>
        {children}
      </PressableScale>
    );
  }

  return <div className={base}>{children}</div>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-0.5 mb-2.5">
      <h2 className="text-xs font-semibold text-ink-secondary dark:text-ink-dark-secondary uppercase tracking-wider">
        {title}
      </h2>
      {action}
    </div>
  );
}
