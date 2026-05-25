import type { ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** When true, adds bottom padding for fixed tab bar */
  withTabBar?: boolean;
  scroll?: boolean;
}

export function Screen({ children, className = '', withTabBar = true, scroll = true }: ScreenProps) {
  const pb = withTabBar ? 'pb-24' : 'pb-safe-bottom';
  if (scroll) {
    return (
      <div className={['flex flex-col flex-1 overflow-hidden', className].join(' ')}>
        <div className={['flex-1 overflow-y-auto overscroll-contain', pb].join(' ')}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className={['flex flex-col flex-1 overflow-hidden', pb, className].join(' ')}>
      {children}
    </div>
  );
}

/** Standard horizontal padding for screen content */
export function ScreenContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={['px-4 pt-4 flex flex-col gap-section', className].join(' ')}>{children}</div>;
}
