'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CalendarDays, HeartPulse, Home, UserRound, Users } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { useAuth } from '@/components/providers/auth-provider';
import { PORTAL_NAVIGATION } from '@/lib/navigation';

const icons = {
  '/feed': Home,
  '/activities': CalendarDays,
  '/members': Users,
  '/profile': UserRound,
} as const;

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? 'grid grid-cols-4' : 'space-y-1'} aria-label="Điều hướng chính">
      {PORTAL_NAVIGATION.map((item) => {
        const Icon = icons[item.href];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={mobile
              ? `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-emerald-700' : 'text-slate-500'}`
              : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalShell({ children, contextual }: { children: ReactNode; contextual?: ReactNode }) {
  const { user, profile, claims, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/feed" className="flex items-center gap-2 font-bold text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-700 text-white"><HeartPulse className="h-5 w-5" /></span>
            <span>CLB YHCT</span>
          </Link>
          <div className="text-right text-xs text-slate-500">
            {loading ? 'Đang xác thực…' : user ? (profile?.displayName || user.email || 'Thành viên') : 'Khách'}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <NavLinks />
            {claims && ['mod', 'super_mod', 'admin'].includes(claims.role) ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="px-3 text-xs text-slate-500">Quản trị được tách biệt tại Admin Control Center.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {claims?.mustChangePassword ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Bạn cần đổi mật khẩu tạm thời trước khi đăng bài, bình luận hoặc bày tỏ cảm xúc.
            </div>
          ) : null}
          {children}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            {contextual ?? <AuthCard />}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-slate-900">Nguyên tắc cộng đồng</p>
              <p className="mt-2">Chia sẻ học thuật có trách nhiệm, tôn trọng quyền riêng tư và không thay thế tư vấn y khoa trực tiếp.</p>
            </section>
          </div>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <NavLinks mobile />
      </div>
    </div>
  );
}
