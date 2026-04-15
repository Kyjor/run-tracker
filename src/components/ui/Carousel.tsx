import { useState, useRef, useEffect, ReactNode, Children, isValidElement } from 'react';

interface CarouselProps {
  children: ReactNode;
  className?: string;
}

export function Carousel({ children, className = '' }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseDown = useRef(false);

  // Filter out null/undefined children
  const validChildren = Children.toArray(children).filter(
    child => isValidElement(child) && child !== null && child !== undefined
  );

  const totalSlides = validChildren.length;

  // Handle touch events
  function handleTouchStart(e: React.TouchEvent) {
    if (totalSlides <= 1) return;
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging || totalSlides <= 1) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setTranslateX(diff);
  }

  function handleTouchEnd() {
    if (!isDragging || totalSlides <= 1) return;
    handleSwipeEnd(translateX);
    setIsDragging(false);
    setTranslateX(0);
  }

  // Handle mouse events
  function handleMouseDown(e: React.MouseEvent) {
    if (totalSlides <= 1) return;
    e.preventDefault();
    setStartX(e.clientX);
    setIsDragging(true);
    isMouseDown.current = true;
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !isMouseDown.current || totalSlides <= 1) return;
    const currentX = e.clientX;
    const diff = currentX - startX;
    setTranslateX(diff);
  }

  function handleMouseUp() {
    if (!isDragging || totalSlides <= 1) return;
    handleSwipeEnd(translateX);
    setIsDragging(false);
    setTranslateX(0);
    isMouseDown.current = false;
  }

  function handleSwipeEnd(deltaX: number) {
    const threshold = 50; // Minimum swipe distance
    if (Math.abs(deltaX) < threshold) {
      return; // Not enough movement
    }

    if (deltaX > 0 && currentIndex > 0) {
      // Swipe right - go to previous
      setCurrentIndex(currentIndex - 1);
    } else if (deltaX < 0 && currentIndex < totalSlides - 1) {
      // Swipe left - go to next
      setCurrentIndex(currentIndex + 1);
    }
  }

  // Handle global mouse events for drag
  useEffect(() => {
    if (!isDragging) return;

    function handleGlobalMouseMove(e: MouseEvent) {
      if (!isMouseDown.current) return;
      const currentX = e.clientX;
      const diff = currentX - startX;
      setTranslateX(diff);
    }

    function handleGlobalMouseUp() {
      if (isMouseDown.current) {
        handleSwipeEnd(translateX);
        setIsDragging(false);
        setTranslateX(0);
        isMouseDown.current = false;
      }
    }

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, startX, translateX, currentIndex, totalSlides]);

  // Prevent scroll while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDragging]);

  if (totalSlides === 0) return null;

  const baseTranslate = -currentIndex * 100;
  const totalTranslate = baseTranslate + (translateX / (containerRef.current?.offsetWidth || 1)) * 100;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(${totalTranslate}%)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {validChildren.map((child, index) => (
            <div key={index} className="w-full flex-shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Page indicators */}
      {totalSlides > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {validChildren.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-6 bg-primary-500'
                  : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

