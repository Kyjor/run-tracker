import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handler);
      // Prevent background scrolling while modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl animate-slide-up shadow-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 100px)' }}>
        {/* Header */}
        {title && (
          <div className="flex-shrink-0 px-6 pt-6 pb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
        )}
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 text-gray-700 dark:text-gray-200 min-h-0">
          {children}
        </div>
        {footer && <div className="flex-shrink-0 px-6 pb-20 border-t border-gray-100 dark:border-gray-700 pt-4 bg-white dark:bg-gray-800">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
}) {
  const confirmClass =
    confirmVariant === 'danger'
      ? 'bg-red-500 text-white rounded-2xl py-3 font-semibold active:bg-red-600'
      : 'bg-primary-600 text-white rounded-2xl py-3 font-semibold active:bg-primary-700';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm mb-6">{message}</p>
      <div className="flex flex-col gap-2">
        <button className={confirmClass} onClick={onConfirm} disabled={isLoading}>
          {isLoading ? '...' : confirmLabel}
        </button>
        <button
          className="text-gray-500 dark:text-gray-400 py-3 text-center"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

