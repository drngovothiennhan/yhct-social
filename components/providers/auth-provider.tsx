'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { loadUserProfile } from '@/lib/auth-service';
import type { UserProfile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setProfile(null);
      return;
    }

    try {
      setProfileError(null);
      setProfile(await loadUserProfile(current.uid));
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Không thể tải hồ sơ người dùng.',
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setLoading(true);
      setUser(nextUser);
      setProfile(null);
      setProfileError(null);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await loadUserProfile(nextUser.uid);
        if (active) setProfile(nextProfile);
      } catch (error) {
        if (active) {
          setProfile(null);
          setProfileError(
            error instanceof Error ? error.message : 'Không thể tải hồ sơ người dùng.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    profileError,
    refreshProfile,
  }), [user, profile, loading, profileError, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  }
  return value;
}
