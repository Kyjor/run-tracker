import { motion, type HTMLMotionProps } from 'framer-motion';
import { springSoft } from './motionConfig';

interface SlideUpProps extends HTMLMotionProps<'div'> {
  delay?: number;
}

export function SlideUp({ children, delay = 0, className, ...rest }: SlideUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
