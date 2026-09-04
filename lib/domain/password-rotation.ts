export interface PasswordRotationClaims {
  mustChangePassword?: unknown;
}

export function canUseProtectedFeatures(claims: PasswordRotationClaims): boolean {
  return claims.mustChangePassword !== true;
}

export function assertAcceptableNewPassword(password: string, memberCode = ''): void {
  if (password.length < 10) {
    throw new Error('Mật khẩu mới phải có ít nhất 10 ký tự.');
  }
  if (memberCode && password.trim().toLowerCase() === memberCode.trim().toLowerCase()) {
    throw new Error('Mật khẩu mới không được trùng MSSV.');
  }
}
