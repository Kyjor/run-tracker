import { useNavigate } from 'react-router-dom';
import { NotificationsBell } from '../notifications/NotificationsBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  showNotifications?: boolean;
}

export function Header({ title, subtitle, showBack, rightAction, transparent, showNotifications = true }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <div
      className={[
        'flex items-center px-4 pt-safe-top pb-3 gap-3',
        transparent ? '' : 'bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800',
      ].join(' ')}
    >
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-primary-600 dark:text-primary-400 active:opacity-70"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {showNotifications && <NotificationsBell />}
        {rightAction}
      </div>
    </div>
  );
}

