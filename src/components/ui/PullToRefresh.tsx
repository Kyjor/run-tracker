import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80; // Distance in pixels to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    function handleTouchStart(e: TouchEvent) {
      // Only start pull if at the top of the scrollable area
      if (container && container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isPulling.current || startY.current === null) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      if (deltaY > 0 && container && container.scrollTop === 0) {
        // Prevent default scrolling while pulling
        e.preventDefault();
        const distance = Math.min(deltaY, MAX_PULL);
        setPullDistance(distance);
      } else {
        // Reset if scrolled away from top
        isPulling.current = false;
        setPullDistance(0);
      }
    }

    function handleTouchEnd() {
      if (!isPulling.current) return;

      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        Promise.resolve(onRefresh())
          .then(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          })
          .catch(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          });
      } else {
        // Spring back
        setPullDistance(0);
      }

      isPulling.current = false;
      startY.current = null;
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, pullDistance, isRefreshing, disabled]);

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldShowSpinner = pullDistance >= PULL_THRESHOLD || isRefreshing;

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 pointer-events-none z-10"
        style={{
          height: `${Math.max(pullDistance, 0)}px`,
          opacity: pullProgress,
          transform: `translateY(${Math.max(pullDistance - 60, -60)}px)`,
        }}
      >
        {shouldShowSpinner ? (
          <Spinner size="sm" className="text-primary-500" />
        ) : (
          <div className="text-primary-500 text-sm">↓ Pull to refresh</div>
        )}
      </div>

      {/* Content - children should have their own scroll container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{
          transform: `translateY(${isRefreshing ? 60 : Math.max(pullDistance, 0)}px)`,
          transition: isRefreshing ? 'transform 0.2s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

