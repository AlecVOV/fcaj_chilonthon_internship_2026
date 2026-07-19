# Testing Plan (Nuxt 4 / Web-Only)

> Cập nhật 2026-07-06 — đồng bộ với bản cài đặt cloud-only + đợt rà tính năng
> 2026-07-05 (auth re-validate, change-password re-auth, persist/restore phiên focus,
> banner lỗi task list, khóa Delete khi focus, stats dashboard).

> **Project:** Focus Mode App (Web-Only)  
> **Coverage Target:** 70% line coverage (critical logic)  
> **Test Runner:** Vitest (unit + integration)  
> **E2E (Optional MVP):** Playwright  
> **Lambda Tests:** pytest (only for lambdas that have code)  

> **Status:** Bộ test hiện chưa nhiều — phần lớn các test case bên dưới là kế hoạch
> mục tiêu, chưa được viết hết. Ưu tiên unit test cho stores + composables cốt lõi.

---

## 1. Testing Strategy Overview

```
┌──────────────────────────────────────────────────┐
│                Testing Pyramid                     │
│                                                    │
│         ┌─────────────────────┐                   │
│         │   Playwright E2E     │  Optional for MVP │
│         │   ~5 specs           │                   │
│         └─────────────────────┘                   │
│       ┌───────────────────────────┐               │
│       │   Integration Tests       │  Vitest +      │
│       │   ~10 tests               │  Supabase CLI  │
│       └───────────────────────────┘               │
│   ┌───────────────────────────────────┐           │
│   │   Unit Tests (Vitest)              │           │
│   │   ~50+ tests (70% line coverage)   │           │
│   └───────────────────────────────────┘           │
└──────────────────────────────────────────────────┘
```

