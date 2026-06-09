Understood. I will act as your **GitHub Copilot (powered by DeepSeek)** reading the provided RFP markdown file. Before I generate the `docs/` folder with all the necessary specifications, I need to flag **unclear or missing information** in the current RFP.

Please answer the following questions so I can produce accurate documentation:

---

## 🔍 Questions & Clarifications Needed

### 1. **Database Schema – Exact Columns & Types**

The RFP mentions tables (`Users`, `Tasks`, `Focus_Sessions`) but not their fields.  
For example:

- `focus_sessions`: does it store `emotion_inferred` as a string, or a numeric vector from NLP? What about `journal_text` max length?
- `daily_logs`: what fields besides `date` and `report_md_content`? 
- `media_library`: what fields for RAG embeddings (e.g., `embedding_vector` of type `vector(1536)`? Which embedding model is used?

👉 **Please provide a complete ERD** or at least the column names and data types for each table.

---

### 2. **Which Supabase is actually used?**

Your RFP says **Supabase Cloud** (free tier) and `pgvector`.  
But the final architecture diagram shows **Self-Hosted Supabase** on an HP EliteDesk Mini.  

- Is the production deployment **Supabase Cloud** or **self‑hosted**?  
- If self‑hosted, how will AWS Lambda access it securely (public IP + firewall? Cloudflare Tunnel? VPN?).

👉 **Please clarify** which backend will be used for the final build (grading demonstration).

---

### 3. **Offline‑Sync Conflict Resolution Strategy**

The RFP says a sync queue will push to Supabase when online, but **no conflict resolution rule** is defined.  
If the same record is modified offline and also modified online (by another device or admin), what should happen? Options:

- Last‑write‑wins based on timestamp
- Merge changes (e.g., append notes, keep both tasks)
- Reject offline change and prompt user

👉 **Please specify** your conflict resolution policy.

---

### 4. **NLP Emotion Detection – Model Details**

The RFP mentions a “lightweight NLP model” running on AWS Lambda (Python).  

- What specific model? (e.g., `distilbert-base-uncased‑emotion`, a custom logistic regression, or a small transformer?)  
- Input: just the journal text? Output: which emotion categories (e.g., `[frustrated, neutral, focused, relaxed, tired]`)?  
- Will you use **Amazon Bedrock** for this or a local model in the Lambda package?

👉 **Please specify** the emotion detection approach and label set.

---

### 5. **RAG Content Vectorization**

- What embedding model will generate vectors for your content (YouTube self‑help, Lamrim transcripts, sutras)?  
- Will you use **Amazon Titan Embeddings** via Bedrock, or a local model (e.g., `all‑MiniLM‑L6‑v2`)?  
- How often will new content be added, and who triggers vectorisation (admin action or nightly job)?

👉 **Please clarify** the embedding source and update process.

---

### 6. **LaTeX Report Template**

The RFP says reports are generated with LaTeX and emailed as PDF.  

- Do you already have a `.latex` template design? If not, what sections should it include (e.g., total focus time, task completion rate, emotion trend over week, AI suggestion for tomorrow)?  
- Which LaTeX engine? (pdflatex, xelatex, or a service like QuickLaTeX via API?)

👉 **Please provide a sample of the desired report layout** or confirm that I can create a basic template.

---

### 7. **Push Notifications – Which Provider?**

You mention Amazon SNS for push notifications. However, SNS requires device tokens (APNS for iOS, FCM for Android).  

- Will you implement **Flutter Firebase Messaging** + SNS integration?  
- Or will you use **local notifications** only (no cloud push)?

👉 **Please confirm** the notification delivery method.

---

### 8. **Admin CMS – Framework & Features**

The RFP mentions a “simple web interface” for admin.  

- Should it be built with **Flutter Web** (sharing code with mobile) or a separate framework (React/Vue)?  
- Required features: user management (ban/edit), view aggregated stats, upload new content (text/video). Anything else?

👉 **Please specify** the CMS tech stack and minimum feature set.

---

### 9. **CI/CD Pipeline Tooling**

You mention GitLab CI.  

- Which stages are mandatory? (lint, test, build APK, deploy Lambdas)  
- Do you need to deploy the Flutter web version as well (e.g., to Netlify/Vercel)?  
- Should the pipeline also run the LaTeX report generation test?

👉 **Please confirm** the pipeline steps and target platforms.

---

### 10. **Testing Requirements**

The RFP says “Dart unit tests for sync queue, Pytest for NLP Lambda”.  

- What level of coverage is required? (e.g., 80% line coverage)  
- Should I include integration tests between Flutter and Supabase (using a test database)?  
- Are end‑to‑end tests needed (e.g., using Patrol or Flutter Driver)?

👉 **Please specify** your testing scope.

---

## Next Step

Once you answer the above (or tell me to make reasonable assumptions), I will generate a complete `docs/` folder containing:

- `database/schema.sql` + Drift Dart definitions
- `api/openapi.yaml` for Lambda endpoints
- `offline-sync.md` (with your chosen conflict strategy)
- `nlp-emotion.md` (model & label details)
- `rag-vectorisation.md`
- `latex-report-template.tex`
- `cicd-gitlab.yml` template
- `testing-plan.md`
- `environment.example` file
- `state-management.md` (assuming Riverpod unless you say otherwise)
- `user-stories.md` (derived from RFP features)

**Please provide clarifications or greenlight me to proceed with reasonable defaults.**







# Clarification:

Dưới đây là câu trả lời chi tiết và chuẩn chỉnh mang dáng dấp của một "System Architect" để bạn copy & paste gửi lại cho con DeepSeek. Các câu trả lời này được thiết kế để giữ đúng tiêu chí: **Miễn phí (Free Tier), Hiệu năng cao (Cloud-Native), Dễ code cho MVP nhưng vẫn đủ phức tạp để ăn điểm High Distinction.**

Bạn hãy copy toàn bộ đoạn text tiếng Anh dưới đây và gửi cho nó nhé:

---

Here are the clarifications and technical decisions for the project. You can use these to generate the `docs/` folder. Please use **Riverpod** for Flutter state management and proceed with these specifications:

### 1. Database Schema (Supabase PostgreSQL + pgvector)

Please generate a complete ERD based on these requirements:

* `users`: `id` (UUID), `email`, `created_at`.
* `tasks`: `id`, `user_id`, `name`, `status` (boolean/enum), `duration_spent` (int), `updated_at`.
* `focus_sessions`: `id`, `user_id`, `start_time`, `end_time`, `journal_text` (text, max 1000 chars), `emotion_label` (varchar).
* `daily_worklogs`: `id`, `user_id`, `date` (date), `total_focus_time` (int), `mood_summary` (text), `latex_file_url` (text), `pdf_file_url` (text).
* `media_library` (for RAG): `id`, `title`, `url` (or content text), `type` (video/quote), `embedding_vector` (vector size 384).

### 2. Which Supabase is actually used?

* **Production Deployment:** **Supabase Cloud (Managed Free Tier)**.
* The old diagram mentioning the "HP EliteDesk self-hosted" is outdated. We have fully migrated to a **Cloud-Native Architecture**. AWS Lambda will securely access Supabase Cloud via standard PostgreSQL connection strings with connection pooling (Supavisor) and API keys.

### 3. Offline‑Sync Conflict Resolution Strategy

* **Strategy:** **Last-Write-Wins (LWW) based on the `updated_at` timestamp.**
* Since this is a personal productivity app, multi-device simultaneous editing is rare. The device with the latest timestamp will overwrite the server record. Keep the sync logic simple for the MVP.

### 4. NLP Emotion Detection – Model Details

* **Approach:** We will run a lightweight, quantized ONNX model directly inside the AWS Lambda deployment package (using `onnxruntime` in Python) OR call the **Hugging Face Inference API** (Free Tier) from Lambda to save memory.
* **Model:** `distilbert-base-uncased-emotion`.
* **Inputs/Outputs:** Input is the `journal_text`. Output is mapped to 5 categories: `[focused, stressed, exhausted, relaxed, unmotivated]`.

### 5. RAG Content Vectorization

* **Embedding Model:** `all-MiniLM-L6-v2` (Output dimension: 384) to keep the pgvector database lightweight.
* **Update Process:** An Admin triggers the vectorization via the CMS. The CMS sends the text/URL to a dedicated AWS Lambda (Admin webhook), which generates the embedding and saves it to the `media_library` table in Supabase.

### 6. LaTeX Report Template

* **Engine:** The AWS Lambda will use **Tectonic** (a lightweight, standalone Rust-based LaTeX engine) via a Custom Lambda Layer to compile the `.tex` file into a `.pdf`.
* **Template:** I don't have a template yet. Please generate a sleek, professional `.tex` template. It must include: Header (Date, User), Summary (Total Time, Sessions), Emotion Trend, Task List, and an AI Suggestion block.

### 7. Push Notifications – Which Provider?

* **Method:** **Local Notifications ONLY** (`flutter_local_notifications`) for Pomodoro timers and breaks.
* No cloud push notifications (SNS/FCM) for the MVP to reduce complexity. The daily report delivery will be handled exclusively via **Amazon SES** (Email) with the PDF attached.

### 8. Admin CMS – Framework & Features

* **Tech Stack:** **Flutter Web** (to reuse data models and UI components from the mobile app).
* **Core Features:** 1. View aggregated, anonymized user stats.
2. Manage `media_library` (Upload new quotes/YouTube links, triggering the vectorization Lambda).

### 9. CI/CD Pipeline Tooling (GitLab CI)

* **Mandatory Stages:** `lint`, `test` (Dart & Python), `build` (APK), and `deploy` (Deploy Lambda functions via Serverless Framework or AWS SAM).
* **LaTeX Testing:** Do NOT compile LaTeX in the CI pipeline (to save runner minutes). Just unit test the Python script that generates the `.tex` string.
* Deploying Flutter Web (CMS) to platforms like Netlify/Vercel is a nice-to-have but prioritize the APK build.

### 10. Testing Requirements

* **Scope:** 70% line coverage for critical logic (Drift local DB, Sync Queue logic, Pomodoro state management).
* **Integration:** Include basic integration tests using a local Supabase CLI instance.
* **E2E:** No End-to-End (E2E) UI tests for now to save time on the MVP.

**Greenlight:** Please proceed with these specifications and generate the complete `docs/` folder with reasonable defaults for anything not explicitly mentioned!
