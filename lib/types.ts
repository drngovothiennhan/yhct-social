import type { Timestamp } from 'firebase/firestore';
import type { ClubRole } from '@/lib/domain/rbac';
import type {
  PostKind,
  PostVisibility,
  ReactionType,
  SocialMedia,
  SocialPostStatus,
} from '@/lib/domain/social';
import type { ReportReasonCode, ReportTargetType } from '@/lib/domain/report';

export type AccountType = 'member' | 'practitioner' | 'student' | 'patient';
export type UserRole = ClubRole | 'moderator';
export type VerificationStatus =
  | 'not_required'
  | 'unsubmitted'
  | 'pending'
  | 'verified'
  | 'rejected';
export type PostType = 'clinical_case' | 'remedy' | 'qa';
export type PostStatus = 'published' | 'hidden' | 'removed';
export type CommentStatus = 'active' | 'hidden' | 'deleted';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportResolution = 'keep' | 'hide' | 'soft_delete' | null;

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  specialties: string[];
  accountType: AccountType;
  role: UserRole;
  verificationStatus: VerificationStatus;
  professionalTitle: string;
  clubTitle?: string;
  memberCode?: string;
  accountStatus?: 'active' | 'disabled';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// Legacy v1 record shapes remain exported during the Module B migration window.
export interface PostRecord {
  id: string;
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
  status: PostStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  authorPhotoURL: string;
  parentId: string;
  depth: number;
  content: string;
  status: CommentStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SocialPostRecord {
  id: string;
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
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SocialReactionRecord {
  uid: string;
  type: ReactionType;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SocialCommentRecord {
  id: string;
  postId: string;
  authorId: string;
  authorNameSnapshot: string;
  authorPhotoSnapshot: string | null;
  text: string;
  edited: boolean;
  status: CommentStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ReportRecord {
  id: string;
  reporterUid: string;
  targetType: ReportTargetType;
  postId: string;
  commentId: string | null;
  reasonCode: ReportReasonCode;
  details: string;
  status: ReportStatus;
  assignedTo: string | null;
  resolvedBy: string | null;
  resolvedAt: Timestamp | null;
  resolution: ReportResolution;
  resolutionReason: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
