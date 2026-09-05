'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart, MessageCircle, ShieldCheck, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ReportDialog } from '@/components/portal/report-dialog';
import { SocialComments } from '@/components/portal/social-comments';
import { clearPostReaction, setPostReaction, subscribePostReactions } from '@/lib/reaction-service';
import type { ReactionType } from '@/lib/domain/social';
import type { SocialPostRecord } from '@/lib/types';

const kindLabel = {
  member_post: 'Chia sẻ thành viên',
  club_news: 'Tin CLB',
  activity_update: 'Cập nhật hoạt động',
} as const;

export function SocialPostCard({ post, expanded = false }: { post: SocialPostRecord; expanded?: boolean }) {
  const { user, claims } = useAuth();
  const [reactionCount, setReactionCount] = useState(post.reactionCount);
  const [currentType, setCurrentType] = useState<ReactionType | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(expanded);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribePostReactions(post.id, user?.uid ?? null, (state) => {
    setReactionCount(state.count);
    setCurrentType(state.currentType);
  }), [post.id, user?.uid]);

  async function react(type: ReactionType) {
    if (!user || !claims?.clubMember || claims.mustChangePassword || busy) return;
    setBusy(true);
    try {
      if (currentType === type) await clearPostReaction(post.id, user.uid);
      else await setPostReaction(post.id, user.uid, type);
    } finally {
      setBusy(false);
    }
  }

  const date = post.createdAt?.toDate?.();
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
            {post.authorPhotoSnapshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.authorPhotoSnapshot} alt="" className="h-full w-full object-cover" />
            ) : post.authorNameSnapshot.slice(0, 1).toLocaleUpperCase('vi')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/members/${post.authorId}`} className="truncate font-bold text-slate-900 hover:text-emerald-700">{post.authorNameSnapshot}</Link>
              {post.authorRoleSnapshot !== 'member' ? <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Ban quản lý CLB" /> : null}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{kindLabel[post.kind]}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{date ? date.toLocaleString('vi-VN') : 'Vừa đăng'}{post.edited ? ' · đã chỉnh sửa' : ''}</p>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">{post.status === 'deleted' ? 'Bài viết đã được xóa.' : post.text}</p>

        {post.media.length > 0 && post.status === 'active' ? (
          <div className={`mt-4 grid gap-2 ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {post.media.map((media) => (
              <a key={media.storagePath} href={media.downloadURL} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media.downloadURL} alt="Ảnh bài viết" className="max-h-[520px] w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {post.status === 'active' ? (
        <div className="border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1 px-4 py-2">
            <button type="button" disabled={busy} onClick={() => void react('like')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${currentType === 'like' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}><ThumbsUp className="h-4 w-4" /> Thích</button>
            <button type="button" disabled={busy} onClick={() => void react('heart')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${currentType === 'heart' ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}><Heart className="h-4 w-4" /> Đồng cảm</button>
            <button type="button" onClick={() => setCommentsOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><MessageCircle className="h-4 w-4" /> Thảo luận</button>
            {user?.uid !== post.authorId ? <ReportDialog targetType="post" postId={post.id} /> : null}
            <span className="ml-auto text-xs text-slate-500">{reactionCount} cảm xúc</span>
            {!expanded ? <Link href={`/posts/${post.id}`} className="ml-2 text-xs font-semibold text-emerald-700">Mở bài</Link> : null}
          </div>
          {commentsOpen ? <SocialComments postId={post.id} /> : null}
        </div>
      ) : null}
    </article>
  );
}
