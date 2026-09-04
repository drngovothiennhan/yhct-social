'use client';

import { memo, useState } from 'react';
import { MessageCircle, ShieldCheck, Stethoscope, Sprout, CircleHelp } from 'lucide-react';
import { Avatar } from '@/components/common/avatar';
import { LikeButton } from '@/components/interactions/like-button';
import { CommentsThread } from '@/components/comments/comments-thread';
import { PostMedia } from '@/components/feed/post-media';
import { formatRelativeTime } from '@/lib/format';
import type { PostRecord } from '@/lib/types';

export const PostCard = memo(function PostCard({ post }: { post: PostRecord }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const type = postTypeMeta(post.type);
  const TypeIcon = type.icon;

  return (
    <article className="card overflow-hidden">
      <div className="p-5">
        <header className="flex items-start gap-3">
          <Avatar name={post.authorDisplayName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-900">{post.authorDisplayName}</span>
              {post.professionalLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" /> Đã xác minh
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {post.authorProfessionalTitle ? <span>{post.authorProfessionalTitle}</span> : null}
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${type.className}`}>
            <TypeIcon className="h-3.5 w-3.5" /> {type.label}
          </span>
        </header>

        <h2 className="mt-4 text-lg font-bold leading-7 text-slate-950">{post.title}</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{post.content}</p>

        {post.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">#{tag}</span>
            ))}
          </div>
        ) : null}

        <PostMedia paths={post.mediaPaths} />

        {post.type === 'clinical_case' && post.isDeidentified ? (
          <p className="mt-3 text-xs text-slate-400">Ca lâm sàng được tác giả xác nhận đã ẩn danh thông tin nhận diện.</p>
        ) : null}
      </div>

      <div className="flex items-center gap-1 border-t border-slate-100 px-4 py-2">
        <LikeButton postId={post.id} />
        <button
          type="button"
          className={`interaction-button ${commentsOpen ? 'text-emerald-700' : ''}`}
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((value) => !value)}
        >
          <MessageCircle className="h-4 w-4" />
          Thảo luận
        </button>
      </div>

      {commentsOpen ? <CommentsThread postId={post.id} /> : null}
    </article>
  );
});

function postTypeMeta(type: PostRecord['type']) {
  if (type === 'clinical_case') {
    return { label: 'Ca lâm sàng', icon: Stethoscope, className: 'bg-sky-50 text-sky-700' };
  }
  if (type === 'remedy') {
    return { label: 'Bài thuốc', icon: Sprout, className: 'bg-emerald-50 text-emerald-700' };
  }
  return { label: 'Hỏi đáp', icon: CircleHelp, className: 'bg-amber-50 text-amber-700' };
}
