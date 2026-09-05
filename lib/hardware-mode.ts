export type HardwareMode = 'lite' | 'standard' | 'enhanced';
export type HardwareModeOverride = 'auto' | HardwareMode;

export interface HardwareSignals {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
}

export function deriveHardwareMode(signals: HardwareSignals): HardwareMode {
  if (signals.saveData === true || signals.reducedMotion === true) return 'lite';

  const lowCpu = typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency <= 4;
  const lowMemory = typeof signals.deviceMemory === 'number' && signals.deviceMemory <= 4;
  if (lowCpu || lowMemory) return 'lite';

  const highCpu = typeof signals.hardwareConcurrency === 'number' && signals.hardwareConcurrency >= 8;
  const highMemory = typeof signals.deviceMemory === 'number' && signals.deviceMemory >= 8;
  if (highCpu && highMemory) return 'enhanced';

  return 'standard';
}
