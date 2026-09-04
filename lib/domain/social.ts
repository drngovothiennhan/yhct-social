import type { ClubRole } from './rbac.ts';

export type PostKind = 'member_post' | 'club_news' | 'activity_update';
export type PostVisibility = 'members' | 'public';
export type ReactionType = 'like' | 'heart' | 'support';
export type SocialPostStatus = 'active' | 'hidden' | 'deleted';

export interface SocialMedia {
  type: 'image';
  storagePath: string;
  downloadURL: string;
  width: number | null;
  height: number | null;
}

export interface SocialPostDraft {
  kind: PostKind;
  visibility: PostVisibility;
  text: string;
  media: SocialMedia[];
  activityId: string | null;
}

export interface SocialAuthorSnapshot {
  uid: string;
  displayName: string;
  photoURL: string;
  role: ClubRole;
}

export interface SocialPostPayload {
  authorId: string;
  authorNameSnapshot: string;
  authorPhotoSnapshot: string | null;
  authorRoleSnapshot: ClubRole;
  kind: PostKind;
  visibility: PostVisibility;
  text: string;
  media: SocialMedia[];
  activityId: string | null;
  reactionCount: number;
  commentCount: number;
  edited: boolean;
  status: SocialPostStatus;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const privilegedKinds = new Set<PostKind>(['club_news', 'activity_update']);
const reactionTypes = new Set<ReactionType>(['like', 'heart', 'support']);

export function canPublishPostKind(role: ClubRole, kind: PostKind): boolean {
  if (!privilegedKinds.has(kind)) return true;
  return role === 'mod' || role === 'super_mod' || role === 'admin';
}

export function validateSocialPostDraft(
  draft: SocialPostDraft,
  author: SocialAuthorSnapshot,
): ValidationResult {
  const text = draft.text.trim();

  if (text.length < 1 || text.length > 12_000) {
    return { ok: false, message: 'Nội dung phải có từ 1 đến 12.000 ký tự.' };
  }

  if (!canPublishPostKind(author.role, draft.kind)) {
    return { ok: false, message: 'Tài khoản không có quyền đăng nội dung CLB.' };
  }

  if (draft.media.length > 6) {
    return { ok: false, message: 'Mỗi bài đăng chỉ được đính kèm tối đa 6 ảnh.' };
  }

  if (draft.media.some((item) => item.type !== 'image')) {
    return { ok: false, message: 'Module B chỉ hỗ trợ ảnh.' };
  }

  if (draft.kind === 'activity_update' && !draft.activityId?.trim()) {
    return { ok: false, message: 'Cập nhật hoạt động phải gắn với một hoạt động.' };
  }

  return { ok: true };
}

export function buildSocialPostPayload(
  draft: SocialPostDraft,
  author: SocialAuthorSnapshot,
): SocialPostPayload {
  const validation = validateSocialPostDraft(draft, author);
  if (!validation.ok) throw new Error(validation.message);

  return {
    authorId: author.uid,
    authorNameSnapshot: author.displayName.trim().slice(0, 80),
    authorPhotoSnapshot: author.photoURL.trim() ? author.photoURL.trim().slice(0, 500) : null,
    authorRoleSnapshot: author.role,
    kind: draft.kind,
    visibility: draft.visibility,
    text: draft.text.trim(),
    media: draft.media.map((item) => ({ ...item })),
    activityId: draft.activityId?.trim() || null,
    reactionCount: 0,
    commentCount: 0,
    edited: false,
    status: 'active',
  };
}

export function normalizeReactionType(value: string): ReactionType | null {
  const normalized = value.trim().toLowerCase() as ReactionType;
  return reactionTypes.has(normalized) ? normalized : null;
}

export function validateCommentText(value: string): ValidationResult {
  const text = value.trim();
  if (text.length < 1 || text.length > 4_000) {
    return { ok: false, message: 'Bình luận phải có từ 1 đến 4.000 ký tự.' };
  }
  return { ok: true };
}
