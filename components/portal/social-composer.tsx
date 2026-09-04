'use client';

import { useState, type FormEvent } from 'react';
import { ImagePlus, Send } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { validatePostImages } from '@/lib/domain/media';
import type { PostKind, PostVisibility } from '@/lib/domain/social';
import { createSocialPost } from '@/lib/post-service';

export function SocialComposer({ onPublished }: { onPublished?: () => void }) {
  const { user, profile, claims } = useAuth();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PostKind>('member_post');
  const [visibility, setVisibility] = useState<PostVisibility>('members');
  const [activityId, setActivityId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || !profile || !claims) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Đăng nhập bằng tài khoản thành viên để chia sẻ với CLB.</section>;
  }

  if (!claims.clubMember) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Tài khoản này chưa được xác nhận là thành viên CLB.</section>;
  }

  if (claims.mustChangePassword) {
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Hãy đổi mật khẩu tạm thời trước khi đăng nội dung.</section>;
  }

  const privileged = ['mod', 'super_mod', 'admin'].includes(claims.role);

  function chooseFiles(next: FileList | null) {
    if (!next) return;
    const selected = Array.from(next);
    try {
      validatePostImages(selected);
      setFiles(selected);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ảnh đính kèm không hợp lệ.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !claims) return;
    setBusy(true);
    setMessage(null);
    setProgress(0);
    try {
      await createSocialPost({
        profile,
        claims,
        draft: {
          kind,
          visibility,
          text,
          media: [],
          activityId: kind === 'activity_update' ? activityId.trim() : null,
        },
        files,
        onUploadProgress: setProgress,
      });
      setText('');
      setFiles([]);
      setActivityId('');
      setKind('member_post');
      setMessage('Đã đăng bài lên bảng tin.');
      onPublished?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đăng bài.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setKind('member_post')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === 'member_post' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Bài thành viên</button>
          {privileged ? <button type="button" onClick={() => setKind('club_news')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === 'club_news' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Tin CLB</button> : null}
          {privileged ? <button type="button" onClick={() => setKind('activity_update')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === 'activity_update' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Cập nhật hoạt động</button> : null}
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={12000}
          rows={4}
          placeholder="Chia sẻ kiến thức, kinh nghiệm hoặc hoạt động của CLB…"
          className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          required
        />

        {kind === 'activity_update' ? (
          <input value={activityId} onChange={(event) => setActivityId(event.target.value)} placeholder="Mã hoạt động" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm" required />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ImagePlus className="h-4 w-4" /> Ảnh ({files.length}/6)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => chooseFiles(event.target.files)} />
          </label>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as PostVisibility)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="members">Thành viên CLB</option>
            <option value="public">Công khai</option>
          </select>
          <button disabled={busy} type="submit" className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            <Send className="h-4 w-4" /> {busy ? 'Đang đăng…' : 'Đăng bài'}
          </button>
        </div>
        {busy && files.length > 0 ? <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600" style={{ width: `${Math.round(progress * 100)}%` }} /></div> : null}
        {message ? <p className="text-sm text-slate-600" role="status">{message}</p> : null}
      </form>
    </section>
  );
}
