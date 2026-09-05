'use client';

import { useEffect, useState } from 'react';

interface RecoveryStatus {
  mode: 'normal' | 'degraded' | 'safe_mode' | 'restoring';
  readOnly: boolean;
  message: string;
  retryAfterSeconds?: number;
}

const NORMAL: RecoveryStatus = { mode: 'normal', readOnly: false, message: '' };

export function RecoveryBanner() {
  const [status, setStatus] = useState<RecoveryStatus>(NORMAL);

  useEffect(() => {
    let active = true;
    void fetch('/api/recovery/status', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<RecoveryStatus> : NORMAL)
      .then((next) => { if (active) setStatus(next); })
      .catch(() => { if (active) setStatus({ mode: 'degraded', readOnly: false, message: 'Hệ thống đang hoạt động hạn chế. Vui lòng thử lại sau.' }); });
    return () => { active = false; };
  }, []);

  if (status.mode === 'normal') return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
      <p className="font-semibold">Thông báo hệ thống</p>
      <p className="mt-1">{status.message}</p>
      {status.readOnly ? (
        <p className="mt-1 text-xs text-amber-800">Một số thao tác thay đổi dữ liệu đang được tạm hạn chế trong khi hệ thống được kiểm tra.</p>
      ) : null}
    </div>
  );
}
