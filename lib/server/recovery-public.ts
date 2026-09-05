import { rootAdminDb } from './firebase-admin.ts';

export type PublicRecoveryMode = 'normal' | 'degraded' | 'safe_mode' | 'restoring';

export interface PublicRecoveryState {
  mode: PublicRecoveryMode;
  readOnly: boolean;
  message: string;
  retryAfterSeconds?: number;
}

type InternalRecoveryState = Record<string, unknown>;

function recoveryMode(value: unknown): PublicRecoveryMode {
  return value === 'degraded' || value === 'safe_mode' || value === 'restoring' ? value : 'normal';
}

function retryHint(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const seconds = Math.trunc(value);
  if (seconds < 1 || seconds > 3600) return undefined;
  return seconds;
}

const PUBLIC_MESSAGES: Record<PublicRecoveryMode, string> = {
  normal: '',
  degraded: 'Hệ thống đang hoạt động ở chế độ giảm tải. Một số tính năng có thể tạm thời bị hạn chế.',
  safe_mode: 'Hệ thống đang ở chế độ an toàn. Một số thao tác ghi tạm thời không khả dụng.',
  restoring: 'Hệ thống đang thực hiện quy trình khôi phục có kiểm soát. Một số thao tác ghi tạm thời không khả dụng.',
};

export function sanitizePublicRecoveryState(input: InternalRecoveryState): PublicRecoveryState {
  const mode = recoveryMode(input.mode);
  const readOnly = mode === 'safe_mode' || mode === 'restoring' || input.readOnlyPublic === true;
  const retryAfterSeconds = retryHint(input.retryAfterSeconds);
  return {
    mode,
    readOnly,
    message: PUBLIC_MESSAGES[mode],
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

export async function getPublicRecoveryState(): Promise<PublicRecoveryState> {
  try {
    const snapshot = await rootAdminDb().doc('system/recovery').get();
    if (!snapshot.exists) return sanitizePublicRecoveryState({ mode: 'normal', readOnlyPublic: false });
    return sanitizePublicRecoveryState(snapshot.data() ?? {});
  } catch {
    return sanitizePublicRecoveryState({ mode: 'degraded', readOnlyPublic: false, retryAfterSeconds: 60 });
  }
}
