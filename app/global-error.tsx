'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
          <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-950">Hệ thống đang phục hồi giao diện</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Không có dữ liệu lỗi nhạy cảm được hiển thị. Bạn có thể thử lại an toàn.</p>
            <button className="mt-6 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => reset()}>Thử lại</button>
          </section>
        </main>
      </body>
    </html>
  );
}
