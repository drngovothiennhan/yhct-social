'use client';

export default function AccError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="admin-shell">
      <section className="panel">
        <p className="eyebrow">ADMIN CONTROL CENTER</p>
        <h1>Không thể tải khu vực quản trị</h1>
        <p>Hệ thống đã chặn lỗi để bảo vệ phiên làm việc. Hãy thử lại; nếu lỗi tiếp diễn, mở Trung tâm Khôi phục.</p>
        <div className="top-actions"><button className="primary" onClick={() => reset()}>Thử lại</button></div>
      </section>
    </main>
  );
}
