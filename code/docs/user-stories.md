# User Stories — Focus Mode App (Web-Only)

> **Derived from:** RFP (Internship Documentation.md)  
> **Platform:** Web-Only (Nuxt 4 + Vue 3)  
> **Format:** As a `<role>`, I want `<feature>` so that `<value>`.  
> **Priority:** P0 = MVP required, P1 = Phase 2, P2 = Phase 3  

---

## 1. Authentication

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-AUTH-01 | P0 | As a **new user**, I want to **sign up with email/password** so that I can create my account. | Email + password fields; account created in Supabase Auth; redirected to Dashboard. |
| US-AUTH-02 | P0 | As a **registered user**, I want to **sign in with email/password** so that I can access my focus data. | Login form; JWT session established in localStorage; previous data loaded. |
| US-AUTH-03 | P0 | As a **user**, I want my **session to persist across browser restarts** so that I don't need to log in every time. | `persistSession: true` in Supabase config; auth state restored on page load. |
| US-AUTH-04 | P1 | As a **user**, I want to **reset my password** so that I can recover access if I forget it. | "Forgot Password" link; Supabase sends reset email. |

---

## 2. Task Management (To-do List)

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-TASK-01 | P0 | As a **user**, I want to **create a new task** with a title so that I can plan my work. | "+" button opens form; title required; saved to IndexedDB + Synced to Supabase when online. |
| US-TASK-02 | P0 | As a **user**, I want to **edit a task's title/description** so that I can update my plans. | Click task → inline edit or modal; `updated_at` refreshed; sync enqueued. |
| US-TASK-03 | P0 | As a **user**, I want to **mark a task as complete/incomplete** so that I can track progress. | Checkbox toggle; status changes; strikethrough on completed tasks. |
| US-TASK-04 | P0 | As a **user**, I want to **delete a task** so that I can remove irrelevant items. | Delete button; confirmation dialog; task removed from list. |
| US-TASK-05 | P1 | As a **user**, I want to **set a task priority (1-3)** so that I can sort by importance. | Priority badge on task card; sort/filter by priority. |
| US-TASK-06 | P1 | As a **user**, I want to **set a due date** for a task so that I can meet deadlines. | Date picker; overdue tasks highlighted in red. |

---

## 3. Focus Mode (Pomodoro Timer)

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-FOCUS-01 | P0 | As a **user**, I want to **start a focus session with a configurable timer** so that I can work in timed blocks. | Duration selector (25/45/60 min); countdown displayed prominently in center of screen. |
| US-FOCUS-02 | P0 | As a **user**, I want the **screen to dim/darken during focus** so that I am less distracted. | Dark overlay fades in during focus; returns to normal after session. Immersive fullscreen mode. |
| US-FOCUS-03 | P0 | As a **user**, I want to **play ambient background sounds** during focus so that I can concentrate better. | Default Minecraft track included in `/public/audio/`; plays on session start; stops on end. |
| US-FOCUS-04 | P0 | As a **user**, I want to **pause and resume** the timer so that I can take unexpected breaks. | Pause button visible; timer stops; resume continues from pause point. |
| US-FOCUS-05 | P1 | As a **user**, I want to **select different ambient tracks** (rain, café, forest) so that I can customize my environment. | Media picker with categories; streams from S3 via CloudFront CDN. |
| US-FOCUS-06 | P1 | As a **user**, I want the **browser tab to show remaining time** so that I can glance without switching tabs. | `document.title` updated with countdown (e.g., "22:15 — Focus Mode"). |

---

## 4. Post-Focus Journal & Emotion Detection

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-EMO-01 | P0 | As a **user**, I want to **write a journal entry after each session** so that I can reflect on my work. | Text area appears after timer ends; max 1000 chars; saved with session to IndexedDB. |
| US-EMO-02 | P1 | As a **user**, I want the **app to auto-detect my emotion** from my journal text so that I don't have to manually rate my mood. | Journal text sent to Lambda via API Gateway; emotion label returned (focused/stressed/exhausted/relaxed/unmotivated); displayed with confidence %. |
| US-EMO-03 | P1 | As a **user**, I want to **see my emotion trend over time** so that I can understand my mental patterns. | Chart on Dashboard showing emotion labels per session/day (Chart.js or similar). |

---

## 5. RAG Content Recommendations

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-RAG-01 | P2 | As a **user feeling stressed**, I want to **receive calming content** (quotes, sutras) so that I can feel supported. | After emotion = "stressed", card showing top 1-3 matching media items appears below journal. |
| US-RAG-02 | P2 | As a **user**, I want **content recommendations to change based on my emotion** so that the support is relevant. | Exhausted → restorative; Unmotivated → motivational; Relaxed → reflective. |
| US-RAG-03 | P2 | As a **user**, I want to **open recommended videos** in a new tab so that I can watch them. | External link with `target="_blank"` for video-type media. |

---

