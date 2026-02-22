import React from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white active:bg-primary-700 disabled:opacity-50',
  secondary:
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 active:bg-gray-200 dark:active:bg-gray-600 disabled:opacity-50',
  ghost:
    'bg-transparent text-primary-600 dark:text-primary-400 active:bg-primary-50 dark:active:bg-primary-900/30 disabled:opacity-50',
  danger:
    'bg-red-500 text-white active:bg-red-600 disabled:opacity-50',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-xl',
  md: 'text-base px-4 py-2.5 rounded-2xl',
  lg: 'text-base px-5 py-3.5 rounded-2xl font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors select-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : leftIcon}
      {children}
    </button>
  );
}

