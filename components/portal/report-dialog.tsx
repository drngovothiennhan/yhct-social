'use client';

import { useState, type FormEvent } from 'react';
import { Flag, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createReport } from '@/lib/report-service';
import type { ReportTargetType } from '@/lib/domain/report';

const reasons = [
  ['spam', 'Spam'],
  ['misinformation', 'Thông tin sai lệch'],
  ['inappropriate', 'Nội dung không phù hợp'],
  ['privacy', 'Quyền riêng tư'],
  ['other', 'Khác'],
] as const;

export function ReportDialog({
  targetType,
  postId,
  commentId = null,
}: {
  targetType: ReportTargetType;
  postId: string;
  commentId?: string | null;
}) {
  const { user, claims } = useAuth();
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<(typeof reasons)[number][0]>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || !claims?.clubMember || claims.mustChangePassword) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await createReport({ targetType, postId, commentId, reasonCode, details });
      setMessage('Đã gửi báo cáo. Ban quản trị sẽ xem xét.');
      setDetails('');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already-exists')) {
        setMessage('Đã báo cáo nội dung này');
      } else {
        setMessage('Không thể gửi báo cáo. Vui lòng thử lại.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-700"
      >
        <Flag className="h-4 w-4" /> Báo cáo
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Báo cáo nội dung">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Báo cáo nội dung</h2>
                <p className="mt-1 text-xs text-slate-500">Chọn lý do phù hợp để ban quản trị xem xét.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Lý do
              <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as (typeof reasons)[number][0])} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Chi tiết thêm (không bắt buộc)
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} rows={4} className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Mô tả ngắn gọn vấn đề…" />
            </label>
            <p className="mt-1 text-right text-xs text-slate-400">{details.length}/2000</p>

            {message ? <p className="mt-3 text-sm text-slate-700" role="status">{message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Đóng</button>
              <button type="submit" disabled={busy} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
