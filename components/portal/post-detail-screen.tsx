'use client';

import { useEffect, useState } from 'react';
import { SocialPostCard } from '@/components/portal/social-post-card';
import { loadSocialPost } from '@/lib/post-service';
import type { SocialPostRecord } from '@/lib/types';

export function PostDetailScreen({ postId }: { postId: string }) {
  const [post, setPost] = useState<SocialPostRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadSocialPost(postId).then((result) => {
      if (active) setPost(result);
    }).catch((next: unknown) => {
      if (active) setError(next instanceof Error ? next.message : 'Không thể tải bài viết.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId]);

  if (loading) return <p className="text-sm text-slate-500">Đang tải bài viết…</p>;
  if (error) return <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (!post) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Bài viết không tồn tại hoặc bạn không có quyền xem.</p>;
  return <SocialPostCard post={post} expanded />;
}
