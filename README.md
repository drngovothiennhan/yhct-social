# YHCT Social

Mạng xã hội Y học Cổ truyền xây mới trên **Next.js App Router + Firebase + Vercel**. Runtime không sử dụng AppSheet hoặc Google Sheets làm cơ sở dữ liệu. Google Drive chỉ được dùng có kiểm soát như một nguồn tài liệu đọc cho kho tri thức AI nội bộ.

## Trạng thái hiện tại

Baseline production v1.0 được đóng trên `main`. Beta 2.0 có Module A/B/C trên luồng tích hợp, với các năng lực chính:

- Firebase Auth với đăng nhập thành viên, RBAC `member < mod < super_mod < admin` và bắt buộc đổi mật khẩu tạm trước khi dùng chức năng bảo vệ.
- Cổng xã hội gồm feed, bài viết, reactions, bình luận, danh bạ thành viên và hoạt động CLB.
- Báo cáo bài viết/bình luận bằng ID xác định, lý do cố định và chi tiết tối đa 2.000 ký tự; client chỉ được tạo báo cáo của chính mình.
- ACC tách riêng cho quản trị thành viên, kiểm duyệt, xác minh chuyên môn, audit, AI control plane và vận hành hệ thống.
- Kiểm duyệt hỗ trợ `keep`, `hide`, `soft_delete`, `dismiss`; khôi phục chỉ dành cho `super_mod/admin`.
- Hồ sơ practitioner có quy trình `unsubmitted/rejected -> pending -> verified|rejected`; quyết định chỉ do `super_mod/admin` thực hiện trên server.
- Minh chứng xác minh lưu riêng dưới `certificates/{uid}/...`; client chỉ đọc minh chứng của chính mình. ACC xem minh chứng qua server broker có xác thực role, kiểm tra path đã đăng ký, `no-store` và không phát hành URL công khai lâu dài.
- `adminAudit/{operationId}` là nhật ký append-only do server tạo, retry-safe; duyệt toàn bộ audit chỉ dành cho admin.
- Module C AI cung cấp Gemini server-only, advisory moderation/classification, RAG nội bộ CLB, RAG y văn bên ngoài có grounding, DOCX-to-post draft và Hardware Adaptive Lite Mode.
- Firestore/Storage rules, indexes và security-contract tests bao phủ Module A/B/C. Dữ liệu AI server-owned được giữ sau server APIs; Firestore default-deny chặn truy cập client trực tiếp vào collection chưa được cấp quyền.
- Production Firebase deploy dùng **OIDC/WIF-only**, chỉ chạy từ `main`; không có service-account JSON hoặc Firebase token fallback. `release/v1.0` chỉ validation và không vượt qua production WIF trust boundary.

> Module C AI trên feature/release stream không đồng nghĩa đã được đưa lên production. Production chỉ thay đổi sau một promotion riêng vào `main`.

## Module C AI Engine

### 1. Gemini server-only

Public browser và ACC browser không giữ Gemini secret. Các yêu cầu AI đi qua Next.js server routes hoặc ACC server routes, nơi Firebase ID token/RBAC được xác minh lại trước khi provider được gọi.

