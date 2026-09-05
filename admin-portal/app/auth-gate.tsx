'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { normalizeAccLoginIdentifier } from '@/lib/login-identifier';

type Claims = { role?: unknown; clubMember?: unknown; mustChangePassword?: unknown };

export interface AccSession {
  user: User;
  role: string;
}

function selectClaims(source: Record<string, unknown>): Claims {
  return { role: source.role, clubMember: source.clubMember, mustChangePassword: source.mustChangePassword };
}

export function AuthGate({ children }: { children: (session: AccSession) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) return setClaims(null);
    const result = await nextUser.getIdTokenResult(true);
    setClaims(selectClaims(result.claims as Record<string, unknown>));
  }), []);

  const role = useMemo(() => typeof claims?.role === 'string' ? claims.role : 'member', [claims]);
  const canEnter = claims?.clubMember === true && ['mod', 'super_mod', 'admin', 'moderator'].includes(role);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, normalizeAccLoginIdentifier(identifier), password);
    } catch {
      setMessage('Đăng nhập thất bại.');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <main className="screen"><section className="login-card"><p className="eyebrow">YHCT SOCIAL · ACC</p><h1>Admin Control Center</h1><form onSubmit={login} className="stack"><label>MSSV hoặc email<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></label><label>Mật khẩu<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{message ? <p className="error">{message}</p> : null}<button disabled={busy}>{busy ? 'Đang xác thực…' : 'Đăng nhập ACC'}</button></form></section></main>;

  if (!canEnter) return <main className="screen"><section className="login-card"><h1>Không có quyền ACC</h1><p className="muted">Tài khoản hiện tại không thuộc nhóm quản trị CLB.</p><button onClick={() => void signOut(auth)}>Đăng xuất</button></section></main>;

  return <>{children({ user, role: role === 'moderator' ? 'mod' : role })}</>;
}
