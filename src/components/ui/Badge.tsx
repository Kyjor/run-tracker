interface BadgeProps {
  label: string;
  color?: string;   // hex or tailwind bg class
  textColor?: string;
  className?: string;
}

export function Badge({ label, color, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={color ? { backgroundColor: color + '22', color: color } : undefined}
    >
      {label}
    </span>
  );
}

