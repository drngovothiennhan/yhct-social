# YHCT Social

Mạng xã hội Y học Cổ truyền xây mới trên **Next.js App Router + Firebase + Vercel**. Runtime không sử dụng AppSheet, Google Sheets hoặc Drive API.

## Trạng thái hiện tại

Baseline production v1.0 đã được đóng trên `main`. Beta 2.0 hiện có Module A/B/C trên luồng tích hợp, với các năng lực chính:

- Firebase Auth với đăng nhập thành viên, RBAC `member < mod < super_mod < admin` và bắt buộc đổi mật khẩu tạm trước khi dùng chức năng bảo vệ.
- Cổng xã hội gồm feed, bài viết, reactions, bình luận, danh bạ thành viên và hoạt động CLB.
- Báo cáo bài viết/bình luận bằng ID xác định, lý do cố định và chi tiết tối đa 2.000 ký tự; client chỉ được tạo báo cáo của chính mình.
- ACC tách riêng cho quản trị thành viên, kiểm duyệt, xác minh chuyên môn, audit và vận hành hệ thống.
- Kiểm duyệt hỗ trợ `keep`, `hide`, `soft_delete`, `dismiss`; khôi phục chỉ dành cho `super_mod/admin`.
- Hồ sơ practitioner có quy trình `unsubmitted/rejected -> pending -> verified|rejected`; quyết định chỉ do `super_mod/admin` thực hiện trên server.
- Minh chứng xác minh lưu riêng dưới `certificates/{uid}/...`; client chỉ đọc minh chứng của chính mình. ACC xem minh chứng qua server broker có xác thực role, kiểm tra path đã đăng ký, `no-store` và không phát hành URL công khai lâu dài.
- `adminAudit/{operationId}` là nhật ký append-only do server tạo, retry-safe; duyệt toàn bộ audit chỉ dành cho admin.
- Firestore/Storage rules, composite indexes và security-contract tests bao phủ Module A/B/C.
- Production Firebase deploy dùng **OIDC/WIF-only**, chỉ chạy từ `main`; không có service-account JSON hoặc Firebase token fallback. `release/v1.0` chỉ validation và không vượt qua production WIF trust boundary.

## Yêu cầu môi trường

- Node.js `>=22.12.0 <23`
- Một Firebase Web App đã bật Firestore, Authentication và Storage.
- Authentication providers theo cấu hình dự án.
- ACC cần Firebase Admin runtime qua Application Default Credentials ở local/server phù hợp hoặc Vercel OIDC/WIF ở môi trường được cấu hình.

## Chạy public app local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Điền đầy đủ các biến `NEXT_PUBLIC_FIREBASE_*` trong `.env.local` trước khi mở ứng dụng.

## Chạy ACC local

```bash
cd admin-portal
npm install
npm run dev
```

Không đưa service-account JSON vào repository. Runtime ACC phải nhận Google credentials theo cơ chế đã được phê duyệt của môi trường.

## Kiểm tra

Public app:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

ACC:

```bash
cd admin-portal
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` kiểm tra domain invariants, RBAC, workflow contracts, trust boundary và security rules. Build cần các biến Firebase public/runtime hợp lệ theo cơ chế fail-fast hiện hành.

## Deploy Firebase rules/indexes

Production deploy được thực hiện qua GitHub Actions main-only với OIDC/WIF. Không deploy production từ feature/release branch và không thêm đường fallback bằng secret key.

Workflow production triển khai Storage Rules, Firestore Rules và Firestore indexes sau khi application validation thành công.

## Cấu trúc chính

```text
app/
components/
  portal/
  providers/
lib/
  domain/
  post-service.ts
  comment-service.ts
  report-service.ts
  verification-service.ts
  storage-service.ts
admin-portal/
  app/
    api/
      moderation/
      verification/
      audit/
  lib/
    moderation.ts
    verification.ts
    audit.ts
    module-c-policy.ts
firestore.rules
firestore.indexes.json
storage.rules
firebase.json
```

## Nguyên tắc bảo mật

- UI không phải lớp phân quyền cuối cùng; server routes và Firebase Rules luôn xác minh lại role, ownership và trạng thái tài khoản.
- `mustChangePassword` chặn các mutation được bảo vệ.
- Client không được ghi moderation decision, verification decision, parent counters hoặc `adminAudit`.
- Restore và verification decision không được cấp cho `mod`.
- Minh chứng chuyên môn không có public download URL; privileged review đi qua ACC broker.
- Không commit activation password, private member roster, service-account JSON, private key, ID token hoặc private migration package.
- Production WIF giữ nguyên main-only; feature/release branch không được mở rộng điều kiện trust để deploy production.
