import { cn } from '@/lib/utils';
import type { AvatarColor } from '@/lib/types';

const colors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-teal-500',
];

// Map color names to Tailwind classes (required for Tailwind purge)
const colorClassMap: Record<AvatarColor, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
};

interface MemberAvatarProps {
  member: {
    name: string;
    avatarColor?: string;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
}

export function MemberAvatar({ member, size = 'md', showName = false }: MemberAvatarProps) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl',
  };

  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorIndex = member.name.charCodeAt(0) % colors.length;
  // Use color map to convert stored color name to Tailwind class
  const bgColor = member.avatarColor
    ? colorClassMap[member.avatarColor as AvatarColor] || colors[colorIndex]
    : colors[colorIndex];

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          sizeClasses[size],
          bgColor,
          'rounded-full flex items-center justify-center text-white font-bold shadow-md border-2 border-white'
        )}
      >
        {initials}
      </div>
      {showName && <span className="font-bold text-gray-800 text-lg">{member.name}</span>}
    </div>
  );
}