Biến root-app server-only:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL_FAST=gemini-2.5-flash
GEMINI_MODEL_REASONING=
GEMINI_FILE_SEARCH_STORE=
AI_DAILY_REQUEST_LIMIT=200
AI_PER_USER_WINDOW_LIMIT=10
AI_MAX_TEXT_CHARS=24000
AI_MAX_DOCX_BYTES=5242880
```

Không tạo biến `NEXT_PUBLIC_GEMINI_*`.

### 2. RAG nội bộ và RAG bên ngoài là hai chế độ tách biệt

- **Nội bộ CLB**: `/api/ai/rag/internal` chỉ dùng Gemini File Search store đã cấu hình. Nguồn hiển thị cho client được ánh xạ về manifest an toàn `aiKnowledgeSources`; provider store ID/OAuth token không được trả cho browser.
- **Y văn bên ngoài**: `/api/ai/rag/external` chỉ dùng Google Search grounding. Chỉ grounding metadata provider thực sự trả về mới được hiển thị làm source.
- Nếu provider không trả grounding đủ tin cậy, API trả `grounded: false`/`degraded: true` và không dựng nguồn giả.
- Hai mode không tự trộn nguồn với nhau.
- Truy vấn mang tính chẩn đoán/phác đồ cá nhân hóa bị từ chối; tính năng được thiết kế cho nghiên cứu/tham khảo học thuật.

### 3. Kho tri thức nội bộ qua ACC

ACC `/ai` cho phép moderator trở lên xem trạng thái AI, hàng đợi advisory analysis và manifest nguồn tri thức.

- `mod`, `super_mod`, `admin`: sync/re-sync file được phép từ Drive folder cấu hình bằng `AI_DRIVE_FOLDER_ID`.
- Chỉ `super_mod/admin`: xóa nguồn khỏi File Search.
- Drive được đọc server-side bằng Google identity/OIDC-WIF hoặc Application Default Credentials với scope `drive.readonly`.
- File phải nằm trong folder được duyệt; nội dung được hash trước khi upload. Hash không đổi => không upload trùng.
- Hỗ trợ nguồn đọc đã cho phép như Google Docs export text, PDF, DOCX, text/Markdown theo validation của service.
- Manifest chỉ lưu metadata cần thiết như source ID/hash/provider document ID/trạng thái; không lưu OAuth token hoặc credential.

Biến ACC AI server-only:

```dotenv
GEMINI_API_KEY=
GEMINI_FILE_SEARCH_STORE=
AI_DRIVE_FOLDER_ID=
```

ACC vẫn dùng các biến OIDC/WIF hiện hành để truy cập Firebase Admin và Drive; không dùng service-account JSON fallback.

### 4. DOCX-to-post draft

Thành viên đủ điều kiện có thể tải một `.docx` đã được giới hạn kích thước lên `/api/ai/document-to-post`.

Pipeline:

1. xác minh Firebase ID token và trạng thái tài khoản;
2. kiểm tra extension/MIME/kích thước;
3. trích xuất text server-side bằng Mammoth;
4. chạy privacy guard và quota;
5. yêu cầu Gemini trả structured draft đã validate schema;
6. đưa draft vào ô soạn thảo để người dùng **tự rà soát/chỉnh sửa**;
7. chỉ nút đăng bài hiện hữu mới gọi canonical `createSocialPost`.

Bytes DOCX không được lưu như một tài sản của AI pipeline và AI không tự xuất bản bài.

### 5. Hardware Adaptive Lite Mode

Thiết bị có thể tự chọn `lite`, `standard` hoặc `enhanced` từ các tín hiệu browser khả dụng như `hardwareConcurrency`, `deviceMemory`, Data Saver và `prefers-reduced-motion`.

- Tín hiệu chỉ được xử lý local trong browser; không upload telemetry phần cứng.
- API browser bị thiếu/lỗi => mặc định an toàn `standard`.
- Người dùng có thể override Auto/Lite/Standard/Enhanced; lựa chọn được lưu localStorage.
- Lite Mode chỉ giảm animation/transition/backdrop effect, không ẩn chức năng hoặc dữ liệu.

### 6. Dữ liệu tuyệt đối không gửi vào free-tier AI

Không gửi các dữ liệu sau tới Gemini free-tier hoặc external grounding:

- MSSV kèm credential/provisioning password;
- mật khẩu, token, private key, service-account JSON;
- CCCD/CMND/government ID;
- minh chứng/chứng chỉ practitioner riêng tư;
- dữ liệu ACC/audit riêng tư không liên quan;
- thông tin bệnh nhân có khả năng định danh;
- email/số điện thoại hoặc dữ liệu thành viên riêng tư không cần thiết cho tác vụ.

Ca lâm sàng chỉ được đi qua AI sau khi đạt de-identification validation. Privacy guard là lớp chặn deterministic cho mẫu rủi ro cao; nó không được mô tả như một hệ thống phát hiện PII hoàn hảo.

### 7. Quota, cache và degraded mode

- Quota server-owned có giới hạn theo user-window và tổng theo ngày.
- Advisory post analysis dùng deterministic content hash/cache để giảm gọi provider lặp lại.
- Gemini/File Search/Search lỗi hoặc hết quota phải trả lỗi/degraded state cục bộ; không được làm hỏng Auth, feed, đăng bài thủ công hoặc ACC core administration.
- AI moderation chỉ là **advisory**. AI không trực tiếp hide/delete nội dung, suspend user, thay RBAC hoặc phê duyệt practitioner verification.

## Yêu cầu môi trường

- Node.js `>=22.12.0 <23`
- Một Firebase Web App đã bật Firestore, Authentication và Storage.
- Authentication providers theo cấu hình dự án.
- ACC cần Firebase Admin runtime qua Application Default Credentials ở local/server phù hợp hoặc Vercel OIDC/WIF ở môi trường được cấu hình.
- Để bật Module C AI đầy đủ cần Gemini server key; internal RAG cần File Search store; ACC Drive sync cần approved Drive folder và Google runtime identity có quyền đọc folder đó.

## Chạy public app local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Điền đầy đủ `NEXT_PUBLIC_FIREBASE_*` và các biến AI server-only cần dùng trong `.env.local`. Không prefix Gemini secret bằng `NEXT_PUBLIC_`.

## Chạy ACC local

```bash
cd admin-portal
cp .env.example .env.local
npm install
npm run dev
```

Không đưa service-account JSON vào repository. Runtime ACC phải nhận Google credentials theo cơ chế đã được phê duyệt của môi trường. Nếu Gemini/File Search/Drive chưa cấu hình thì AI control plane có thể báo chưa sẵn sàng, nhưng core ACC phải tiếp tục hoạt động.

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

`npm test` kiểm tra domain invariants, RBAC, trust boundary, privacy/quota, AI tool separation, DOCX draft authority, hardware local-only policy, workflow contracts và security rules. Build cần các biến Firebase public/runtime hợp lệ theo cơ chế fail-fast hiện hành.

## Deploy Firebase rules/indexes

Production deploy được thực hiện qua GitHub Actions main-only với OIDC/WIF. Không deploy production từ feature/release branch và không thêm đường fallback bằng secret key.

`release/v1.0` chạy Firebase policy validation không có `id-token: write`/WIF auth. Workflow production trên `main` triển khai Storage Rules, Firestore Rules và Firestore indexes sau khi application validation thành công.

Module C AI không yêu cầu data migration/re-import. Việc promotion lên production là một hành động release riêng sau khi exact release SHA đã qua CI.

## Cấu trúc chính

```text
app/
  api/ai/
    analyze-post/
    rag/internal/
    rag/external/
    document-to-post/
