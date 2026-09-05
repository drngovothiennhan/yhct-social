'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { accApi } from '@/lib/api-client';

interface AiHealth {
  configured: boolean;
  fastModel: string;
  fileSearchConfigured: boolean;
  driveConfigured: boolean;
  quota: { dateKey: string; count: number };
}

interface AnalysisRow {
  id: string;
  targetType: string;
  targetId: string | null;
  category: string;
  confidence: number;
  safetySignals: string[];
  rationale: string;
  modelVersion: string | null;
  createdAt: string | null;
}

interface KnowledgeSource {
  sourceId: string;
  title: string;
  status: string;
  mimeType: string;
  driveModifiedTime: string | null;
  updatedAt: string | null;
}

export function AiControlCenter({ user, role }: { user: User; role: string }) {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [driveFileId, setDriveFileId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const canDelete = role === 'super_mod' || role === 'admin';

  async function load() {
    const [nextHealth, nextAnalyses, nextSources] = await Promise.all([
      accApi<AiHealth>(user, '/api/ai/health'),
      accApi<{ analyses: AnalysisRow[] }>(user, '/api/ai/analyses?limit=30'),
      accApi<{ sources: KnowledgeSource[] }>(user, '/api/ai/knowledge?limit=50'),
    ]);
    setHealth(nextHealth);
    setAnalyses(nextAnalyses.analyses);
    setSources(nextSources.sources);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      accApi<AiHealth>(user, '/api/ai/health'),
      accApi<{ analyses: AnalysisRow[] }>(user, '/api/ai/analyses?limit=30'),
      accApi<{ sources: KnowledgeSource[] }>(user, '/api/ai/knowledge?limit=50'),
    ])
      .then(([nextHealth, nextAnalyses, nextSources]) => {
        if (!active) return;
        setHealth(nextHealth);
        setAnalyses(nextAnalyses.analyses);
        setSources(nextSources.sources);
      })
      .catch(() => { if (active) setMessage('Không tải được trạng thái AI.'); });
    return () => { active = false; };
  }, [user]);

  async function syncSource() {
    const value = driveFileId.trim();
    if (!value || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await accApi(user, '/api/ai/knowledge/sync', {
        method: 'POST',
        body: JSON.stringify({ driveFileId: value }),
      });
      setDriveFileId('');
      await load();
      setMessage('Đã đồng bộ nguồn tri thức.');
    } catch {
      setMessage('Không thể đồng bộ nguồn. Kiểm tra quyền Drive, folder cho phép và cấu hình File Search.');
    } finally {
      setBusy(false);
    }
  }

  async function removeSource(sourceId: string) {
    if (!canDelete || busy) return;
    if (!window.confirm('Xóa nguồn này khỏi File Search nội bộ?')) return;
    setBusy(true);
    setMessage('');
    try {
      await accApi(user, `/api/ai/knowledge/${encodeURIComponent(sourceId)}`, { method: 'DELETE' });
      await load();
      setMessage('Đã xóa nguồn tri thức.');
    } catch {
      setMessage('Không thể xóa nguồn ở trạng thái hiện tại.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack">
    <section className="panel">
      <div className="panel-head"><div><h2>AI health & quota</h2><p>Chỉ hiển thị trạng thái cấu hình, không hiển thị secret.</p></div><button className="secondary" onClick={() => void load()}>Tải lại</button></div>
      {message ? <p className="notice" role="status">{message}</p> : null}
      {health ? <div className="stat-grid">
        <div className="stat"><span>Gemini</span><strong>{health.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong></div>
        <div className="stat"><span>Model</span><strong>{health.fastModel}</strong></div>
        <div className="stat"><span>File Search</span><strong>{health.fileSearchConfigured ? 'Sẵn sàng' : 'Thiếu cấu hình'}</strong></div>
        <div className="stat"><span>Drive</span><strong>{health.driveConfigured ? 'Sẵn sàng' : 'Thiếu cấu hình'}</strong></div>
        <div className="stat"><span>AI requests hôm nay</span><strong>{health.quota.count}</strong></div>
      </div> : <p>Đang tải…</p>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Knowledge sources</h2><p>Đồng bộ file từ Drive folder đã duyệt vào Gemini File Search.</p></div></div>
      <div className="top-actions">
        <input className="input" value={driveFileId} onChange={(event) => setDriveFileId(event.target.value)} placeholder="Drive file ID" maxLength={240} />
        <button className="primary" disabled={busy || !driveFileId.trim()} onClick={() => void syncSource()}>Đồng bộ</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Nguồn</th><th>Trạng thái</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>
        {sources.map((source) => <tr key={source.sourceId}><td>{source.title}<br /><small>{source.mimeType || '—'}</small></td><td>{source.status}</td><td>{source.updatedAt || source.driveModifiedTime || '—'}</td><td>{canDelete ? <button className="secondary" disabled={busy} onClick={() => void removeSource(source.sourceId)}>Xóa</button> : '—'}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Advisory analyses</h2><p>AI chỉ phân tích/phân loại; quyết định kiểm duyệt vẫn nằm ở moderator.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Loại</th><th>Phân loại</th><th>Tín hiệu</th><th>Giải thích</th></tr></thead><tbody>
        {analyses.map((row) => <tr key={row.id}><td>{row.targetType}{row.targetId ? ` · ${row.targetId}` : ''}</td><td>{row.category} · {Math.round(row.confidence * 100)}%</td><td>{row.safetySignals.join(', ') || '—'}</td><td>{row.rationale || '—'}</td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}
