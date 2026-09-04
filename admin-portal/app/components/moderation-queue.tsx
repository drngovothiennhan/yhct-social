'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { accApi } from '@/lib/api-client';
import { canRestore } from '@/lib/module-c-policy';

type ReportRow = {
  id: string;
  targetType: 'post' | 'comment';
  postId: string;
  commentId: string | null;
  reasonCode: string;
  details: string;
  status: string;
};

export function ModerationQueue({ user, role }: { user: User; role: string }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const body = await accApi<{ reports: ReportRow[] }>(user, '/api/moderation/reports?status=open&limit=30');
      setReports(body.reports);
    } catch {
      setMessage('Không tải được hàng đợi kiểm duyệt.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function resolve(report: ReportRow, action: 'keep' | 'hide' | 'soft_delete' | 'dismiss') {
    if (busy) return;
    const reason = window.prompt('Lý do xử lý', report.reasonCode)?.trim();
    if (!reason) return;
    setBusy(report.id);
    setMessage('');
    try {
      await accApi(user, '/api/moderation/actions', {
        method: 'POST',
        body: JSON.stringify({ reportId: report.id, action, reason, operationId: crypto.randomUUID() }),
      });
      await load();
      setMessage('Đã xử lý báo cáo.');
    } catch {
      setMessage('Báo cáo đã thay đổi hoặc không thể xử lý. Hãy tải lại hàng đợi.');
    } finally {
      setBusy(null);
    }
  }

  async function restore(report: ReportRow) {
    if (!canRestore(role) || busy) return;
    const reason = window.prompt('Lý do khôi phục')?.trim();
    if (!reason) return;
    setBusy(report.id);
    setMessage('');
    try {
      await accApi(user, '/api/moderation/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'restore',
          targetType: report.targetType,
          postId: report.postId,
          commentId: report.commentId,
          reason,
          operationId: crypto.randomUUID(),
        }),
      });
      setMessage('Đã khôi phục nội dung.');
    } catch {
      setMessage('Không thể khôi phục nội dung ở trạng thái hiện tại.');
    } finally {
      setBusy(null);
    }
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Hàng đợi kiểm duyệt</h2><p>Mặc định: open · cũ nhất trước · tối đa 30 mục.</p></div><button className="secondary" onClick={() => void load()}>Tải lại</button></div>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <div className="table-wrap"><table><thead><tr><th>Loại</th><th>Lý do</th><th>Chi tiết</th><th>Thao tác</th></tr></thead><tbody>
      {reports.map((report) => <tr key={report.id}><td>{report.targetType}</td><td>{report.reasonCode}</td><td>{report.details || '—'}</td><td><div className="top-actions">
        <button className="secondary" disabled={Boolean(busy)} onClick={() => void resolve(report, 'keep')}>Giữ</button>
        <button className="secondary" disabled={Boolean(busy)} onClick={() => void resolve(report, 'hide')}>Ẩn</button>
        <button className="secondary" disabled={Boolean(busy)} onClick={() => void resolve(report, 'soft_delete')}>Xóa mềm</button>
        <button className="secondary" disabled={Boolean(busy)} onClick={() => void resolve(report, 'dismiss')}>Bỏ qua</button>
        {canRestore(role) ? <button className="secondary" disabled={Boolean(busy)} onClick={() => void restore(report)}>Khôi phục</button> : null}
      </div></td></tr>)}
    </tbody></table></div>
  </section>;
}
