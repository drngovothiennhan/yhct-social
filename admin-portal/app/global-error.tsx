'use client';

export default function AccGlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main className="admin-shell">
          <section className="panel">
            <p className="eyebrow">YHCT SOCIAL · RECOVERY</p>
            <h1>ACC đang phục hồi giao diện</h1>
            <p>Không có dữ liệu lỗi nhạy cảm được hiển thị. Hãy thử lại hoặc dùng Trung tâm Khôi phục sau khi giao diện hoạt động.</p>
            <button className="primary" onClick={() => reset()}>Thử lại</button>
          </section>
        </main>
      </body>
    </html>
  );
}
