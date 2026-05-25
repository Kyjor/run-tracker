interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const SIZE = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', className = '', onClick }: AvatarProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300',
        'font-semibold flex items-center justify-center shrink-0',
        SIZE[size],
        onClick ? 'active:opacity-80' : '',
        className,
      ].join(' ')}
    >
      {initials(name)}
    </Tag>
  );
}
