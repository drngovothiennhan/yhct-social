'use client';

import { useState } from 'react';
import { BookOpenCheck, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import type { RagAnswer } from '@/lib/server/ai/types';

type ResearchMode = 'internal' | 'external';

export function AiResearchPanel() {
  const { user, claims } = useAuth();
  const [mode, setMode] = useState<ResearchMode>('internal');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || !claims?.clubMember || claims.mustChangePassword) return null;

  async function submit() {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setBusy(true);
    setMessage(null);
    setAnswer(null);
    try {
      const token = await user!.getIdToken();
      const endpoint = mode === 'internal' ? '/api/ai/rag/internal' : '/api/ai/rag/external';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: trimmed }),
      });
      const payload = await response.json() as RagAnswer | { error?: string };
      if (!response.ok) throw new Error('error' in payload && payload.error ? payload.error : 'AI_RAG_REQUEST_FAILED');
      setAnswer(payload as RagAnswer);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể truy vấn AI lúc này.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-violet-600" /> Nghiên cứu với AI</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('internal')} className={mode === 'internal' ? 'segmented-active' : 'segmented'}>Nội bộ CLB</button>
        <button type="button" onClick={() => setMode('external')} className={mode === 'external' ? 'segmented-active' : 'segmented'}>Y văn bên ngoài</button>
      </div>
      <textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={4000}
        rows={3}
        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
        placeholder={mode === 'internal' ? 'Hỏi trong tài liệu học thuật của CLB…' : 'Tìm tổng quan y văn có nguồn…'}
      />
      <button type="button" disabled={busy || query.trim().length < 2} onClick={() => void submit()} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
        <Search className="h-4 w-4" /> {busy ? 'Đang tìm…' : 'Truy vấn'}
      </button>
      <p className="mt-2 text-[11px] text-slate-500">AI hỗ trợ nghiên cứu, không thay thế chẩn đoán hoặc điều trị cá nhân.</p>

      {message ? <p role="status" className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{message}</p> : null}
      {answer ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{answer.answer}</p>
          {answer.degraded ? <p className="text-xs font-semibold text-amber-700">Chưa có đủ nguồn grounding để xác nhận câu trả lời.</p> : null}
          {answer.sources.length > 0 ? (
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-900"><BookOpenCheck className="h-3.5 w-3.5" /> Nguồn</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {answer.sources.map((source) => (
                  <li key={source.id}>
                    {source.uri ? <a className="underline underline-offset-2" href={source.uri} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
