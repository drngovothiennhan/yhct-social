export type VerificationEvidenceType = 'license' | 'degree' | 'certificate' | 'other';
export type VerificationSubmissionStatus = 'pending';

export interface VerificationEvidence {
  storagePath: string;
  type: VerificationEvidenceType;
  label: string;
}

export interface VerificationSubmissionDraft {
  uid: string;
  status: string;
  professionalType: string;
  evidence: VerificationEvidence[];
  attempt: number;
}

const ALLOWED_EVIDENCE_TYPES = new Set<VerificationEvidenceType>([
  'license',
  'degree',
  'certificate',
  'other',
]);

function cleanSegment(value: string, field: string, max: number): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max || cleaned.includes('/') || cleaned.includes('\\')) {
    throw new Error(`${field} is invalid.`);
  }
  return cleaned;
}

export function buildVerificationEvidencePath(uid: string, fileName: string): string {
  const owner = cleanSegment(uid, 'owner', 128);
  const name = cleanSegment(fileName, 'fileName', 180).replace(/[^A-Za-z0-9._-]/g, '_');
  return `certificates/${owner}/${name}`;
}

export function validateVerificationSubmission(input: VerificationSubmissionDraft) {
  const uid = cleanSegment(input.uid, 'owner', 128);
  if (input.status !== 'pending') throw new Error('Verification submission must be pending.');

  const professionalType = input.professionalType.trim();
  if (!professionalType || professionalType.length > 120) {
    throw new Error('professionalType is invalid.');
  }
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    throw new Error('attempt is invalid.');
  }
  if (!Array.isArray(input.evidence) || input.evidence.length < 1 || input.evidence.length > 6) {
    throw new Error('Evidence must contain 1 to 6 files.');
  }

  const ownerPrefix = `certificates/${uid}/`;
  const evidence = input.evidence.map((item) => {
    if (!item.storagePath.startsWith(ownerPrefix) || item.storagePath.slice(ownerPrefix.length).includes('/')) {
      throw new Error('Evidence must remain in the owner certificate subtree.');
    }
    if (!ALLOWED_EVIDENCE_TYPES.has(item.type)) throw new Error('Evidence type is invalid.');
    const label = item.label.trim();
    if (!label || label.length > 120) throw new Error('Evidence label is invalid.');
    return { storagePath: item.storagePath, type: item.type, label };
  });

  return {
    uid,
    status: 'pending' as const,
    professionalType,
    evidence,
    attempt: input.attempt,
  };
}
