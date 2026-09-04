'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { accApi } from '@/lib/api-client';
import { canDecideVerification } from '@/lib/module-c-policy';

type VerificationRow = {
  uid: string;
  status: string;
  professionalType: string;
  evidence: Array<{ type?: unknown; label?: unknown; storagePath?: unknown }>;
  attempt: number;
};

export function VerificationQueue({ user, role }: { user: User; role: string }) {
  const [requests, setRequests] = useState<VerificationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    if (!canDecideVerification(role)) return;
    try {
      const body = await accApi<{ requests: VerificationRow[] }>(user, '/api/verification/requests?limit=30');
      setRequests(body.requests.filter((item) => item.status === 'pending'));
    } catch {
      setMessage('Không tải được hàng đợi xác minh.');
    }
  }

  useEffect(() => { void load(); }, [role, user]);

  async function decide(row: VerificationRow, decision: 'verified' | 'rejected') {
    if (!canDecideVerification(role) || busy) return;
    const reason = decision === 'rejected'
      ? window.prompt('Lý do từ chối hồ sơ')?.trim() ?? ''
      : window.prompt('Ghi chú phê duyệt (không bắt buộc)')?.trim() ?? '';
    if (decision === 'rejected' && !reason) return;

    setBusy(row.uid);
    setMessage('');
    try {
      await accApi(user, `/api/verification/requests/${encodeURIComponent(row.uid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, reason, operationId: crypto.randomUUID() }),
      });
      await load();
      setMessage(decision === 'verified' ? 'Đã xác minh hồ sơ.' : 'Đã từ chối hồ sơ.');
    } catch {
      setMessage('Hồ sơ đã thay đổi hoặc không thể xử lý. Hãy tải lại hàng đợi.');
    } finally {
      setBusy(null);
    }
  }

  if (!canDecideVerification(role)) {
    return <section className="panel"><h2>Xác minh chuyên môn</h2><p className="muted">Chỉ Super Moderator hoặc Admin có quyền quyết định hồ sơ xác minh.</p></section>;
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Hồ sơ chờ xác minh</h2><p>Mặc định: pending · cũ nhất trước · tối đa 30 hồ sơ.</p></div><button className="secondary" onClick={() => void load()}>Tải lại</button></div>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <div className="table-wrap"><table><thead><tr><th>UID</th><th>Nhóm chuyên môn</th><th>Lần nộp</th><th>Minh chứng</th><th>Quyết định</th></tr></thead><tbody>
      {requests.map((row) => <tr key={row.uid}><td>{row.uid}</td><td>{row.professionalType || '—'}</td><td>{row.attempt}</td><td>{row.evidence.map((item, index) => <span key={`${row.uid}-${index}`}>{String(item.label ?? item.type ?? 'Minh chứng')}{index < row.evidence.length - 1 ? ' · ' : ''}</span>)}</td><td><div className="top-actions"><button disabled={Boolean(busy)} onClick={() => void decide(row, 'verified')}>Phê duyệt</button><button className="secondary" disabled={Boolean(busy)} onClick={() => void decide(row, 'rejected')}>Từ chối</button></div></td></tr>)}
    </tbody></table></div>
  </section>;
}
