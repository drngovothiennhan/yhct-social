'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircleQuestion, Send } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  addCommunityAnswer,
  createCommunityQuestion,
  listCommunityAnswers,
  listCommunityQuestions,
  type CommunityAnswer,
  type CommunityQuestion,
} from '@/lib/community-service';

export function CommunityScreen() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<CommunityAnswer[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => questions.find((item) => item.id === selectedId) ?? null, [questions, selectedId]);

  async function reloadQuestions() {
    setQuestions(await listCommunityQuestions());
  }

  useEffect(() => {
    let active = true;
    void listCommunityQuestions().then((items) => { if (active) setQuestions(items); }).catch((next: unknown) => {
      if (active) setError(next instanceof Error ? next.message : 'Không thể tải câu hỏi cộng đồng.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setAnswers([]); return; }
    let active = true;
    void listCommunityAnswers(selectedId).then((items) => { if (active) setAnswers(items); }).catch(() => { if (active) setAnswers([]); });
    return () => { active = false; };
  }, [selectedId]);

  async function submitQuestion() {
    if (!user) { setError('Vui lòng đăng nhập để đặt câu hỏi.'); return; }
    setBusy(true); setError(null);
    try {
      const id = await createCommunityQuestion({ title, content });
      setTitle(''); setContent('');
      await reloadQuestions();
      setSelectedId(id);
    } catch (next) {
      setError(next instanceof Error ? next.message : 'Không thể gửi câu hỏi.');
    } finally { setBusy(false); }
  }

  async function submitAnswer() {
    if (!user || !selected) { setError('Vui lòng đăng nhập để trả lời.'); return; }
    setBusy(true); setError(null);
    try {
      await addCommunityAnswer(selected.id, answer);
      setAnswer('');
      setAnswers(await listCommunityAnswers(selected.id));
    } catch (next) {
      setError(next instanceof Error ? next.message : 'Không thể gửi câu trả lời.');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <MessageCircleQuestion className="h-6 w-6 text-emerald-700" />
          <div><h1 className="text-xl font-bold text-slate-950">Hỏi đáp cộng đồng</h1><p className="text-sm text-slate-500">Đặt câu hỏi học thuật, trao đổi kinh nghiệm và thảo luận có trách nhiệm.</p></div>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Đặt câu hỏi mới</h2>
        <div className="mt-3 space-y-3">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Tiêu đề câu hỏi" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={12000} rows={5} placeholder="Mô tả câu hỏi, bối cảnh và nội dung cần trao đổi…" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
          <button disabled={busy || !title.trim() || !content.trim()} onClick={() => void submitQuestion()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />Gửi câu hỏi</button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-950">Câu hỏi mới</h2>
          <div className="space-y-2">
            {questions.length === 0 ? <p className="text-sm text-slate-500">Chưa có câu hỏi.</p> : questions.map((item) => (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === item.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{item.status}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? <p className="text-sm text-slate-500">Chọn một câu hỏi để xem và trả lời.</p> : (
            <div className="space-y-4">
              <div><h2 className="text-lg font-bold text-slate-950">{selected.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.content}</p></div>
              <div className="border-t border-slate-100 pt-4">
                <h3 className="font-semibold text-slate-900">Câu trả lời</h3>
                <div className="mt-3 space-y-3">{answers.length === 0 ? <p className="text-sm text-slate-500">Chưa có câu trả lời.</p> : answers.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.content}</div>)}</div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={8000} rows={4} placeholder="Viết câu trả lời…" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
                <button disabled={busy || !answer.trim()} onClick={() => void submitAnswer()} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Trả lời</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
