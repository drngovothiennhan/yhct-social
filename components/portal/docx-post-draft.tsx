'use client';

import { useRef, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import type { DocxDraft } from '@/lib/server/ai/types';

export function DocxPostDraft({ onDraft }: { onDraft: (draft: DocxDraft) => void }) {
  const { user, claims } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file || !user || !claims || claims.mustChangePassword) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/ai/document-to-post', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = await response.json() as DocxDraft | { error?: string };
      if (!response.ok) throw new Error('error' in payload && payload.error ? payload.error : 'AI_DOCX_REQUEST_FAILED');
      onDraft(payload as DocxDraft);
      setMessage('Đã tạo bản nháp. Hãy rà soát và chỉnh sửa trước khi đăng.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo bản nháp từ DOCX.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!user || !claims?.clubMember || claims.mustChangePassword) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-900">
          <Sparkles className="h-4 w-4" /> AI soạn nháp từ tài liệu
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-800 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> {busy ? 'Đang xử lý…' : 'Tạo bản nháp từ DOCX bằng AI'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
      </div>
      <p className="mt-2 text-xs text-violet-800">AI chỉ tạo bản nháp. Nội dung không tự động được đăng và tệp DOCX không được lưu lại.</p>
      {message ? <p role="status" className="mt-2 text-xs text-slate-700">{message}</p> : null}
    </div>
  );
}
