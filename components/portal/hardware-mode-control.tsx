'use client';

import { Gauge } from 'lucide-react';
import { useHardwareMode } from '@/components/providers/hardware-mode-provider';
import type { HardwareModeOverride } from '@/lib/hardware-mode';

const OPTIONS: Array<{ value: HardwareModeOverride; label: string }> = [
  { value: 'auto', label: 'Tự động' },
  { value: 'lite', label: 'Lite' },
  { value: 'standard', label: 'Chuẩn' },
  { value: 'enhanced', label: 'Tăng cường' },
];

export function HardwareModeControl() {
  const { mode, derivedMode, override, setOverride } = useHardwareMode();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <Gauge className="h-4 w-4" /> Chế độ hiển thị
      </div>
      <p className="mt-1 text-xs">Tự động đang nhận diện: {derivedMode}. Chế độ hiệu lực: {mode}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setOverride(option.value)}
            className={override === option.value ? 'segmented-active' : 'segmented'}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Thông tin phần cứng chỉ được xử lý trên thiết bị và không gửi lên máy chủ.</p>
    </section>
  );
}
