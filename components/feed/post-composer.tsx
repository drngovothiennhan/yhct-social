'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Send, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createPost } from '@/lib/post-service';
import { canUseProfessionalLabel, type PostDraft, type PostType } from '@/lib/domain/post';
import { validatePostImages } from '@/lib/domain/media';

const EMPTY_DRAFT: PostDraft = {
  type: 'qa',
  title: '',
  content: '',
  tags: [],
  professionalLabel: false,
  isDeidentified: true,
};

export function PostComposer() {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT);
  const [tagInput, setTagInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canProfessional = useMemo(() => {
    if (!profile) return false;
    return canUseProfessionalLabel({
      uid: profile.uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      professionalTitle: profile.professionalTitle,
      accountType: profile.accountType,
      verificationStatus: profile.verificationStatus,
    });
  }, [profile]);

  if (!user || !profile) {
    return (
      <section className="card p-5">
        <p className="font-semibold text-slate-900">Chia sẻ cùng cộng đồng YHCT</p>
        <p className="mt-1 text-sm text-slate-600">Đăng nhập để đăng ca lâm sàng, bài thuốc tham khảo hoặc câu hỏi.</p>
      </section>
    );
  }

  function updateType(type: PostType) {
    setDraft((current) => ({
      ...current,
      type,
      isDeidentified: type === 'clinical_case' ? false : true,
    }));
  }

  function chooseFiles(nextFiles: FileList | null) {
    if (!nextFiles) return;
    const merged = [...files, ...Array.from(nextFiles)];
    try {
      validatePostImages(merged);
      setFiles(merged);
      setError(null);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Ảnh đính kèm không hợp lệ.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      setError('Đăng nhập và hoàn tất hồ sơ trước khi đăng bài.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      const tags = tagInput.split(',').map((tag) => tag.trim()).filter(Boolean);
      await createPost({
        profile,
        draft: { ...draft, tags },
        files,
        onUploadProgress: setProgress,
      });
      setDraft(EMPTY_DRAFT);
      setTagInput('');
      setFiles([]);
      setSuccess('Bài viết đã được đăng lên bảng tin.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể đăng bài.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="eyebrow">Bài viết mới</p>
        <h2 className="mt-1 font-bold text-slate-900">Chia sẻ kiến thức hoặc ca lâm sàng</h2>
      </div>

      <form className="space-y-4 p-5" onSubmit={submit}>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Loại bài viết">
          {([
            ['qa', 'Hỏi đáp'],
            ['clinical_case', 'Ca lâm sàng'],
            ['remedy', 'Bài thuốc'],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              className={draft.type === type ? 'segmented-active' : 'segmented'}
              onClick={() => updateType(type)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="field-label">
          Tiêu đề
          <input
            className="field-input"
            value={draft.title}
            maxLength={180}
            required
            placeholder="Ví dụ: Ca đau vai gáy sau 3 tuần điều trị phối hợp"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>

        <label className="field-label">
          Nội dung
          <textarea
            className="field-input min-h-40 resize-y"
            value={draft.content}
            maxLength={12000}
            required
            placeholder="Mô tả rõ bối cảnh, biện chứng, phương pháp, diễn biến và nguồn tham khảo nếu có…"
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          />
          <span className="self-end text-xs font-normal text-slate-400">{draft.content.length}/12.000</span>
        </label>

        <label className="field-label">
          Thẻ chủ đề
          <input
            className="field-input"
            value={tagInput}
            placeholder="châm cứu, tỳ vị, dưỡng sinh"
            onChange={(event) => setTagInput(event.target.value)}
          />
          <span className="text-xs font-normal text-slate-400">Phân cách bằng dấu phẩy, tối đa 10 thẻ.</span>
        </label>

        {draft.type === 'clinical_case' ? (
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              className="mt-0.5 h-4 w-4 accent-emerald-700"
              type="checkbox"
              checked={draft.isDeidentified}
              onChange={(event) => setDraft({ ...draft, isDeidentified: event.target.checked })}
            />
            <span>
              Tôi xác nhận đã <strong>ẩn danh hoàn toàn</strong> họ tên, số hồ sơ, địa chỉ, khuôn mặt và dữ liệu có thể nhận diện người bệnh.
            </span>
          </label>
        ) : null}

        <label className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${canProfessional ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-700"
            disabled={!canProfessional}
            checked={draft.professionalLabel}
            onChange={(event) => setDraft({ ...draft, professionalLabel: event.target.checked })}
          />
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            {canProfessional
              ? 'Gắn nhãn “Nội dung từ người hành nghề đã xác minh”.'
              : 'Nhãn chuyên môn chỉ mở cho tài khoản Lương y/Bác sĩ đã được xác minh.'}
          </span>
        </label>

        <div>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => chooseFiles(event.target.files)}
          />
          <button className="btn-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            Thêm ảnh ({files.length}/6)
          </button>

          {files.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span key={`${file.name}-${file.lastModified}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                  <span className="max-w-48 truncate">{file.name}</span>
                  <button
                    className="rounded-full p-0.5 hover:bg-slate-200"
                    type="button"
                    aria-label={`Bỏ ảnh ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {busy && files.length > 0 ? (
          <div aria-live="polite">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Đang tải ảnh</span><span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        ) : null}

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {success ? <p className="form-success" role="status">{success}</p> : null}

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <p className="text-xs leading-5 text-slate-500">
            Không đăng dữ liệu nhận diện người bệnh. Nội dung không thay thế chẩn đoán hoặc điều trị trực tiếp.
          </p>
          <button className="btn-primary shrink-0" type="submit" disabled={busy}>
            <Send className="h-4 w-4" />
            {busy ? 'Đang đăng…' : 'Đăng bài'}
          </button>
        </div>
      </form>
    </section>
  );
}