components/
  portal/
    ai-research-panel.tsx
    docx-post-draft.tsx
    hardware-mode-control.tsx
  providers/
    hardware-mode-provider.tsx
lib/
  domain/
  server/ai/
    config.ts
    auth.ts
    privacy.ts
    quota.ts
    gemini.ts
    analysis.ts
    rag.ts
    docx.ts
  hardware-mode.ts
  post-service.ts
  comment-service.ts
  report-service.ts
  verification-service.ts
admin-portal/
  app/
    ai/
    api/ai/
    api/moderation/
    api/verification/
    api/audit/
  lib/
    ai-policy.ts
    ai-knowledge.ts
    ai-ops.ts
    moderation.ts
    verification.ts
    audit.ts
firestore.rules
firestore.indexes.json
storage.rules
firebase.json
```

## Nguyên tắc bảo mật

- UI không phải lớp phân quyền cuối cùng; server routes và Firebase Rules luôn xác minh lại role, ownership và trạng thái tài khoản.
- `mustChangePassword` chặn các mutation được bảo vệ, gồm các AI operation yêu cầu thành viên hợp lệ.
- Client không được ghi moderation decision, verification decision, AI analyses/quota/knowledge manifest, parent counters hoặc `adminAudit`.
- Restore và verification decision không được cấp cho `mod`.
- Minh chứng chuyên môn không có public download URL; privileged review đi qua ACC broker.
- AI không có quyền trực tiếp sửa trạng thái kiểm duyệt hoặc quyền người dùng.
- Không commit activation password, private member roster, service-account JSON, private key, ID token hoặc private migration package.
- Production WIF giữ nguyên main-only; feature/release branch không được mở rộng điều kiện trust để deploy production.
