# YHCT Social

Mạng xã hội Y học Cổ truyền xây mới trên **Next.js App Router + Firebase + Vercel**. Runtime không sử dụng AppSheet, Google Sheets hoặc Drive API.

## Trạng thái hiện tại

Đã triển khai Giai đoạn 1–3:

- Firebase Auth: Google và Email/Password.
- Onboarding phân loại **Lương y/Bác sĩ YHCT** hoặc **Thành viên**.
- Firestore schema, composite indexes và security rules.
- Firebase Storage cho ảnh bài viết và vùng chứng chỉ riêng tư.
- Form bài viết: ca lâm sàng, bài thuốc, hỏi đáp.
- Ca lâm sàng bắt buộc xác nhận ẩn danh.
- Chỉ practitioner có `verificationStatus=verified` mới dùng được nhãn chuyên môn.
- Upload tối đa 6 ảnh JPEG/PNG/WebP, 10 MB/ảnh, có rollback nếu ghi bài thất bại.
- Bảng tin Firestore realtime, lọc theo loại bài.
- Like tách state khỏi feed.
- Thảo luận lồng tối đa 3 tầng; listener chỉ được tạo khi mở thảo luận.
- Xóa bình luận theo kiểu tombstone để không làm gãy cây trả lời.

## Yêu cầu môi trường

- Node.js `>=22.12.0 <23`
- Một Firebase Web App đã bật Firestore, Authentication và Storage.
- Authentication providers: Google và Email/Password.

## Chạy local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Điền đầy đủ các biến `NEXT_PUBLIC_FIREBASE_*` trong `.env.local` trước khi mở ứng dụng.

## Kiểm tra

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` kiểm tra domain invariants và security-contract. `npm run build` cần các biến Firebase public hợp lệ vì client Firebase được khởi tạo theo cơ chế fail-fast.

## Deploy Firebase rules/indexes

Sau khi Firebase CLI đã đăng nhập đúng project:

```bash
npm run firebase:deploy:rules
```

## Cấu trúc chính

```text
app/
components/
  auth/
  comments/
  feed/
  interactions/
  providers/
lib/
  domain/
  auth-service.ts
  comment-service.ts
  firebase.ts
  post-service.ts
  storage-service.ts
firestore.rules
firestore.indexes.json
storage.rules
firebase.json
```

## Nguyên tắc bảo mật

UI không phải lớp phân quyền cuối cùng. Firestore Rules và Storage Rules luôn kiểm tra lại role, ownership và trạng thái xác minh. Email không được sao chép vào profile Firestore; dữ liệu chứng chỉ nằm dưới vùng private của user.
