'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PostCard } from '@/components/feed/post-card';
import { subscribePublishedPosts } from '@/lib/post-service';
import type { PostRecord, PostType } from '@/lib/types';

export function Feed() {
  const [filter, setFilter] = useState<PostType | 'all'>('all');
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    return subscribePublishedPosts(
      filter,
      (nextPosts) => {
        setPosts(nextPosts);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Không thể tải bảng tin.');
        setLoading(false);
      },
    );
  }, [filter]);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
        {([
          ['all', 'Tất cả'],
          ['clinical_case', 'Ca lâm sàng'],
          ['remedy', 'Bài thuốc'],
          ['qa', 'Hỏi đáp'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'filter-chip-active' : 'filter-chip'}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card grid min-h-40 place-items-center text-slate-500">
          <div className="flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4 animate-spin" /> Đang đồng bộ bảng tin…</div>
        </div>
      ) : error ? (
        <div className="card border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <strong>Không thể mở bảng tin.</strong>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs">Nếu vừa deploy index, chờ Firestore hoàn tất xây index rồi tải lại trang.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">Chưa có bài viết trong nhóm này.</div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      )}
    </section>
  );
}
