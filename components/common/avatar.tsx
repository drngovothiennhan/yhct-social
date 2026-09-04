import { initials } from '@/lib/format';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }[size];

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-800 ring-1 ring-emerald-200`}
    >
      {initials(name)}
    </div>
  );
}
