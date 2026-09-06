'use client';

import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { accApi } from '@/lib/api-client';

export function ScoringControl({ user }: { user: User }) {
  const [memberId, setMemberId] = useState('');
  const [weekNumber, setWeekNumber] = useState('1');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [undoId, setUndoId] = useState('');
  const [undoReason, setUndoReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function createScore(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const result = await accApi<{ transactionId: string }>(user, '/api/scoring/transactions', {
        method: 'POST',
        body: JSON.stringify({ memberId, weekNumber: Number(weekNumber), points: Number(points), reason }),
      });
      setMessage(`Đã ghi giao dịch ${result.transactionId}.`);
      setPoints(''); setReason('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể ghi điểm.');
    } finally { setBusy(false); }
  }

  async function undoScore(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const result = await accApi<{ transactionId: string }>(user, '/api/scoring/undo', {
        method: 'POST',
        body: JSON.stringify({ transactionId: undoId, reason: undoReason }),
      });
      setMessage(`Đã hoàn tác bằng giao dịch ${result.transactionId}.`);
      setUndoId(''); setUndoReason('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể hoàn tác.');
    } finally { setBusy(false); }
  }

  return <div className="stack">
    <section className="panel">
      <div className="panel-head"><div><h2>Điểm rèn luyện nguyên tử</h2><p>Mỗi thay đổi sinh giao dịch bất biến và audit. MOD bị giới hạn theo Ban ở server.</p></div></div>
      <form className="stack" onSubmit={createScore}>
        <label>UID thành viên<input value={memberId} onChange={(event) => setMemberId(event.target.value)} required /></label>
        <label>Tuần hoạt động<input type="number" min="1" max="53" value={weekNumber} onChange={(event) => setWeekNumber(event.target.value)} required /></label>
        <label>Điểm cộng/trừ<input type="number" step="0.5" min="-1000" max="1000" value={points} onChange={(event) => setPoints(event.target.value)} required /></label>
        <label>Lý do<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required /></label>
        <button disabled={busy}>{busy ? 'Đang ghi…' : 'Ghi giao dịch điểm'}</button>
      </form>
    </section>
    <section className="panel">
      <div className="panel-head"><div><h2>Hoàn tác giao dịch</h2><p>Không xóa lịch sử; hệ thống tạo một giao dịch đảo ngược liên kết với giao dịch gốc.</p></div></div>
      <form className="stack" onSubmit={undoScore}>
        <label>ID giao dịch gốc<input value={undoId} onChange={(event) => setUndoId(event.target.value)} required /></label>
        <label>Lý do hoàn tác<textarea value={undoReason} onChange={(event) => setUndoReason(event.target.value)} maxLength={500} required /></label>
        <button className="secondary" disabled={busy}>{busy ? 'Đang xử lý…' : 'Hoàn tác'}</button>
      </form>
    </section>
    {message ? <p className="notice">{message}</p> : null}
  </div>;
}

export function RecognitionControl({ user, role }: { user: User; role: string }) {
  const [memberId, setMemberId] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [postIds, setPostIds] = useState('');
  const [sourceScore, setSourceScore] = useState('0');
  const [activityCount, setActivityCount] = useState('0');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function approve(event: FormEvent) {
    event.preventDefault();
    if (role !== 'admin') return;
    setBusy(true); setMessage('');
    try {
      const result = await accApi<{ recognitionId: string }>(user, '/api/recognition/approve', {
        method: 'POST',
        body: JSON.stringify({
          memberId,
          title,
          reason,
          sourcePostIds: postIds.split(',').map((value) => value.trim()).filter(Boolean),
          sourceScore: Number(sourceScore),
          activityCount: Number(activityCount),
        }),
      });
      setMessage(`Đã phê duyệt khen thưởng ${result.recognitionId}.`);
      setTitle(''); setReason(''); setPostIds('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể phê duyệt khen thưởng.');
    } finally { setBusy(false); }
  }

  if (role !== 'admin') return <section className="panel"><h2>Khen thưởng</h2><p className="muted">SUPER_MOD có thể kiểm duyệt nội dung; phê duyệt khen thưởng chính thức chỉ thuộc ADMIN.</p></section>;

  return <section className="panel">
    <div className="panel-head"><div><h2>Phê duyệt khen thưởng</h2><p>Căn cứ bài đã xuất bản, điểm và hoạt động; thao tác này không tự thay đổi điểm.</p></div></div>
    <form className="stack" onSubmit={approve}>
      <label>UID thành viên<input value={memberId} onChange={(event) => setMemberId(event.target.value)} required /></label>
      <label>Danh hiệu / hình thức khen thưởng<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required /></label>
      <label>ID bài viết căn cứ, cách nhau dấu phẩy<input value={postIds} onChange={(event) => setPostIds(event.target.value)} /></label>
      <label>Điểm hiện tại<input type="number" step="0.5" value={sourceScore} onChange={(event) => setSourceScore(event.target.value)} required /></label>
      <label>Số hoạt động đã ghi nhận<input type="number" min="0" value={activityCount} onChange={(event) => setActivityCount(event.target.value)} required /></label>
      <label>Lý do<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required /></label>
      <button disabled={busy}>{busy ? 'Đang phê duyệt…' : 'Phê duyệt khen thưởng'}</button>
    </form>
    {message ? <p className="notice">{message}</p> : null}
  </section>;
}
