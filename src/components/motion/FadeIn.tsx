import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeTransition } from './motionConfig';

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
}

export function FadeIn({ children, delay = 0, className, ...rest }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...fadeTransition, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
