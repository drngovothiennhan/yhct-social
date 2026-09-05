'use client';

export default function GlobalPageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="card max-w-md p-6 text-center">
        <h2 className="text-lg font-bold text-slate-900">Ứng dụng gặp lỗi tạm thời</h2>
        <p className="mt-2 text-sm text-slate-600">Hệ thống đã cô lập lỗi để bảo vệ phiên làm việc. Bạn có thể thử tải lại phần giao diện này.</p>
        <button className="btn-primary mt-4" type="button" onClick={() => reset()}>Thử lại</button>
      </div>
    </div>
  );
}
