'use client';

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import {
  buildVerificationEvidencePath,
  validateVerificationSubmission,
  type VerificationEvidence,
  type VerificationEvidenceType,
} from '@/lib/domain/verification-request';

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function uploadVerificationEvidence(input: {
  uid: string;
  file: File;
  type: VerificationEvidenceType;
  label: string;
}): Promise<VerificationEvidence> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.uid) throw new Error('Bạn cần đăng nhập đúng tài khoản để tải minh chứng.');
  if (!ALLOWED_TYPES.has(input.file.type)) throw new Error('Minh chứng chỉ hỗ trợ PDF, JPEG, PNG hoặc WebP.');
  if (input.file.size <= 0 || input.file.size > MAX_EVIDENCE_BYTES) throw new Error('Mỗi minh chứng phải nhỏ hơn hoặc bằng 10 MiB.');

  const path = buildVerificationEvidencePath(
    user.uid,
    `${crypto.randomUUID()}-${input.file.name}`,
  );
  await uploadBytes(ref(storage, path), input.file, { contentType: input.file.type });

  return {
    storagePath: path,
    type: input.type,
    label: input.label.trim(),
  };
}

export async function submitVerificationRequest(input: {
  professionalType: string;
  evidence: VerificationEvidence[];
}): Promise<{ uid: string; attempt: number }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn cần đăng nhập để gửi hồ sơ xác minh.');

  const requestRef = doc(db, 'verificationRequests', user.uid);
  const profileRef = doc(db, 'users', user.uid);

  return runTransaction(db, async (transaction) => {
    const [requestSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(profileRef),
    ]);
    if (!profileSnapshot.exists()) throw new Error('Không tìm thấy hồ sơ thành viên.');

    const profile = profileSnapshot.data() as Record<string, unknown>;
    if (profile.accountType !== 'practitioner') {
      throw new Error('Chỉ tài khoản người hành nghề mới cần xác minh chuyên môn.');
    }

    const current = requestSnapshot.exists()
      ? requestSnapshot.data() as Record<string, unknown>
      : null;
    const currentStatus = String(current?.status ?? 'unsubmitted');
    if (currentStatus === 'pending') throw new Error('Hồ sơ đang chờ xác minh.');
    if (currentStatus === 'verified') throw new Error('Hồ sơ đã được xác minh.');

    const attempt = Number.isInteger(current?.attempt)
      ? Number(current?.attempt) + 1
      : 1;
    const validated = validateVerificationSubmission({
      uid: user.uid,
      status: 'pending',
      professionalType: input.professionalType,
      evidence: input.evidence,
      attempt,
    });

    transaction.set(requestRef, {
      uid: user.uid,
      status: validated.status,
      professionalType: validated.professionalType,
      evidence: validated.evidence,
      attempt: validated.attempt,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      decisionBy: null,
      decisionAt: null,
      decisionReason: null,
    });
    transaction.update(profileRef, {
      verificationStatus: 'pending',
      updatedAt: serverTimestamp(),
    });

    return { uid: user.uid, attempt };
  });
}
