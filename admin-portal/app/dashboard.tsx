'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { accApi } from '@/lib/api-client';
import { canDecideVerification } from '@/lib/module-c-policy';

type Member = {
  uid: string;
  displayName: string;
  memberCode: string;
  role: string;
  clubTitle: string;
  verificationStatus: string;
  disabled: boolean;
};

export function Dashboard({ role }: { user: User; role: string }) {
  return <>
    <section className="stats"><article><b>Backend</b><span>Firebase Admin</span></article><article><b>Quyền hiện tại</b><span>{role}</span></article><article><b>Module C</b><span>Moderation Control Plane</span></article></section>
    <section className="panel"><h2>Tổng quan vận hành</h2><p className="muted">Sử dụng thanh điều hướng để quản lý thành viên, kiểm duyệt báo cáo, xác minh chuyên môn, nhật ký và hệ thống.</p></section>
  </>;
}

export function SecurityPanel({ user }: { user: User }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (nextPassword !== confirmPassword) {
      setMessage('Xác nhận mật khẩu mới chưa khớp.');
      return;
    }
    if (!user.email) {
      setMessage('Tài khoản không có email xác thực.');
      return;
    }

    setBusy(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await user.getIdToken(true);
      await accApi(user, '/api/session/change-password', {
        method: 'POST',
        body: JSON.stringify({ password: nextPassword }),
      });
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setMessage('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
      await signOut(auth);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setMessage('Mật khẩu hiện tại không đúng.');
      } else if (error instanceof Error && error.message === 'RECENT_AUTH_REQUIRED') {
        setMessage('Phiên xác thực đã cũ. Vui lòng thử lại.');
      } else {
        setMessage('Không thể đổi mật khẩu.');
      }
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Đổi mật khẩu ACC</h2><p>Mật khẩu hiện tại chỉ được dùng để xác thực trực tiếp với Firebase và không được gửi tới API ACC.</p></div></div>
    <form className="stack" onSubmit={changePassword}>
      <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
      <label>Mật khẩu mới<input type="password" autoComplete="new-password" minLength={10} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required /></label>
      <label>Xác nhận mật khẩu mới<input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
      {message ? <p className="notice">{message}</p> : null}
      <button disabled={busy}>{busy ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button>
    </form>
  </section>;
}

export function MembersPanel({ user, role }: { user: User; role: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadMembers() {
    setBusy(true);
    try {
      const body = await accApi<{ members: Member[] }>(user, `/api/members?q=${encodeURIComponent(query)}`);
      setMembers(body.members);
    } catch {
      setMessage('Không tải được thành viên.');
    } finally {
      setBusy(false);
    }
  }

  async function patchMember(uid: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await accApi(user, `/api/members/${uid}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await loadMembers();
      setMessage('Đã cập nhật thành viên.');
    } catch {
      setMessage('Không thể cập nhật thành viên.');
      setBusy(false);
    }
  }

  async function updateRole(member: Member) {
    const nextRole = window.prompt('Role mới: member / mod / super_mod / admin', member.role)?.trim();
    if (!nextRole || !['member', 'mod', 'super_mod', 'admin'].includes(nextRole)) return;
    await patchMember(member.uid, { action: 'role', role: nextRole });
  }

  async function updateTitle(member: Member) {
    const title = window.prompt('Chức danh CLB', member.clubTitle)?.trim();
    if (title === undefined) return;
    await patchMember(member.uid, { action: 'title', title });
  }

  async function toggleDisabled(member: Member) {
    await patchMember(member.uid, { action: 'disabled', disabled: !member.disabled });
  }

  async function updateVerification(member: Member) {
    if (!canDecideVerification(role)) return;
    const status = window.prompt('Trạng thái: pending / verified / rejected', member.verificationStatus)?.trim();
    if (!status || !['pending', 'verified', 'rejected'].includes(status)) return;
    await patchMember(member.uid, { action: 'verification', status });
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Thành viên CLB</h2><p>Tra cứu MSSV, chức danh, quyền và trạng thái.</p></div><div className="search"><input placeholder="Tên / MSSV / chức danh" value={query} onChange={(e) => setQuery(e.target.value)} /><button onClick={() => void loadMembers()} disabled={busy}>Tra cứu</button></div></div>
    {message ? <p className="notice">{message}</p> : null}
    <div className="table-wrap"><table><thead><tr><th>Thành viên</th><th>MSSV</th><th>Role</th><th>Chức danh</th><th>Xác minh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{members.map((member) => <tr key={member.uid}><td>{member.displayName}</td><td>{member.memberCode || '—'}</td><td>{member.role}</td><td>{member.clubTitle || '—'}</td><td>{member.verificationStatus}</td><td>{member.disabled ? 'Đã khóa' : 'Hoạt động'}</td><td><div className="top-actions"><button className="secondary" onClick={() => void updateRole(member)}>Role</button><button className="secondary" onClick={() => void updateTitle(member)}>Chức danh</button>{canDecideVerification(role) ? <button className="secondary" onClick={() => void updateVerification(member)}>Xác minh</button> : null}<button className="secondary" onClick={() => void toggleDisabled(member)}>{member.disabled ? 'Mở khóa' : 'Khóa'}</button></div></td></tr>)}</tbody></table></div>
  </section>;
}

export function SystemPanel({ user, role }: { user: User; role: string }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (role !== 'admin') return;
    void accApi<{ maintenanceMode?: boolean }>(user, '/api/system/maintenance').then((body) => setMaintenanceMode(body.maintenanceMode === true)).catch(() => setMessage('Không tải được trạng thái hệ thống.'));
  }, [role, user]);

  async function toggleMaintenance() {
    if (role !== 'admin') return;
    setBusy(true);
    try {
      const body = await accApi<{ maintenanceMode?: boolean }>(user, '/api/system/maintenance', { method: 'PATCH', body: JSON.stringify({ enabled: !maintenanceMode }) });
      setMaintenanceMode(body.maintenanceMode === true);
      setMessage(body.maintenanceMode ? 'Đã bật chế độ bảo trì.' : 'Đã tắt chế độ bảo trì.');
    } catch {
      setMessage('Không cập nhật được chế độ bảo trì.');
    } finally {
      setBusy(false);
    }
  }

  if (role !== 'admin') return <section className="panel"><h2>Hệ thống</h2><p className="muted">Chỉ Admin có quyền điều khiển hệ thống.</p></section>;
  return <section className="panel"><div className="panel-head"><div><h2>Hệ thống</h2><p>Maintenance Mode: {maintenanceMode ? 'BẬT' : 'TẮT'}</p></div><button onClick={() => void toggleMaintenance()} disabled={busy}>{maintenanceMode ? 'Tắt bảo trì' : 'Bật bảo trì'}</button></div>{message ? <p className="notice">{message}</p> : null}</section>;
}
