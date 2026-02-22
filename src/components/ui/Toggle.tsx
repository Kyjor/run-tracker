import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div className="flex-1 mr-4">
          {label && <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</p>}
          {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      )}
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
          checked ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

