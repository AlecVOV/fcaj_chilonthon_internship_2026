---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #FAF7F0;
    color: #1A1A1A;
    padding: 60px 70px;
  }
  h1 {
    color: #C1440E;
    font-size: 40px;
    border-bottom: 3px solid #C1440E;
    padding-bottom: 12px;
  }
  h2 { color: #C1440E; font-size: 30px; }
  section.lead {
    background: linear-gradient(135deg, #C1440E 0%, #8A2E0A 100%);
    color: white;
    text-align: center;
  }
  section.lead h1 { color: white; border: none; font-size: 52px; }
  section.lead p { color: #FFE8D9; font-size: 22px; }
  ul { font-size: 25px; line-height: 1.55; }
  li { margin-bottom: 8px; }
  strong { color: #C1440E; }
  section.lead strong { color: white; text-decoration: underline; }
  table { font-size: 20px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .tag {
    display: inline-block; background: #C1440E; color: white;
    padding: 2px 10px; border-radius: 4px; font-size: 16px; margin-right: 6px;
  }
  .small { font-size: 18px; color: #555; }
  footer { color: #999; font-size: 14px; }
---

<!-- _class: lead -->

# Focus Mode App
### Báo cáo Thực tập — AWS FCAJ Internship 2026

**[Điền họ tên bạn]**
AI Engineer Intern

*[Điền ngày báo cáo]*

---

## 1. Giới thiệu bản thân & vị trí thực tập

- **Họ tên:** [Điền tên bạn]
- **Vị trí thực tập:** AI Engineer Intern
- **Chương trình:** FCAJ Internship 2026 (AWS)
- **Thời gian thực tập:** [Điền khoảng thời gian]
- **Vai trò trong dự án:** đảm nhiệm **full-stack + cloud/AI engineering** cho sản phẩm *Focus Mode App* — từ frontend, database, tới hạ tầng AWS và tích hợp AI

---

## 2. Mục tiêu thực tập

- Xây dựng một ứng dụng **năng suất cá nhân** (Pomodoro/Focus) tích hợp AI, theo đúng RFP đề ra
- Áp dụng kiến trúc **Cloud-Native, Event-Driven** — không dùng server truyền thống
- Thực hành tích hợp **AI thực chiến**: Bedrock Agent, NLP, RAG, vector search
- Tự vận hành trọn vẹn 1 dự án: từ code → database → deploy AWS → bảo mật → tài liệu
- Mục tiêu đánh giá: đạt chuẩn **High Distinction**

---

## 3. Công việc đã thực hiện — Frontend & Database

<div class="cols">
<div>

**Frontend**
- Nuxt 3 SPA (Vue 3 + Pinia + Tailwind)
- Cloud-only — bỏ hẳn offline-first/IndexedDB
- Deploy AWS Amplify Hosting, custom domain

</div>
<div>

**Database**
- Supabase (PostgreSQL + Auth + **pgvector**)
- 14 migration, Row Level Security (RLS) trên mọi bảng
- 9 bảng: users, tasks, focus_sessions, media_library, agent_conversations...

</div>
</div>

<span class="tag">Nuxt 3</span><span class="tag">Vue 3</span><span class="tag">Pinia</span><span class="tag">Tailwind</span><span class="tag">Supabase</span><span class="tag">PostgreSQL</span><span class="tag">pgvector</span>

---

## 3. Công việc đã thực hiện — Tính năng sản phẩm

- ⏱️ **Focus Timer** — đếm neo mốc thời gian thực, chuông + browser Notification
- ✅ **Task Management** — CRUD đầy đủ, khóa khi đang trong phiên focus, review khi hoàn thành
- 🎵 **Ambient Sound** — quản lý qua Admin (S3 upload), phát nhạc nền thật
- 📓 **Journal & Emotion** — ghi nhật ký sau phiên, nhận diện cảm xúc (fallback + kế hoạch AI)
- 📊 **Dashboard Analytics** — 4 biểu đồ (focus time, tasks, status, priority), heatmap lịch sử
- 🛠️ **Admin CMS** — duyệt user, quản lý media, quản lý ambient sound

---

## 3. Công việc đã thực hiện — AI & Cloud (AWS)

- 🤖 **Bedrock Task Agent** (Claude **Haiku 4.5**) — chat tạo/sửa/xóa/liệt kê task bằng ngôn ngữ tự nhiên
- 🛡️ **Guardrail** chống prompt injection (chặn nâng quyền, lộ system prompt, PII)
- ⚙️ **3 AWS Lambda deployed thật**: `agent-bff`, `agent-action-handler`, `ambient-audio-manager`
- 🔐 **Bảo mật tự thiết kế**: xác thực token ES256 trong Lambda (JWT authorizer chuẩn không hỗ trợ), chống confused-deputy, rate-limit AI theo user/ngày
- 📚 Tài liệu kỹ thuật đầy đủ: kiến trúc, runbook deploy, findings/lessons-learned

<span class="tag">AWS Lambda</span><span class="tag">API Gateway</span><span class="tag">Bedrock Agent</span><span class="tag">Claude Haiku 4.5</span><span class="tag">IAM</span><span class="tag">S3</span>

---

## 4. Kết quả đạt được

- ✅ App chạy thật trên cloud — production domain, đăng nhập/duyệt user/thao tác task đầy đủ
- ✅ **Bedrock AI Agent hoạt động ổn định** end-to-end (đã fix throttling, auth, prompt injection)
- ✅ **3/6 Lambda AWS đã deploy & test thật**, còn lại có kế hoạch triển khai rõ ràng
- ✅ **28/44 user story hoàn thành** (theo `docs/user-stories.md`) — phần còn lại là tính năng AI nâng cao (RAG, agentic suggestion)
- ✅ Tự đánh giá nội bộ: **7.5/10**, hướng tới **High Distinction**
- ✅ Toàn bộ tài liệu kỹ thuật đồng bộ với code thật (không phải spec suông)

---

## 5. Khó khăn & bài học rút ra

- **Bedrock quota rất thấp** (sandbox account) → lỗi throttling khi chat nhiều lượt
  → *học được:* đổi sang model có inference profile quota cao hơn (Haiku 4.5, 50 RPM)
- **Token Supabase ký ES256** — không tương thích JWT authorizer chuẩn của API Gateway
  → *học được:* tự xác thực trong Lambda, không nên giả định 1 chuẩn JWT duy nhất
- **IAM permission tưởng đủ nhưng thiếu** — quota Get* riêng biệt với InvokeModel
  → *học được:* đọc kỹ CloudWatch log thay vì đoán nguyên nhân qua lỗi bề mặt
- **Công cụ tưởng đúng lại âm thầm sai** (lệnh `tar` tạo zip lỗi định dạng)
  → *học được:* luôn xác minh output thay vì tin lệnh "chạy không báo lỗi"

---

## 6. Kết luận & hướng phát triển

**Kết luận:** đã tự tay xây dựng và vận hành một hệ thống cloud-native + AI thật — không chỉ code tính năng mà còn tự debug, bảo mật, và viết tài liệu như một dự án thực tế.

**Hướng phát triển tiếp theo:**
- Hoàn thiện 3 AI Lambda còn lại qua **Bedrock** (emotion, RAG, vectorizer)
- Xây dựng pipeline nạp nội dung (KB ingestion) cho RAG
- Production-hardening (throttling, Secrets Manager) khi mở rộng quy mô người dùng

---

<!-- _class: lead -->

# Cảm ơn đã lắng nghe
### Q&A

**[Điền tên bạn]** — AI Engineer Intern, FCAJ Internship 2026