## 2. Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',           // Simulate browser DOM
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'cobertura'],
      include: [
        'stores/**/*.ts',
        'composables/**/*.ts',
        'lib/**/*.ts',
        'utils/**/*.ts',
      ],
      thresholds: {
        lines: 70,
        statements: 70,
      },
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
    },
  },
})
```

## 3. Vitest Unit Test Cases

> Kiến trúc hiện tại là **cloud-only**: mọi read/write đi thẳng Supabase. Không còn
> sync queue, IndexedDB/Dexie, mock backend, hay Last-Write-Wins — các test cho những
> module đó đã bị gỡ. Unit test cho store giờ **mock Supabase client** thay vì Dexie.

### A. Pomodoro Timer — `focus.store` (`tests/unit/stores/focus.store.test.ts`)

> Đồng hồ đếm ngược neo theo mốc thời gian thực (`endAt = Date.now() + duration`),
> tự hiệu chỉnh mỗi tick nên chính xác cả khi tab chạy nền. Test dùng fake timers
> + mock `Date.now()` để kiểm chứng logic theo thời gian thực. Phiên còn dở được
> **persist/restore qua reload** bằng localStorage key `focus_session` (mock localStorage).

| # | Test Case | Expected |
|---|---|---|
| PM-01 | `start(durationSeconds)` → trạng thái running, `endAt` được đặt | `isRunning = true`, `remaining = durationSeconds` |
| PM-02 | Tua đồng hồ 1 giây → `tick()` tính lại từ `endAt` | `remaining = initial - 1` |
| PM-03 | Vượt mốc `endAt` → `finish()` được gọi (phát chuông WebAudio + Notification) | `isFinished = true`, `remaining = 0` |
| PM-04 | `pause()` → đóng băng `remaining`, bỏ `endAt` | `isPaused = true` |
| PM-05 | `resume()` → đặt lại `endAt` từ `remaining` | `isRunning = true` |
| PM-06 | `reset()` → về idle, dọn toàn bộ state | All reset, `isIdle = true` |
| PM-07 | `endEarly()` → finished nhưng KHÔNG phát chuông/notification | `isFinished = true` |
| PM-08 | Tab chạy nền: `tick()` sau khi nhảy thời gian → tự hiệu chỉnh đúng | `remaining` khớp đồng hồ thực |
| PM-09 | `saveSession()` thành công → gọi `useDataService.createSession` rồi `reset()` | Session lưu lên Supabase, state về idle |
| PM-10 | `saveSession()` khi Supabase lỗi → lỗi **THROW ra ngoài**, KHÔNG `reset()` | Giữ màn Session Complete + journal/emotion (không mất dữ liệu) |
| PM-11 | `persist()` khi running → ghi `localStorage['focus_session']`; khi idle → xóa key | State phiên được lưu / dọn đúng |
| PM-12 | `restore()` phiên running còn thời gian → khôi phục running + `endAt`; nếu đã hết giờ lúc đóng tab → nhảy thẳng `finished` (bỏ chuông trễ) | Phiên tiếp tục hoặc vào màn hoàn thành |

### B. Task store — `task.store` (cloud Supabase) (`tests/unit/stores/task.store.test.ts`)

> Store gọi thẳng Supabase (`getSupabase()`); test **mock Supabase client**
> (`from().select()/insert()/update()/delete()`). Bao gồm luồng review, khóa task
> theo phiên focus, banner lỗi tải, và các getter tính "hôm nay" cho dashboard.

| # | Test Case | Expected |
|---|---|---|
| SP-01 | `fetchTasks()` → đọc từ Supabase, map snake_case→camelCase, sort theo status (pending→in_progress→completed) | List khớp dữ liệu mock |
| SP-02 | `addTask()` → insert vào Supabase, task mới ở `status='pending'` | Task được thêm vào `tasks` |
| SP-03 | `toggleTask()` trên task chưa hoàn thành → cập nhật `status='completed'` | Status đổi qua `applyUpdate` |
| SP-04 | `updateTask()` → gọi Supabase update, cập nhật state cục bộ | Field thay đổi |
| SP-05 | `deleteTask()` → xóa khỏi Supabase + khỏi `tasks` | Task biến mất |
| SP-06 | `isLockedByFocus(taskId)` khi focus đang chạy/tạm dừng task đó | Trả về `true` |
| SP-07 | `toggleTask()` trên task đang khóa → ném `TaskLockedError` | Throw, không đổi status |
| SP-08 | `requestToggle()` trên task chưa hoàn thành → mở review prompt | `reviewTarget` được đặt |
| SP-09 | `requestToggle()` trên task đã hoàn thành → bỏ hoàn thành ngay, không hỏi review | Status về `pending` |
| SP-10 | `saveReview()` → lưu `review` rồi `toggleTask` thành completed | Review lưu, task completed |
| SP-11 | `skipReview()` → hoàn thành không lưu review | Task completed, review trống |
| SP-12 | `deleteTask()` trên task đang khóa focus → ném `TaskLockedError` | Throw, task không bị xóa |
| SP-13 | `fetchTasks()` khi Supabase lỗi → set `loadError`, không ném ra ngoài | `loadError` có message (dùng cho banner + nút Retry ở `tasks.vue`) |
| SP-14 | `completedToday` / `totalToday` → đếm task "hôm nay" (tạo hôm nay hoặc completed hôm nay) | done-count không bao giờ lớn hơn total; cấp số cho ô "Tasks Done" dashboard |

### C. Auth — `useAuth` (Supabase Auth + duyệt users) (`tests/unit/composables/useAuth.test.ts`)

> Auth là composable (KHÔNG có `auth.store`): Supabase Auth email/password,
> **admin = `public.users.role='admin'` trong DB** (KHÔNG dùng env `ADMIN_EMAILS`),
> chặn đăng nhập theo `public.users.status`. Khi mở app `syncSession()` re-validate
> role/status với DB; đổi mật khẩu phải re-auth mật khẩu cũ. Test **mock Supabase
> Auth + bảng users**.

| # | Test Case | Expected |
|---|---|---|
| AU-01 | `signUp()` → gọi `supabase.auth.signUp` (trigger DB tạo users status='pending') | Trả về data, không lỗi |
| AU-02 | `signUp()` với email demo → bị chặn | Throw "demo account" |
| AU-03 | `login()` user `status='approved'` → đăng nhập thành công | `currentUser` được đặt |
| AU-04 | `login()` user `status='pending'` → signOut + lỗi chờ duyệt | Throw "pending admin approval" |
| AU-05 | `login()` user `status='rejected'` → signOut + lỗi bị từ chối | Throw "rejected" |
| AU-06 | `login()` admin (`role='admin'` trong DB) → luôn được vào dù status | `isAdmin = true` |
| AU-07 | `getPendingUsers()` → trả về users có `status='pending'` | Mảng PendingUser đúng |
| AU-08 | `approveUser()` → `UPDATE users.status='approved'` | Supabase update được gọi |
| AU-09 | `rejectUser()` → `UPDATE users.status='rejected'` | Supabase update được gọi |
| AU-10 | `logout()` → signOut + xóa localStorage snapshot | `currentUser = null` |
| AU-11 | `getRejectedUsers()` → trả về users có `status='rejected'` | Mảng PendingUser đúng (mục Rejected ở admin/users) |
| AU-12 | `setUserStatus(id, status)` → `UPDATE users.status = status` (re-approve / set-pending) | Supabase update được gọi đúng giá trị |
| AU-13 | `syncSession()` khi user không phải admin và `status ≠ 'approved'` (bị demote/reject) → signOut + xóa snapshot + `navigateTo('/login')` | `currentUser = null` |
| AU-14 | `syncSession()` session hợp lệ + approved → cập nhật `currentUser` (role/status/name) từ DB | `currentUser` khớp DB, snapshot được ghi lại |
| AU-15 | `changePassword(new, current)` → re-auth `signInWithPassword` mật khẩu cũ; sai → throw "Mật khẩu hiện tại không đúng", đúng → `auth.updateUser({ password })` | Chỉ đổi khi mật khẩu cũ đúng |

### D. Data service — `useDataService` (`tests/unit/composables/useDataService.test.ts`)

> Lớp dữ liệu chung: map snake_case↔camelCase, gọi Supabase. Test mock Supabase client.

| # | Test Case | Expected |
|---|---|---|
| DS-01 | `createSession()` → insert focus_sessions, map camelCase→snake_case | Payload đúng schema |
| DS-02 | Hàm đọc → map snake_case→camelCase về model client | Object đúng kiểu |
| DS-03 | Supabase trả lỗi → được lan truyền / xử lý | Error được surface |

### E. Composables AI (`tests/unit/composables/`)

> **Cập nhật 2026-07-13**: `/emotion`, `/rag`, `/embed`, `/embed-all` đều đã deploy & live, và cả
> `useEmotionDetector.ts`/`useRAG.ts`/`useDataService.ts` đều gửi `Authorization: Bearer
> <access_token>` (trước đó `useEmotionDetector` không gửi gì — bug thật đã vá). Test cả nhánh có
> API thật (mock `$fetch` + mock `getSupabase().auth.getSession()`) lẫn fallback (khi thiếu URL).

| # | Test Case | Expected |
|---|---|---|
| CP-01 | `useEmotionDetector(journalText)` không có API → fallback regex client-side (đủ cả 5 nhãn, kể cả `unmotivated`) | Label hợp lệ (focused/stressed/exhausted/relaxed/unmotivated) |
| CP-02 | `useEmotionDetector` có API → POST `/emotion` kèm `Authorization` header, dùng kết quả Lambda | Label + confidence từ API |
| CP-02b | `useEmotionDetector` có API nhưng session hết hạn (`access_token` rỗng) → throw lỗi rõ ràng thay vì gọi API không token | Error message "Phiên đăng nhập đã hết hạn" |
| CP-03 | `useRAG(...)` không có API → fallback hardcode (2 item) | Mảng MediaItem |
| CP-03b | `useRAG(...)` có API → POST `/rag` kèm `Authorization` header + `{emotion, limit}` | Mảng kết quả từ API |
| CP-04 | `useReportExport()` không có API → tải `.md` ở client | Tạo file `.md` |
| CP-05 | `useConfig()` → đọc đúng cờ runtime config (`ragApiUrl`/`emotionApiUrl`/`ambientApiUrl` đều fallback về `apiGatewayUrl`) | Giá trị đúng |
| CP-06 | `useDataService().generateEmbedding(id)` → POST `/embed` kèm `Authorization` header | Gửi đúng header |
| CP-07 | `useDataService().generateAllEmbeddings()` → POST `/embed-all` kèm `Authorization` header, trả `count` | `number` đúng |

### E2. Ambient Sound (`useAmbientSound.ts`) — tính năng mới 2026-07-13

| # | Test Case | Expected |
|---|---|---|
| AMB-01 | `preview(url)` khi KHÔNG có track chính đang phát → tạo `Audio` riêng, phát 15s rồi tự dừng | `previewingUrl.value === url` trong 15s, `null` sau đó |
| AMB-02 | `preview(url)` khi ĐANG có track chính phát (`play()` trước đó) → pause tạm track chính (`intentionalStop=true`, không bị auto-resume listener resume lại), phát preview riêng | Track chính bị pause trong lúc preview |
| AMB-03 | Preview kết thúc (hết 15s hoặc gọi `stopPreview()`) → resume lại track chính đúng vị trí | `audio.paused === false` sau `stopPreview()` nếu trước đó đang phát |
| AMB-04 | Bấm `preview(url)` đúng track đang preview lần 2 → hủy sớm thay vì restart | `previewingUrl.value === null` ngay lập tức |
| AMB-05 | `focusStore.ambientTrack` đổi giá trị trong lúc `status === 'running'` → `app.vue` watcher gọi `ambient.play(track mới)` | Track đổi ngay, không restart timer |
| AMB-06 | `focusStore.ambientTrack` đổi giá trị trong lúc `status !== 'running'` (vd `paused`) → KHÔNG gọi `play()` ngay | Chỉ áp dụng khi resume về `running` |
| AMB-07 | Chọn track (kể cả "Silence") trong `AmbientPlayer.vue` khi đang preview → tự gọi `stopPreview()` trước, tránh chồng tiếng | `previewingUrl.value === null` sau khi chọn |

### F. Dashboard stats (tính inline trong `pages/dashboard.vue`)

> Dashboard KHÔNG có store riêng — 4 ô stat được tính trực tiếp trong `computeStats()`
> từ `getSessions()` + getter của `task.store`. Vì logic nằm trong component, test bằng
> **Vue Test Utils (mount + mock `useDataService`)**, hoặc tách hàm ra util để unit-test.

| # | Test Case | Expected |
|---|---|---|
| DB-01 | **Mood** = `emotionLabel` của **session mới nhất trong ngày** (sessions newest-first → `[0]`); không có session hôm nay → `'--'` | Nhãn cảm xúc mới nhất, không phải "mode" toàn bộ |
| DB-02 | **Streak**: hôm nay CHƯA focus không làm mất streak thật (bỏ qua `i===0`), đếm ngược ngày liên tiếp có session cho tới ngày đứt | Streak đúng dù hôm nay trống |
| DB-03 | **Today's Focus** = tổng `durationActual ?? durationPlanned` các session hôm nay (đổi ra phút); **Tasks Done** = `completedToday.length` / `totalToday.length` | Số phút + tỉ lệ tasks-done đúng |
| DB-04 | `getSessions()` lỗi → stats giữ mặc định, dashboard KHÔNG vỡ | `catch` nuốt lỗi, các ô ở giá trị mặc định |

## 4. Integration Tests (Vitest + Supabase CLI)

> Cloud-only: integration test chạy đối chiếu một Supabase local (`supabase start`)
> để kiểm chứng store ↔ DB thật (RLS, schema), KHÔNG còn vòng đời sync offline.

```typescript
// tests/integration/task.integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Requires: supabase start (local Supabase)
const supabase = createClient(
  'http://localhost:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // local anon key
)

