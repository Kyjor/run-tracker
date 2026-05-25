import { motion } from 'framer-motion';

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}

export function StaggerList({ children, className, stagger = 0.04 }: StaggerListProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } },
      }}
    >
      {children}
    </motion.div>
  );
}
