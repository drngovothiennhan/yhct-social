'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  submitVerificationRequest,
  uploadVerificationEvidence,
} from '@/lib/verification-service';
import type { VerificationEvidence } from '@/lib/domain/verification-request';
import type { UserProfile } from '@/lib/types';

export function VerificationPanel({
  profile,
  refreshProfile,
}: {
  profile: UserProfile;
  refreshProfile: () => Promise<void>;
}) {
  const [professionalType, setProfessionalType] = useState(profile.professionalTitle || 'Người hành nghề YHCT');
  const [evidence, setEvidence] = useState<VerificationEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (profile.accountType !== 'practitioner') {
    return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-900">Xác minh chuyên môn</h2><p className="mt-2 text-sm text-slate-600">Tài khoản này không thuộc nhóm người hành nghề nên không yêu cầu xác minh chuyên môn.</p></section>;
  }

  async function addEvidence(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || busy) return;
    if (evidence.length + files.length > 6) {
      setMessage('Mỗi hồ sơ tối đa 6 minh chứng.');
      event.target.value = '';
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const uploaded: VerificationEvidence[] = [];
      for (const file of files) {
        uploaded.push(await uploadVerificationEvidence({
          uid: profile.uid,
          file,
          type: 'certificate',
          label: file.name.slice(0, 120),
        }));
      }
      setEvidence((current) => [...current, ...uploaded]);
      setMessage('Đã tải minh chứng riêng tư.');
    } catch (next) {
      setMessage(next instanceof Error ? next.message : 'Không thể tải minh chứng.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || evidence.length === 0) return;
    setBusy(true);
    setMessage('');
    try {
      await submitVerificationRequest({ professionalType, evidence });
      setEvidence([]);
      await refreshProfile();
      setMessage('Hồ sơ đã được gửi và đang ở trạng thái pending.');
    } catch (next) {
      setMessage(next instanceof Error ? next.message : 'Không thể gửi hồ sơ xác minh.');
    } finally {
      setBusy(false);
    }
  }

  const locked = profile.verificationStatus === 'pending' || profile.verificationStatus === 'verified';

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="font-bold text-slate-900">Xác minh chuyên môn</h2>
    <p className="mt-1 text-sm text-slate-600">Trạng thái: <strong>{profile.verificationStatus}</strong></p>
    {profile.verificationStatus === 'pending' ? <p className="mt-2 text-sm text-amber-700">Hồ sơ đang chờ Ban quản trị thẩm định.</p> : null}
    {profile.verificationStatus === 'rejected' ? <p className="mt-2 text-sm text-rose-700">Hồ sơ trước đã bị rejected. Bạn có thể bổ sung minh chứng và nộp lại.</p> : null}
    {profile.verificationStatus === 'verified' ? <p className="mt-2 text-sm text-emerald-700">Hồ sơ chuyên môn đã được xác minh.</p> : null}

    {!locked ? <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-semibold text-slate-700">Nhóm chuyên môn<input value={professionalType} onChange={(event) => setProfessionalType(event.target.value)} maxLength={120} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
      <label className="block text-sm font-semibold text-slate-700">Minh chứng riêng tư<input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => void addEvidence(event)} disabled={busy} className="mt-1 block w-full text-sm font-normal" /></label>
      <p className="text-xs text-slate-500">PDF/JPEG/PNG/WebP · tối đa 10 MiB mỗi tệp · tối đa 6 tệp. Minh chứng không được công khai.</p>
      {evidence.length ? <ul className="space-y-1 text-xs text-slate-600">{evidence.map((item) => <li key={item.storagePath}>{item.label}</li>)}</ul> : null}
      <button type="submit" disabled={busy || evidence.length === 0} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Đang xử lý…' : 'Gửi hồ sơ xác minh'}</button>
    </form> : null}
    {message ? <p role="status" className="mt-3 text-sm text-slate-600">{message}</p> : null}
  </section>;
}