describe('Task cloud round-trip', () => {
  beforeAll(async () => {
    // Sign in a seeded test user, seed any fixtures
  })

  it('insert task → read back from Supabase', async () => {
    const id = crypto.randomUUID()
    await supabase.from('tasks').insert({
      id,
      user_id: 'test-user',
      title: 'Integration Test Task',
      status: 'pending',
      priority: 1,
      duration_spent: 0,
    })

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()

    expect(data).not.toBeNull()
    expect(data.title).toBe('Integration Test Task')
  })
})
```

## 5. Python Lambda Tests (pytest)

> **Cập nhật 2026-07-13**: cả 6/6 Lambda giờ có code thật và đã deploy & live — không còn lambda
> nào "pending implementation". **Test coverage thực tế vẫn ~0%** (quyết định có chủ đích của
> project owner: để cuối cùng, không ưu tiên trong đợt làm AI/deploy) — bảng dưới đây là **test
> case NÊN viết**, chưa phải test đã tồn tại. `report-generator` đã bị bỏ khỏi kế hoạch
> (2026-07-10) — không cần test, xem `docs/PROJECT_STATE.md` mục 23.

### Lambdas có code + đã deploy (test case đề xuất)

| # | Lambda | Test Case | Expected |
|---|---|---|---|
| BFF-01 | `agent-bff` | Request hợp lệ → gọi Bedrock Agent, trả phản hồi chat | 200 + nội dung trả lời |
| BFF-02 | `agent-bff` | Payload thiếu trường bắt buộc → 400 BadRequest | Error response |
| AH-01 | `agent-action-handler` | Action `create_task` → insert vào Supabase tasks | Row được tạo |
| AH-02 | `agent-action-handler` | Action `update_task` / `delete_task` → cập nhật/xóa đúng task | DB phản ánh thay đổi |
| AH-03 | `agent-action-handler` | Action không hỗ trợ → trả lỗi rõ ràng | Error response |
| EMO-01 | `emotion-detector` | Text hợp lệ → `_classify()` trả 1 trong 5 nhãn app + confidence 0-1 | Label hợp lệ |
| EMO-02 | `emotion-detector` | Không có `Authorization` header → 401 | `{"message": "Thieu Authorization..."}` |
| EMO-03 | `emotion-detector` | Text >1000 ký tự → tự cắt còn 1000, không lỗi | 200, không throw |
| EMO-04 | `emotion-detector` | Confidence dưới `THRESHOLD_UNMOTIVATED` → label `unmotivated` bất kể model_label gốc là gì | Label = `unmotivated` |
| VEC-01 | `admin-vectorizer` | `/embed` với `mediaId` thật, token admin → ghi `embedding_vector` 1024 chiều | 200 + `{mediaId, dimensions:1024}` |
| VEC-02 | `admin-vectorizer` | `/embed` với token KHÔNG phải admin → 403 | Error response, KHÔNG ghi DB |
| VEC-03 | `admin-vectorizer` | `/embed-all` khi không có item nào `embedding_vector IS NULL` → `{count: 0}`, không lỗi | 200 |
| VEC-04 | `admin-vectorizer` | `/embed-all` batch nhiều item → 1 lệnh gọi Cohere (mock `invoke_model`, assert `call_count == 1`) | Batch, không lặp gọi |
| RAG-01 | `rag-recommender` | `/rag` với emotion hợp lệ + có media đã embed → trả mảng có `similarity` | Mảng non-empty |
| RAG-02 | `rag-recommender` | `/rag` với emotion không nằm trong `EMOTION_QUERY` → dùng `DEFAULT_QUERY`, không lỗi | 200 |
| RAG-03 | `rag-recommender` | `media_library` chưa có item nào embed → trả `[]`, không phải lỗi | 200, mảng rỗng |

> Mock `boto3.client('bedrock-runtime').invoke_model` cho `EMO-*`/`VEC-*`/`RAG-*` (tránh gọi
> Bedrock thật trong test) — trả sẵn 1 embedding cố định để assert phần logic downstream (ghi DB,
> map nhãn) mà không phụ thuộc network/cost thật.

## 6. Playwright E2E Tests (Optional MVP)

> E2E vẫn **optional** cho MVP; manual QA là đủ ở giai đoạn này.

```typescript
// tests/e2e/focus-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Focus Mode Flow', () => {
  test('User can sign in, create task, and start focus session', async ({ page }) => {
    await page.goto('/login')

    // Sign in (seeded demo account)
    await page.fill('[data-testid="email-input"]', 'user@focusmode.app')
    await page.fill('[data-testid="password-input"]', 'user123')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/dashboard')

    // Create task (created at status='pending')
    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-title-input"]', 'Write documentation')
    await page.click('[data-testid="save-task-button"]')
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Write documentation')

    // Start focus
    await page.click('[data-testid="start-focus-button"]')
    await expect(page.locator('[data-testid="focus-timer"]')).toBeVisible()
  })
})
```

## 7. Test Execution Commands

```bash
# Vitest (unit + integration) — script trong web/package.json
npm test                      # vitest (run all tests)
npm run test:coverage         # vitest --coverage

