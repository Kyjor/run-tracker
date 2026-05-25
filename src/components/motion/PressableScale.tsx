import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PressableScaleProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function PressableScale({ children, className, onClick }: PressableScaleProps) {
  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