## 6. Health Break Reminders

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-HLTH-01 | P2 | As a **user**, I want a **browser alert/toast after 2 hours of continuous focus** so that I remember to stretch and hydrate. | `Notification` API or in-app toast after 2 cumulative focus hours. Falls back to toast if permissions denied. |
| US-HLTH-02 | P2 | As a **user**, I want to **dismiss the reminder** so that I can finish my current deep work block. | "Dismiss" button on the toast notification. |

---

## 7. Daily Reports (LaTeX PDF via Email)

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-RPT-01 | P1 | As a **user**, I want to **receive a daily email report** with my focus summary so that I can review my productivity. | Email arrives by 7 AM local time; contains PDF attachment with task summary, focus time, emotion trend, AI suggestion. |
| US-RPT-02 | P1 | As a **user**, I want the **PDF report to look professional** so that I can share it if needed. | LaTeX-compiled PDF with consistent branding, charts, and structured sections. |
| US-RPT-03 | P1 | As a **user**, I want to **view past reports in the web app** so that I can compare my progress. | Calendar/heatmap on Reports page; click date → open PDF via S3 presigned URL in new tab. |

---

## 8. AI Agentic Suggestions

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-AI-01 | P2 | As a **user**, I want the **AI to suggest my optimal work time** based on my history so that I can schedule better. | On Dashboard: "Your focus peaks at 22:00. Try scheduling deep work then." |
| US-AI-02 | P2 | As a **user**, I want the **AI to recommend break frequency** so that I avoid burnout. | "You lose focus after ~90 min. Try 25/5 Pomodoro cycles." |
| US-AI-03 | P2 | As a **user**, I want the **AI to prioritize my task list** based on past completion patterns. | Tasks re-ordered with "Suggested Priority" badges. |

---

## 9. Dashboard & Analytics

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-DASH-01 | P1 | As a **user**, I want to **see my daily/weekly focus time on a chart** so that I can track my consistency. | Bar/line chart on Dashboard; data from `daily_worklogs` / `daily_stats`. |
| US-DASH-02 | P1 | As a **user**, I want to **see my current streak** (consecutive focus days) so that I stay motivated. | Streak counter prominently displayed (🔥 emoji + number). |
| US-DASH-03 | P1 | As a **user**, I want to **view a heatmap calendar** of my focus activity so that I can spot patterns. | GitHub-style contribution heatmap; darker green = more focus time. |
| US-DASH-04 | P1 | As a **user**, I want the **dashboard to load fast** so that I am not waiting. | Data from local IndexedDB; < 500ms render time. |

---

## 10. Admin CMS (Nuxt 4 — role-gated)

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-ADM-01 | P1 | As an **admin**, I want to **view aggregate user statistics** so that I can monitor platform health. | Admin dashboard with total users, total focus hours, most active users. |
| US-ADM-02 | P1 | As an **admin**, I want to **add new content (quotes/sutras/videos) to the media library** so that the RAG system has fresh material. | Form with title, content_text, type, source, tags; triggers vectorization Lambda on submit. |
| US-ADM-03 | P1 | As an **admin**, I want to **deactivate/delete content** so that I can curate the library. | Toggle `is_active`; soft delete only (preserve embeddings for audit). |
| US-ADM-04 | P2 | As an **admin**, I want to **view per-user analytics** so that I can understand individual engagement. | Click user → see their session history, emotion trends, report history. |

---

## 11. Offline-First Sync

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-SYNC-01 | P0 | As a **user**, I want the **app to work fully offline** so that I can focus without internet dependency. | All CRUD operations work on local IndexedDB; UI responsive with no network. |
| US-SYNC-02 | P0 | As a **user**, I want my **data to auto-sync when I go online** so that nothing is lost. | SyncQueueManager automatically pushes changes on `window 'online'` event. |
| US-SYNC-03 | P1 | As a **user**, I want to **see sync status** (pending/synced/error) so that I know my data is safe. | Sync icon in app header; badge count of pending items; last synced timestamp. |
| US-SYNC-04 | P1 | As a **user**, I want the **latest edit to win** if I edit on multiple browser tabs so that my most recent work is preserved. | LWW conflict resolution based on `updated_at`. |

---

## 12. Cross-Cutting (Web-Specific)

| ID | Priority | Story | Acceptance Criteria |
|---|---|---|---|
| US-CC-01 | P0 | As a **user**, I want the **app to load in under 2 seconds** so that I can start working immediately. | Lighthouse Performance score > 90; first contentful paint < 1.5s. |
| US-CC-02 | P0 | As a **developer**, I want **automated CI/CD** so that every push is tested and built. | GitLab CI runs lint → test → build on merge requests to main; deploy to Cloudflare Pages. |
| US-CC-03 | P1 | As a **user**, I want the **app to be responsive** so that it works on both desktop and tablet browsers. | Layout adapts; minimum width 360px; comfortable on 1920px. |
| US-CC-04 | P1 | As a **user**, I want the **app to work in Chrome, Firefox, and Edge** so that I can use my preferred browser. | Cross-browser testing on latest 2 versions of each. |
| US-CC-05 | P1 | As a **user**, I want the **focus timer to continue even if I switch tabs** so that I don't lose progress. | Timer uses `setInterval` (not `requestAnimationFrame`); Web Worker for precision if needed. |
