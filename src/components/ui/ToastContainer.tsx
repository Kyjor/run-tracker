import { useToast, type ToastVariant } from '../../contexts/ToastContext';

const ICON: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const BG: Record<ToastVariant, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-primary-600',
  warning: 'bg-amber-500',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed top-safe-top left-0 right-0 z-[9999] flex flex-col items-center gap-2 pt-4 px-4 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-white shadow-xl pointer-events-auto max-w-sm w-full ${BG[t.variant]} animate-slide-down`}
          onClick={() => dismissToast(t.id)}
        >
          <span className="font-bold text-sm">{ICON[t.variant]}</span>
          <span className="text-sm flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

