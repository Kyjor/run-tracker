import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), className }: AnimatedNumberProps) {
  const spring = useSpring(value, { stiffness: 300, damping: 30 });
  const display = useTransform(spring, (v) => format(v));
  const [text, setText] = useState(format(value));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = display.on('change', (v) => setText(v));
    return unsub;
  }, [display]);

  return <motion.span className={className}>{text}</motion.span>;
}
