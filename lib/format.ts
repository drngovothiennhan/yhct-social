export interface DateLikeTimestamp {
  toDate(): Date;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'YH';
  return parts.slice(-2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatRelativeTime(timestamp: DateLikeTimestamp | null): string {
  if (!timestamp) return 'vừa xong';

  const date = timestamp.toDate();
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

  if (absMs < 60_000) return 'vừa xong';
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  if (absMs < 604_800_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
