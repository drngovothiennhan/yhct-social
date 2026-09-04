'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ReportDialog } from '@/components/portal/report-dialog';
import {
  createPostComment,
  softDeletePostComment,
  subscribeSocialPostComments,
} from '@/lib/comment-service';
import type { SocialCommentRecord } from '@/lib/types';

export function SocialComments({ postId }: { postId: string }) {
  const { user, profile, claims } = useAuth();
  const [comments, setComments] = useState<SocialCommentRecord[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSocialPostComments(postId, setComments, (next) => setError(next.message)), [postId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !claims?.clubMember || claims.mustChangePassword) return;
    setBusy(true);
    setError(null);
    try {
      await createPostComment({ postId, profile, text });
      setText('');
    } catch (next) {
      setError(next instanceof Error ? next.message : 'Không thể gửi bình luận.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 px-5 py-4">
      <div className="space-y-3">
        {comments.length === 0 ? <p className="text-sm text-slate-500">Chưa có bình luận.</p> : null}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800">{comment.authorNameSnapshot}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.status === 'deleted' ? 'Bình luận đã được xóa.' : comment.text}</p>
            </div>
            {comment.status !== 'deleted' ? (
              <div className="flex items-start gap-1">
                {user?.uid !== comment.authorId ? <ReportDialog targetType="comment" postId={postId} commentId={comment.id} /> : null}
                {user?.uid === comment.authorId ? (
                  <button type="button" aria-label="Xóa bình luận" onClick={() => void softDeletePostComment(postId, comment.id)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {profile && claims?.clubMember && !claims.mustChangePassword ? (
        <form onSubmit={submit} className="flex gap-2">
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder="Viết bình luận…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
          <button type="submit" disabled={busy} aria-label="Gửi bình luận" className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white disabled:opacity-60"><Send className="h-4 w-4" /></button>
        </form>
      ) : null}
      {error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
    </div>
  );
}
