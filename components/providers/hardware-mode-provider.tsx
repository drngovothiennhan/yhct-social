'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deriveHardwareMode, type HardwareMode, type HardwareModeOverride, type HardwareSignals } from '@/lib/hardware-mode';

const STORAGE_KEY = 'yhct:hardware-mode-override';

interface HardwareModeContextValue {
  mode: HardwareMode;
  derivedMode: HardwareMode;
  override: HardwareModeOverride;
  setOverride: (value: HardwareModeOverride) => void;
}

const HardwareModeContext = createContext<HardwareModeContextValue | null>(null);

function isOverride(value: string | null): value is HardwareModeOverride {
  return value === 'auto' || value === 'lite' || value === 'standard' || value === 'enhanced';
}

function readSignals(): HardwareSignals {
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    return {
      hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
      deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
      saveData: typeof nav.connection?.saveData === 'boolean' ? nav.connection.saveData : undefined,
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    };
  } catch {
    return { reducedMotion: false };
  }
}

export function HardwareModeProvider({ children }: { children: ReactNode }) {
  const [derivedMode, setDerivedMode] = useState<HardwareMode>('standard');
  const [override, setOverrideState] = useState<HardwareModeOverride>('auto');

  useEffect(() => {
    const nextDerived = deriveHardwareMode(readSignals());
    setDerivedMode(nextDerived);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isOverride(saved)) setOverrideState(saved);
    } catch {
      setOverrideState('auto');
    }
  }, []);

  const mode = override === 'auto' ? derivedMode : override;

  useEffect(() => {
    document.documentElement.dataset.hardwareMode = mode;
    return () => {
      delete document.documentElement.dataset.hardwareMode;
    };
  }, [mode]);

  function setOverride(value: HardwareModeOverride) {
    setOverrideState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Local override is an enhancement; blocked storage must not break the app.
    }
  }

  const value = useMemo<HardwareModeContextValue>(() => ({
    mode,
    derivedMode,
    override,
    setOverride,
  }), [mode, derivedMode, override]);

  return <HardwareModeContext.Provider value={value}>{children}</HardwareModeContext.Provider>;
}

export function useHardwareMode(): HardwareModeContextValue {
  const value = useContext(HardwareModeContext);
  if (!value) throw new Error('useHardwareMode must be used inside HardwareModeProvider');
  return value;
}