# Playwright (E2E, optional)
npx playwright install --with-deps chromium
npx playwright test

# Python Lambda tests (chỉ lambda có code)
cd aws/lambdas/agent-bff && pytest
cd aws/lambdas/agent-action-handler && pytest
```

## 8. Coverage Enforcement in CI

```yaml
# vitest_tests job:
script:
  - npm run test:coverage
  - |
    COVERAGE=$(node -e "
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json','utf8'));
      console.log(data.total.lines.pct);
    ")
    if [ "$(echo "$COVERAGE < 70" | bc)" -eq 1 ]; then
      echo "❌ Coverage ${COVERAGE}% is below 70% threshold!"
      exit 1
    fi
```

## 9. What is NOT Tested (MVP Scope)

| Exclusion | Reason |
|---|---|
| Offline / sync queue / Dexie / Last-Write-Wins | Đã gỡ khỏi codebase (cloud-only) — không còn module để test |
| Cả 6 Lambda AI (agent/emotion/rag/vectorizer/ambient) | Đã deploy & live, nhưng **0% test coverage** — quyết định có chủ đích của project owner (để cuối cùng, không ưu tiên trong đợt làm AI/deploy 2026-07). Test case NÊN viết đã liệt kê ở §5, chưa có test nào tồn tại thật. |
| `report-generator` | Đã bị bỏ khỏi kế hoạch hoàn toàn (2026-07-10) — không có gì để test |
| E2E UI tests (Playwright) | Optional; manual QA đủ cho MVP |
| Performance / load testing | Single-user app; Supabase Free Tier scales automatically |
| Security penetration testing | Academic project; RLS policies reviewed manually |
| Accessibility testing | Out of scope for MVP |
| Cross-browser testing | Chrome-only for MVP |
