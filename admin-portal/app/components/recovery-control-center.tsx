'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { accApi } from '@/lib/api-client';

type RecoveryMode = 'normal' | 'degraded' | 'safe_mode' | 'restoring';
type RecoveryState = { mode?: RecoveryMode; readOnlyPublic?: boolean; updatedAt?: unknown };
type Backup = { id: string; state?: string; databaseId?: string; snapshotTime?: string | null; expireTime?: string | null };
type Manifest = {
  manifestId: string;
  operationId?: string;
  kind?: string;
  status?: string;
  sourceReleaseSha?: string;
  requestedAt?: unknown;
  completedAt?: unknown;
  validationSummary?: unknown;
};

function operationId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function RecoveryControlCenter({ user, role }: { user: User; role: string }) {
  const [state, setState] = useState<RecoveryState>({});
  const [backups, setBackups] = useState<Backup[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [reason, setReason] = useState('Bảo trì và xác minh phục hồi có kiểm soát');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const isAdmin = role === 'admin';

  const refresh = useCallback(async () => {
    setMessage('');
    try {
      const stateResult = await accApi<{ state: RecoveryState }>(user, '/api/recovery/state');
      setState(stateResult.state ?? {});
      if (isAdmin) {
        const [backupResult, manifestResult] = await Promise.all([
          accApi<{ backups: Backup[] }>(user, '/api/recovery/backups'),
          accApi<{ items: Manifest[] }>(user, '/api/recovery/manifests?limit=20'),
        ]);
        setBackups(backupResult.backups ?? []);
        setManifests(manifestResult.items ?? []);
      }
    } catch {
      setMessage('Không thể tải trạng thái khôi phục.');
    }
  }, [isAdmin, user]);

  useEffect(() => {
    queueMicrotask(() => { void refresh(); });
  }, [refresh]);

  async function run(name: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(name);
    setMessage('');
    try {
      await action();
      setMessage('Thao tác đã được tiếp nhận.');
      await refresh();
    } catch {
      setMessage('Thao tác không thành công. Kiểm tra trạng thái và nhật ký quản trị.');
    } finally {
      setBusy('');
    }
  }

  const candidateManifests = useMemo(
    () => manifests.filter((item) => item.kind === 'managed_backup_restore' || item.kind === 'import_validation'),
    [manifests],
  );

  async function changeMode(mode: RecoveryMode) {
    await run(`mode-${mode}`, () => accApi(user, '/api/recovery/state', {
      method: 'POST',
      body: JSON.stringify({ mode, reason, operationId: operationId('state') }),
    }));
  }

  async function createCheckpoint() {
    await run('checkpoint', () => accApi(user, '/api/recovery/checkpoints', {
      method: 'POST',
      body: JSON.stringify({ operationId: operationId('checkpoint'), reason }),
    }));
  }

  async function restoreBackup(backupId: string) {
    await run(`restore-${backupId}`, () => accApi(user, '/api/recovery/restores', {
      method: 'POST',
      body: JSON.stringify({ operationId: operationId('restore'), reason, backupId }),
    }));
  }

  async function importCheckpoint(manifestId: string) {
    await run(`import-${manifestId}`, () => accApi(user, '/api/recovery/imports', {
      method: 'POST',
      body: JSON.stringify({ operationId: operationId('import'), reason, manifestId }),
    }));
  }

  async function validateCandidate(manifestId: string) {
    await run(`validate-${manifestId}`, () => accApi(user, `/api/recovery/manifests/${manifestId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ operationId: operationId('validate'), reason }),
    }));
  }

  async function decideCandidate(manifestId: string, decision: 'verified' | 'rejected') {
    await run(`${decision}-${manifestId}`, () => accApi(user, `/api/recovery/manifests/${manifestId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, operationId: operationId(decision), reason }),
    }));
  }

  return (
    <section className="stack">
      <div className="panel stack">
        <div>
          <p className="eyebrow">MODULE D · BACKUP / RECOVERY</p>
          <h2>Recovery Control Center</h2>
          <p className="muted">Production cutover không tự động. Mọi restore/import chỉ tạo recovery database riêng để xác minh trước.</p>
        </div>
        <div className="grid-cards">
          <article className="card"><strong>Trạng thái</strong><p>{state.mode ?? 'normal'}</p></article>
          <article className="card"><strong>Safe Mode</strong><p>{state.mode === 'safe_mode' ? 'Đang bật' : 'Không bật'}</p></article>
          <article className="card"><strong>Quyền thao tác</strong><p>{isAdmin ? 'Admin' : 'Chỉ xem trạng thái'}</p></article>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </div>

      {isAdmin ? (
        <>
          <div className="panel stack">
            <h3>Điều khiển Safe Mode</h3>
            <label>Lý do vận hành<input value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="top-actions">
              <button disabled={Boolean(busy)} onClick={() => void changeMode('safe_mode')}>Bật Safe Mode</button>
              <button className="secondary" disabled={Boolean(busy)} onClick={() => void changeMode('degraded')}>Giảm tải</button>
              <button className="secondary" disabled={Boolean(busy)} onClick={() => void changeMode('normal')}>Trở về normal</button>
            </div>
          </div>

          <div className="panel stack">
            <div className="top-actions"><h3>Sao lưu / Checkpoint</h3><button disabled={Boolean(busy)} onClick={() => void createCheckpoint()}>Tạo Checkpoint</button></div>
            <p className="muted">Checkpoint dùng đích lưu trữ do server cấu hình; giao diện không nhận project, bucket hoặc database đích.</p>
            <div className="stack">
              {manifests.filter((item) => item.kind === 'export_checkpoint').map((item) => (
                <article className="card" key={item.manifestId}>
                  <strong>{item.manifestId}</strong><p>{item.status ?? 'unknown'}</p>
                  <button className="secondary" disabled={Boolean(busy)} onClick={() => void importCheckpoint(item.manifestId)}>Khôi phục từ Checkpoint</button>
                </article>
              ))}
            </div>
          </div>

          <div className="panel stack">
            <h3>Managed Backup</h3>
            <div className="stack">
              {backups.length ? backups.map((backup) => (
                <article className="card" key={backup.id}>
                  <strong>{backup.id}</strong><p>{backup.state ?? 'unknown'}</p>
                  <button disabled={Boolean(busy)} onClick={() => void restoreBackup(backup.id)}>Khôi phục vào recovery database</button>
                </article>
              )) : <p className="muted">Chưa có backup khả dụng hoặc provider chưa được cấu hình.</p>}
            </div>
          </div>

          <div className="panel stack">
            <h3>Xác minh recovery candidate</h3>
            <p className="muted">Xác minh chỉ chạy sau khi restore/import hoàn tất; candidate đã xác minh vẫn không tự động chuyển production.</p>
            <div className="stack">
              {candidateManifests.length ? candidateManifests.map((item) => (
                <article className="card" key={item.manifestId}>
                  <strong>{item.manifestId}</strong><p>{item.status ?? 'unknown'}</p>
                  <div className="top-actions">
                    <button className="secondary" disabled={Boolean(busy) || item.status !== 'completed'} onClick={() => void validateCandidate(item.manifestId)}>Xác minh</button>
                    <button disabled={Boolean(busy)} onClick={() => void decideCandidate(item.manifestId, 'verified')}>Duyệt candidate</button>
                    <button className="secondary" disabled={Boolean(busy)} onClick={() => void decideCandidate(item.manifestId, 'rejected')}>Từ chối</button>
                  </div>
                </article>
              )) : <p className="muted">Chưa có recovery candidate.</p>}
            </div>
          </div>
        </>
      ) : (
        <div className="panel"><p className="muted">Chức năng Backup/Recovery chỉ cho phép admin thao tác. Server tiếp tục kiểm tra quyền cho mọi mutation.</p></div>
      )}
    </section>
  );
}
