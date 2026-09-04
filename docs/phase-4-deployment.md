# Giai đoạn 4 — Production Deployment

## Trạng thái xác minh ngày 2026-09-04

- Repository production: `drngovothiennhan/yhct-social`, nhánh `main`.
- Firebase project: `yhct-social-260902-42a4`.
- Commit cutover `4ff2c16ece81e60626bda146f9dedac135fc0f6f` đã chạy GitHub Actions CI thành công qua các bước install, test, typecheck, lint và Next.js production build.
- Workflow `Deploy Firebase Rules` đã chạy nhưng dừng tại bước `Validate Google OIDC variables` vì thiếu `GCP_WIF_PROVIDER` hoặc `GCP_DEPLOY_SERVICE_ACCOUNT`; bước authenticate và deploy rules bị skip.
- Kết nối Vercel trong phiên triển khai hiện chưa trả về team/project, nên chưa thể ghi Environment Variables hoặc tạo production deployment bằng API từ phiên này.

## Checklist 5 bước production

### 1. Firebase project

Trong Firebase Console của `yhct-social-260902-42a4`:

1. Bật Authentication providers **Google** và **Email/Password**.
2. Tạo Cloud Firestore ở Native mode.
3. Bật Firebase Storage.
4. Tạo Firebase Web App nếu chưa có.
5. Lấy 6 giá trị Web App config:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

Không đưa service-account JSON hoặc private key vào biến `NEXT_PUBLIC_*`.

### 2. GitHub + Google OIDC

Repository production là `drngovothiennhan/yhct-social`.

CI nằm tại `.github/workflows/ci.yml` và chạy khi push `main` hoặc mở pull request.

Để `.github/workflows/deploy-firebase-rules.yml` deploy tự động, tạo hai Repository Variables:

- `GCP_WIF_PROVIDER`: resource name của Workload Identity Provider, dạng `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: email service account dành riêng cho deploy Firebase rules/indexes/storage rules.

Service account chỉ nên có các quyền tối thiểu cần cho deploy. Không commit credentials vào repository.

### 3. Vercel

Import repository `drngovothiennhan/yhct-social` bằng Git integration.

Thiết lập:

- Framework Preset: **Next.js**
- Root Directory: repository root
- Node.js: **22.x**
- Production Branch: `main`
- Build Command: `npm run build` hoặc Next.js default
- Install Command: `npm install` hoặc Vercel default

Thêm đủ 6 biến `NEXT_PUBLIC_FIREBASE_*` cho Production. Có thể thêm cho Preview/Development nếu các môi trường này dùng Firebase thật.

### 4. Firebase Authorized domains

Sau khi Vercel cấp domain production, vào Firebase Console > Authentication > Settings > Authorized domains và thêm domain `*.vercel.app` cụ thể của project. Nếu dùng custom domain, thêm cả custom domain.

### 5. Smoke test production

1. Mở trang chủ bằng cửa sổ ẩn danh.
2. Đăng ký Email/Password.
3. Đăng xuất rồi đăng nhập Google.
4. Hoàn thành onboarding với vai trò Thành viên.
5. Tạo bài Hỏi đáp có một ảnh.
6. Xác nhận bài xuất hiện realtime.
7. Like rồi unlike bài.
8. Tạo bình luận gốc, reply cấp 1, cấp 2 và cấp 3.
9. Xác nhận UI không cho reply sâu hơn cấp 3.
10. Tạo practitioner chưa verified và xác nhận không thể gắn nhãn chuyên môn.
11. Từ admin, xác minh practitioner rồi kiểm tra quyền nhãn chuyên môn.
12. Kiểm tra Firestore collections và Storage paths trong Firebase Console.

## Tiêu chí go-live

Chỉ coi production sẵn sàng khi đồng thời đạt đủ:

- GitHub CI xanh.
- Firestore Rules/Indexes/Storage Rules deploy thành công.
- Vercel production deployment ở trạng thái Ready.
- Smoke test Auth + Post + Media + Like + Nested Comments + professional verification pass.

Nếu một trong bốn điều kiện chưa đạt, không tuyên bố go-live.
