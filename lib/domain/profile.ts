export type AccountType = 'member' | 'practitioner' | 'student' | 'patient';
export type Role = 'member' | 'moderator' | 'admin';
export type VerificationStatus =
  | 'not_required'
  | 'unsubmitted'
  | 'pending'
  | 'verified'
  | 'rejected';

export interface NewUserProfileInput {
  uid: string;
  displayName: string;
  photoURL: string;
  accountType: AccountType;
}

export interface NewUserProfileFields {
  displayName: string;
  photoURL: string;
  bio: string;
  specialties: string[];
  accountType: AccountType;
  role: Role;
  verificationStatus: VerificationStatus;
  professionalTitle: string;
}

export function buildNewUserProfile(
  input: NewUserProfileInput,
): NewUserProfileFields {
  const displayName = input.displayName.trim();

  if (!input.uid.trim()) {
    throw new Error('UID người dùng không hợp lệ.');
  }

  if (!displayName || displayName.length > 80) {
    throw new Error('Tên hiển thị phải có từ 1 đến 80 ký tự.');
  }

  return {
    displayName,
    photoURL: input.photoURL.trim().slice(0, 500),
    bio: '',
    specialties: [],
    accountType: input.accountType,
    role: 'member',
    verificationStatus:
      input.accountType === 'practitioner' ? 'unsubmitted' : 'not_required',
    professionalTitle: '',
  };
}
