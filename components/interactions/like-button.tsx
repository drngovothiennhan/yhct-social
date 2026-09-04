'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { subscribeLikes, togglePostLike } from '@/lib/post-service';

export function LikeButton({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeLikes(
    postId,
    user?.uid ?? null,
    (next) => {
      setCount(next.count);
      setLiked(next.likedByCurrentUser);
    },
    () => setError('Không thể cập nhật lượt thích.'),
  ), [postId, user?.uid]);

  async function toggle() {
    if (!user) {
      setError('Đăng nhập để thích bài viết.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await togglePostLike(postId, user.uid, liked);
    } catch {
      setError('Không thể cập nhật lượt thích.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        aria-pressed={liked}
        className={`interaction-button ${liked ? 'text-rose-600' : ''}`}
        onClick={() => void toggle()}
      >
        <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
        <span>{count > 0 ? count : 'Thích'}</span>
      </button>
      {error ? (
        <div className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg">
          {error}
        </div>
      ) : null}
    </div>
  );
}
