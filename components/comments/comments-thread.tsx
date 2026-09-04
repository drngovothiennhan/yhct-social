'use client';

import { memo, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CornerDownRight, Send, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/common/avatar';
import { useAuth } from '@/components/providers/auth-provider';
import { buildCommentTree, type CommentNode } from '@/lib/domain/comments';
import {
  createComment,
  softDeleteOwnComment,
  subscribePostComments,
} from '@/lib/comment-service';
import type { CommentRecord } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';

export function CommentsThread({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribePostComments(
    postId,
    setComments,
    () => setError('Không thể tải thảo luận.'),
  ), [postId]);

  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  async function submitRoot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      setError('Đăng nhập để tham gia thảo luận.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createComment({ profile, postId, content });
      setContent('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể gửi bình luận.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
      <form className="flex gap-2" onSubmit={submitRoot}>
        <input
          className="field-input min-w-0 flex-1"
          value={content}
          maxLength={4000}
          placeholder={user ? 'Viết thảo luận chuyên môn…' : 'Đăng nhập để thảo luận'}
          disabled={!user || !profile || busy}
          onChange={(event) => setContent(event.target.value)}
        />
        <button className="btn-primary px-3" type="submit" disabled={!user || !profile || busy || !content.trim()} aria-label="Gửi bình luận">
          <Send className="h-4 w-4" />
        </button>
      </form>

      {error ? <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p> : null}

      <div className="mt-4 space-y-4">
        {tree.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có thảo luận. Hãy bắt đầu bằng một nhận xét có giá trị.</p>
        ) : tree.map((comment) => (
          <CommentItem key={comment.id} comment={comment} postId={postId} />
        ))}
      </div>
    </div>
  );
}

const CommentItem = memo(function CommentItemView({
  comment,
  postId,
}: {
  comment: CommentNode;
  postId: string;
}) {
  const { user, profile } = useAuth();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleted = comment.status === 'deleted';
  const visibleAuthorName = deleted ? 'Bình luận đã xóa' : comment.authorDisplayName;
  const canReply = Boolean(user && profile && !deleted && comment.depth < 3);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setBusy(true);
    setError(null);
    try {
      await createComment({
        profile,
        postId,
        content: reply,
        parent: { id: comment.id, depth: comment.depth },
      });
      setReply('');
      setReplying(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể trả lời.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={comment.depth > 0 ? 'ml-4 border-l border-slate-200 pl-3 sm:ml-8' : ''}>
      <div className="flex gap-2.5">
        <Avatar name={visibleAuthorName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-slate-900">{visibleAuthorName}</span>
              <span className="text-xs text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
            </div>
            <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${deleted ? 'italic text-slate-400' : 'text-slate-700'}`}>
              {deleted ? 'Bình luận đã được xóa.' : comment.content}
            </p>
          </div>

          <div className="mt-1 flex items-center gap-3 px-1 text-xs font-medium text-slate-500">
            {canReply ? (
              <button type="button" className="inline-flex items-center gap-1 hover:text-emerald-700" onClick={() => setReplying((value) => !value)}>
                <CornerDownRight className="h-3.5 w-3.5" /> Trả lời
              </button>
            ) : null}
            {user?.uid === comment.authorId && !deleted ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-rose-600"
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await softDeleteOwnComment(comment.id);
                  } catch {
                    setError('Không thể xóa bình luận.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Xóa
              </button>
            ) : null}
          </div>

          {replying ? (
            <form className="mt-2 flex gap-2" onSubmit={submitReply}>
              <input
                className="field-input min-w-0 flex-1 py-2 text-sm"
                value={reply}
                maxLength={4000}
                autoFocus
                placeholder={`Trả lời ${comment.authorDisplayName}…`}
                onChange={(event) => setReply(event.target.value)}
              />
              <button className="btn-primary px-3" type="submit" disabled={busy || !reply.trim()} aria-label="Gửi trả lời">
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : null}
          {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
        </div>
      </div>

      {comment.children.length > 0 ? (
        <div className="mt-3 space-y-3">
          {comment.children.map((child) => (
            <CommentItem key={child.id} comment={child} postId={postId} />
          ))}
        </div>
      ) : null}
    </div>
  );
});
