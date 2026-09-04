import { memberCodeToSyntheticEmail, normalizeMemberCode } from './provisioning.ts';

export function normalizeLoginIdentifier(value: string): string {
  const identifier = value.trim().toLowerCase();
  if (!identifier) throw new Error('Vui lòng nhập MSSV hoặc email.');
  if (identifier.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      throw new Error('MSSV hoặc email không hợp lệ.');
    }
    return identifier;
  }
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(identifier)) {
    throw new Error('MSSV hoặc email không hợp lệ.');
  }
  return memberCodeToSyntheticEmail(normalizeMemberCode(identifier));
}
