import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: boolean;
}

export function Card({ children, className = '', onClick, padding = true }: CardProps) {
  return (
    <div
      className={[
        'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700',
        padding ? 'p-4' : '',
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : '',
        className,
      ].join(' ')}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h2>
      {action}
    </div>
  );
}

