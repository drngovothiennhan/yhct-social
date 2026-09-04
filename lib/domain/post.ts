export type PostType = 'clinical_case' | 'remedy' | 'qa';
export type PractitionerVerificationStatus =
  | 'not_required'
  | 'unsubmitted'
  | 'pending'
  | 'verified'
  | 'rejected';

export interface PostDraft {
  type: PostType;
  title: string;
  content: string;
  tags: string[];
  professionalLabel: boolean;
  isDeidentified: boolean;
}

export interface PostAuthorSnapshot {
  uid: string;
  displayName: string;
  photoURL: string;
  professionalTitle: string;
  accountType: 'member' | 'practitioner' | 'student' | 'patient';
  verificationStatus: PractitionerVerificationStatus;
}

export interface PostPayloadFields {
  authorId: string;
  authorDisplayName: string;
  authorPhotoURL: string;
  authorProfessionalTitle: string;
  professionalLabel: boolean;
  type: PostType;
  title: string;
  content: string;
  mediaPaths: string[];
  tags: string[];
  isDeidentified: boolean;
  status: 'published';
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function canUseProfessionalLabel(author: PostAuthorSnapshot): boolean {
  return (
    author.accountType === 'practitioner'
    && author.verificationStatus === 'verified'
  );
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag) continue;

    const key = tag.toLocaleLowerCase('vi-VN');
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(tag.slice(0, 40));

    if (normalized.length === 10) break;
  }

  return normalized;
}

export function validatePostDraft(
  draft: PostDraft,
  author: PostAuthorSnapshot,
): ValidationResult {
  const title = draft.title.trim();
  const content = draft.content.trim();

  if (!title || title.length > 180) {
    return { ok: false, message: 'Tiêu đề phải có từ 1 đến 180 ký tự.' };
  }

  if (!content || content.length > 12_000) {
    return { ok: false, message: 'Nội dung phải có từ 1 đến 12.000 ký tự.' };
  }

  if (draft.type === 'clinical_case' && !draft.isDeidentified) {
    return {
      ok: false,
      message: 'Ca lâm sàng phải xác nhận đã ẩn danh thông tin người bệnh.',
    };
  }

  if (draft.professionalLabel && !canUseProfessionalLabel(author)) {
    return {
      ok: false,
      message: 'Nhãn chuyên môn chỉ dành cho lương y/bác sĩ đã được xác minh.',
    };
  }

  return { ok: true };
}

export function buildPostPayload(
  draft: PostDraft,
  author: PostAuthorSnapshot,
  mediaPaths: string[],
): PostPayloadFields {
  const validation = validatePostDraft(draft, author);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  if (mediaPaths.length > 6) {
    throw new Error('Mỗi bài đăng chỉ được đính kèm tối đa 6 ảnh.');
  }

  return {
    authorId: author.uid,
    authorDisplayName: author.displayName.trim(),
    authorPhotoURL: author.photoURL.trim().slice(0, 500),
    authorProfessionalTitle: author.professionalTitle.trim().slice(0, 120),
    professionalLabel: draft.professionalLabel,
    type: draft.type,
    title: draft.title.trim(),
    content: draft.content.trim(),
    mediaPaths: [...mediaPaths],
    tags: normalizeTags(draft.tags),
    isDeidentified: draft.type === 'clinical_case' ? draft.isDeidentified : true,
    status: 'published',
  };
}
