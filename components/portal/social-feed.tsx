'use client';

import { useEffect, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { SocialComposer } from '@/components/portal/social-composer';
import { SocialPostCard } from '@/components/portal/social-post-card';
import { loadFeedPage, type SocialFeedFilter } from '@/lib/post-service';
import type { SocialPostRecord } from '@/lib/types';

export function SocialFeed() {
  const { user, claims, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<SocialFeedFilter>('all');
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const canBrowse = Boolean(user && claims?.clubMember);

  useEffect(() => {
    if (!canBrowse) return;
    let active = true;
    void loadFeedPage({ filter }).then((page) => {
      if (!active) return;
      setPosts(page.posts);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setError(null);
    }).catch((next: unknown) => {
      if (active) setError(next instanceof Error ? next.message : 'Không thể tải bảng tin.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [canBrowse, filter, refreshKey]);

  async function loadMore() {
    if (!cursor || loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const page = await loadFeedPage({ filter, cursor });
      setPosts((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...page.posts.filter((item) => !ids.has(item.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (next) {
      setError(next instanceof Error ? next.message : 'Không thể tải thêm bài viết.');
    } finally {
      setLoading(false);
    }
  }

  function changeFilter(next: SocialFeedFilter) {
    if (next === filter) return;
    setLoading(true);
    setFilter(next);
  }

  function refreshAfterPublish() {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  }

  if (authLoading) return <div className="grid min-h-48 place-items-center text-slate-500"><LoaderCircle className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">Đăng nhập để xem bảng tin dành cho thành viên CLB.</section>;
  if (!claims?.clubMember) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">Tài khoản chưa có quyền thành viên CLB.</section>;

  return (
    <div className="space-y-4">
      <SocialComposer onPublished={refreshAfterPublish} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          ['all', 'Tất cả'],
          ['club', 'Tin CLB'],
          ['members', 'Thành viên'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => changeFilter(value)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${filter === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</div> : null}
      {!loading && posts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có bài viết trong mục này.</div> : null}
      {posts.map((post) => <SocialPostCard key={post.id} post={post} />)}

      {hasMore ? <button type="button" onClick={() => void loadMore()} disabled={loading} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 disabled:opacity-60">{loading ? 'Đang tải…' : 'Tải thêm'}</button> : null}
      {loading && posts.length === 0 ? <div className="grid h-28 place-items-center text-slate-500"><LoaderCircle className="h-6 w-6 animate-spin" /></div> : null}
    </div>
  );
}
