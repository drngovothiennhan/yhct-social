'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { normalizeAccLoginIdentifier } from '@/lib/login-identifier';

type Member = {
  uid: string;
  displayName: string;
  memberCode: string;
  role: string;
  clubTitle: string;
  verificationStatus: string;
  disabled: boolean;
};

type Claims = { role?: unknown; clubMember?: unknown; mustChangePassword?: unknown };

function selectClaims(source: Record<string, unknown>): Claims {
  return {
    role: source.role,
    clubMember: source.clubMember,
    mustChangePassword: source.mustChangePassword,
  };
}

async function api(user: User, path: string, init?: RequestInit) {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error ?? `HTTP_${response.status}`));
  return body;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [replacementPassword, setReplacementPassword] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setMembers([]);
    if (!nextUser) {
      setClaims(null);
      return;
    }
    const result = await nextUser.getIdTokenResult(true);
    setClaims(selectClaims(result.claims as Record<string, unknown>));
  }), []);

  const mustChangePassword = claims?.mustChangePassword === true;
  const role = typeof claims?.role === 'string' ? claims.role : 'member';
  const canEnter = claims?.clubMember === true && ['mod', 'super_mod', 'admin', 'moderator'].includes(role);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, normalizeAccLoginIdentifier(identifier), password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function rotatePassword(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage('');
    try {
      await api(user, '/api/session/change-password', {
        method: 'POST',
        body: JSON.stringify({ password: replacementPassword }),
      });
      const refreshed = await user.getIdTokenResult(true);
      setClaims(selectClaims(refreshed.claims as Record<string, unknown>));
      setReplacementPassword('');
      setMessage('Đã đổi mật khẩu. Phiên quản trị đã được mở.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  async function loadMembers() {
    if (!user) return;
    setBusy(true);
    try {
      const body = await api(user, `/api/members?q=${encodeURIComponent(query)}`) as { members: Member[] };
      setMembers(body.members);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không tải được thành viên.');
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = useMemo(() => ({
    admin: 'Admin', super_mod: 'Super Mod', mod: 'Mod', moderator: 'Mod', member: 'Member',
  }[role] ?? role), [role]);

  if (!user) {
    return <main className="screen"><section className="login-card">
      <p className="eyebrow">YHCT SOCIAL · BETA 2.0</p>
      <h1>Admin Control Center</h1>
      <p className="muted">Kênh điều hành độc lập với Newsfeed.</p>
      <form onSubmit={login} className="stack">
        <label>MSSV hoặc email<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></label>
        <label>Mật khẩu<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {message ? <p className="error">{message}</p> : null}
        <button disabled={busy}>{busy ? 'Đang xác thực…' : 'Đăng nhập ACC'}</button>
      </form>
    </section></main>;
  }

  if (mustChangePassword) {
    return <main className="screen"><section className="login-card">
      <p className="eyebrow">BẢO MẬT LẦN ĐẦU</p>
      <h1>Đổi mật khẩu kích hoạt</h1>
      <p className="muted">Tối thiểu 10 ký tự và không được trùng MSSV.</p>
      <form onSubmit={rotatePassword} className="stack">
        <label>Mật khẩu mới<input type="password" minLength={10} value={replacementPassword} onChange={(e) => setReplacementPassword(e.target.value)} required /></label>
        {message ? <p className="error">{message}</p> : null}
        <button disabled={busy}>{busy ? 'Đang cập nhật…' : 'Đổi mật khẩu và tiếp tục'}</button>
      </form>
      <button className="link-button" onClick={() => void signOut(auth)}>Đăng xuất</button>
    </section></main>;
  }

  if (!canEnter) {
    return <main className="screen"><section className="login-card"><h1>Không có quyền ACC</h1><p className="muted">Tài khoản hiện tại không thuộc nhóm quản trị CLB.</p><button onClick={() => void signOut(auth)}>Đăng xuất</button></section></main>;
  }

  return <main className="admin-shell">
    <header className="topbar"><div><p className="eyebrow">ADMIN CONTROL CENTER</p><h1>YHCT Social Beta 2.0</h1></div><div className="top-actions"><span className="role-pill">{roleLabel}</span><button className="secondary" onClick={() => void signOut(auth)}>Đăng xuất</button></div></header>
    <section className="stats"><article><b>Backend</b><span>Firebase Admin</span></article><article><b>Quyền hiện tại</b><span>{roleLabel}</span></article><article><b>ACC</b><span>Độc lập Newsfeed</span></article></section>
    <section className="panel">
      <div className="panel-head"><div><h2>Thành viên CLB</h2><p>Tra cứu MSSV, chức danh, quyền và trạng thái.</p></div><div className="search"><input placeholder="Tên / MSSV / chức danh" value={query} onChange={(e) => setQuery(e.target.value)} /><button onClick={() => void loadMembers()} disabled={busy}>Tra cứu</button></div></div>
      {message ? <p className="notice">{message}</p> : null}
      <div className="table-wrap"><table><thead><tr><th>Thành viên</th><th>MSSV</th><th>Role</th><th>Chức danh</th><th>Xác minh</th><th>Trạng thái</th></tr></thead><tbody>{members.map((member) => <tr key={member.uid}><td>{member.displayName}</td><td>{member.memberCode || '—'}</td><td>{member.role}</td><td>{member.clubTitle || '—'}</td><td>{member.verificationStatus}</td><td>{member.disabled ? 'Đã khóa' : 'Hoạt động'}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
