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
import { normalizeClubRole, type ClubRole } from '@/lib/domain/rbac';
import type { UserProfile } from '@/lib/types';

export interface AccessClaims {
  role: ClubRole;
  clubMember: boolean;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  claims: AccessClaims | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  refreshClaims: () => Promise<AccessClaims | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readAccessClaims(user: User, forceRefresh = false): Promise<AccessClaims> {
  const result = await user.getIdTokenResult(forceRefresh);
  return {
    role: normalizeClubRole(typeof result.claims.role === 'string' ? result.claims.role : 'member'),
    clubMember: result.claims.clubMember === true,
    mustChangePassword: result.claims.mustChangePassword === true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [claims, setClaims] = useState<AccessClaims | null>(null);
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
      setProfileError(error instanceof Error ? error.message : 'Không thể tải hồ sơ người dùng.');
    }
  }, []);

  const refreshClaims = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setClaims(null);
      return null;
    }
    const nextClaims = await readAccessClaims(current, true);
    setClaims(nextClaims);
    return nextClaims;
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setLoading(true);
      setUser(nextUser);
      setProfile(null);
      setClaims(null);
      setProfileError(null);

      if (!nextUser) {
        setLoading(false);
        return;
      }

      try {
        const [nextProfile, nextClaims] = await Promise.all([
          loadUserProfile(nextUser.uid),
          readAccessClaims(nextUser),
        ]);
        if (active) {
          setProfile(nextProfile);
          setClaims(nextClaims);
        }
      } catch (error) {
        if (active) {
          setProfile(null);
          setClaims(null);
          setProfileError(error instanceof Error ? error.message : 'Không thể tải hồ sơ người dùng.');
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
    claims,
    loading,
    profileError,
    refreshProfile,
    refreshClaims,
  }), [user, profile, claims, loading, profileError, refreshProfile, refreshClaims]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  return value;
}
