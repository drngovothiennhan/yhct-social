'use client';

import { Activity, BookOpenText, HeartPulse } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { PostComposer } from '@/components/feed/post-composer';
import { Feed } from '@/components/feed/feed';

export function AppShell() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0,_#f8fafc_34rem)]">
      <header className="sticky top-0 z-30 border-b border-white/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold tracking-tight text-slate-950">Cộng đồng YHCT</p>
              <p className="text-xs text-slate-500">Kết nối • Học thuật • Chia sẻ có trách nhiệm</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:flex">
            <Activity className="h-3.5 w-3.5" /> Realtime Firestore
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <section className="card p-4">
              <p className="eyebrow">Không gian chung</p>
              <div className="mt-3">
                <div className="nav-item-active text-sm"><BookOpenText className="h-4 w-4" /> Bảng tin</div>
                <p className="mt-3 px-1 text-xs leading-5 text-slate-500">
                  Bảng tin tổng hợp ca lâm sàng, bài thuốc tham khảo và hỏi đáp theo thời gian thực.
                </p>
              </div>
            </section>
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <strong>Nguyên tắc an toàn:</strong> Không đăng thông tin nhận diện người bệnh. Nội dung trao đổi không thay thế thăm khám, chẩn đoán hoặc kê đơn trực tiếp.
            </section>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="lg:hidden"><AuthCard /></div>
          <PostComposer />
          <Feed />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <AuthCard />
            <section className="card p-4">
              <p className="text-sm font-semibold text-slate-900">Chuẩn cộng đồng</p>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                <li>• Phân biệt kinh nghiệm cá nhân với khuyến nghị chuyên môn.</li>
                <li>• Trích nguồn khi chia sẻ bài thuốc hoặc tài liệu học thuật.</li>
                <li>• Không công khai dữ liệu cá nhân, ảnh mặt hoặc số hồ sơ bệnh án.</li>
              </ul>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}
