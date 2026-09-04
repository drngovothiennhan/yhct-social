'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { accApi } from '@/lib/api-client';
import { canReadFullAudit } from '@/lib/module-c-policy';

type AuditRow = {
  id: string;
  actorRole?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
};

export function AuditTable({ user, role }: { user: User; role: string }) {
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load(reset = true) {
    if (!canReadFullAudit(role) || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const path = reset || !cursor
        ? '/api/audit?limit=30'
        : `/api/audit?limit=30&cursor=${encodeURIComponent(cursor)}`;
      const body = await accApi<{ events: AuditRow[]; nextCursor: string | null }>(user, path);
      setEvents((current) => reset ? body.events : [...current, ...body.events]);
      setCursor(body.nextCursor);
    } catch {
      setMessage('Không tải được nhật ký quản trị.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(true); }, [role, user]);

  if (!canReadFullAudit(role)) {
    return <section className="panel"><h2>Nhật ký quản trị</h2><p className="muted">Chỉ Admin có quyền duyệt toàn bộ nhật ký quản trị.</p></section>;
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Nhật ký quản trị</h2><p>Append-only · mới nhất trước · tối đa 30 mục mỗi trang.</p></div><button className="secondary" disabled={busy} onClick={() => void load(true)}>Tải lại</button></div>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <div className="table-wrap"><table><thead><tr><th>Hành động</th><th>Vai trò</th><th>Đối tượng</th><th>ID</th><th>Lý do</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.action || '—'}</td><td>{event.actorRole || '—'}</td><td>{event.targetType || '—'}</td><td>{event.targetId || '—'}</td><td>{event.reason || '—'}</td></tr>)}</tbody></table></div>
    {cursor ? <button className="secondary" disabled={busy} onClick={() => void load(false)}>Tải thêm</button> : null}
  </section>;
}
