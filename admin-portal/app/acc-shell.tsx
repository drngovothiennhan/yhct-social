'use client';

import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import type { ReactNode } from 'react';

const destinations = [
  ['/', 'Tổng quan'],
  ['/members', 'Thành viên'],
  ['/scoring', 'Điểm'],
  ['/recognition', 'Khen thưởng'],
  ['/moderation', 'Kiểm duyệt'],
  ['/verification', 'Xác minh'],
  ['/ai', 'AI'],
  ['/recovery', 'Khôi phục'],
  ['/audit', 'Nhật ký'],
  ['/system', 'Hệ thống'],
  ['/security', 'Đổi mật khẩu'],
] as const;

export function AccShell({ role, children }: { role: string; children: ReactNode }) {
  return <main className="admin-shell">
    <header className="topbar"><div><p className="eyebrow">ADMIN CONTROL CENTER</p><h1>YHCT Social · Beta 1.3.0</h1></div><div className="top-actions"><span className="role-pill">{role}</span><button className="secondary" onClick={() => void signOut(auth)}>Đăng xuất</button></div></header>
    <nav className="panel" aria-label="Điều hướng quản trị"><div className="top-actions">{destinations.map(([href, label]) => <Link key={href} href={href} className="secondary">{label}</Link>)}</div></nav>
    {children}
  </main>;
}
