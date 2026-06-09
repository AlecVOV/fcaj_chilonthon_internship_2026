# Testing Plan (Nuxt 4 / Web-Only)

> **Project:** Focus Mode App (Web-Only)  
> **Coverage Target:** 70% line coverage (critical logic)  
> **Test Runner:** Vitest (unit + integration)  
> **E2E (Optional MVP):** Playwright  
> **Lambda Tests:** pytest (unchanged)  

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
        'services/**/*.ts',
        'composables/**/*.ts',
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

### A. SyncService (`tests/unit/services/sync.service.test.ts`)

| # | Test Case | Expected |
|---|---|---|
| SQ-01 | Enqueue INSERT → process when online → record pushed to Supabase | `isSynced = true` |
| SQ-02 | Enqueue UPDATE → offline → queue stored → online → pushed | Record updated on server |
| SQ-03 | Enqueue DELETE → process → server record deleted | Record absent from server |
| SQ-04 | Network fails mid-sync → retry count incremented | `retryCount` incremented; other items preserved |
| SQ-05 | Max retries (5) exceeded → item removed from queue, error logged | `retryCount = 5`, item deleted |
| SQ-06 | Two items queued → batch processed in FIFO order | Both synced in order |
| SQ-07 | Empty queue → `processQueue()` returns early | No-op, no errors |
| SQ-08 | `isSyncing = true` → concurrent call skipped | Second call returns early |

### B. LWW Conflict Resolution (`tests/unit/services/sync.service.test.ts`)

| # | Test Case | Expected |
|---|---|---|
| CR-01 | Client `updated_at` > Server → client wins | Server overwritten |
| CR-02 | Server `updated_at` > Client → server wins | Local overwritten |
| CR-03 | Equal `updated_at` → server wins | Local matches server |
| CR-04 | Client UPDATE on server-deleted record → discard | Local record deleted |
| CR-05 | Client INSERT → server already has record → LWW | Newer timestamp wins |

### C. IndexedDB (Dexie) (`tests/unit/database/indexeddb.test.ts`)

| # | Test Case | Expected |
|---|---|---|
| DB-01 | `upsertTask` with new ID → inserted | Row count +1 |
| DB-02 | `upsertTask` with existing ID → updated | Row count unchanged, fields updated |
| DB-03 | `getUnsyncedTasks` → returns only `isSynced = false` | Correct filtering |
| DB-04 | `markTaskSynced` → `isSynced = true` | Field updated |
| DB-05 | `enqueueSync` → item in queue with correct payload | All fields match |
| DB-06 | `getPendingSyncItems` → ordered by `createdAt` ASC | FIFO order |
| DB-07 | `removeSyncItem` → item deleted | Row count -1 |
| DB-08 | `incrementRetry` → `retryCount + 1`, `lastError` set | Both fields updated |
| DB-09 | Dexie hooks auto-set `isSynced = false` on create | Hook fires correctly |

### D. Pomodoro Timer (`tests/unit/stores/focus.store.test.ts`)

| # | Test Case | Expected |
|---|---|---|
| PM-01 | Start timer → state = running, initial duration set | `isRunning = true` |
| PM-02 | Timer ticks 1 second → remaining decreased by 1 | `remaining = initial - 1` |
| PM-03 | Timer reaches 0 → state = finished | `isFinished = true` |
| PM-04 | Pause timer → state = paused | `isRunning = false` |
| PM-05 | Resume timer → state = running | `isRunning = true` |
| PM-06 | Reset timer → remaining = initial, state = idle | All reset |
| PM-07 | Configure duration = 25 min → timer initialized correctly | `initialDuration = 1500` |

### E. Pinia Stores (`tests/unit/stores/`)

| # | Test Case | Expected |
|---|---|---|
| SP-01 | `tasksStore.fetchTasks()` reads from Dexie → returns tasks | List matches DB |
| SP-02 | `tasksStore.addTask()` → persisted in Dexie + enqueued | Task in local DB + sync queue |
| SP-03 | `tasksStore.toggleTask()` → status updated, sync enqueued | Status changed; sync item created |
| SP-04 | `focusStore.endSession()` → emotion detected via Lambda | Session complete, emotion set |

### F. Composables (`tests/unit/composables/`)

| # | Test Case | Expected |
|---|---|---|
| CP-01 | `useEmotionDetector(journalText)` → returns emotion label | Correct label + confidence |
| CP-02 | `useRAG(sessionId)` → returns recommendations | Array of MediaItem |
| CP-03 | `useSupabase()` → provides supabase client | Client is defined |
| CP-04 | `useDB()` → provides Dexie instance | DB instance is FocusAppDB |

## 4. Integration Tests (Vitest + Supabase CLI)

```typescript
// tests/integration/sync.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getDB } from '~/database/indexeddb_schema'

// Requires: supabase start (local Supabase)
const supabase = createClient(
  'http://localhost:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // local anon key
)

describe('Sync Integration', () => {
  beforeAll(async () => {
    // Seed test data
  })

  it('full sync cycle: create offline → go online → verify server', async () => {
    const db = getDB()
    const task: LocalTask = {
      id: crypto.randomUUID(),
      userId: 'test-user',
      title: 'Integration Test Task',
      status: 'pending',
      priority: 1,
      durationSpent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isSynced: false,
      syncOperation: 'INSERT',
    }

    await db.upsertTask(task)

    // Simulate going online
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const syncService = useSyncService(supabase)
    await syncService.processQueue()

    // Verify server has the record
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task.id)
      .single()

    expect(data).not.toBeNull()
    expect(data.title).toBe('Integration Test Task')
  })
})
```

## 5. Python Lambda Tests (pytest — unchanged)

| # | Test Case | Expected |
|---|---|---|
| ED-01 | "I was completely focused today" → `focused` + confidence > 0.7 | Correct label |
| ED-02 | "" → 400 BadRequest | Error response |
| RG-01 | `render_latex_template()` with complete context → valid `.tex` string with new template variables | `\documentclass` present; `{{REPORT-DATE-FULL}}` replaced; `{{TASK-LIST-ROWS}}` rendered |
| RG-02 | Template with missing optional fields → defaults used (empty strings) | No `{{...}}` placeholders remain in output |
| RR-01 | Session with `stressed` → returns calming content | Top result in `[sutra, audio]` |
| AV-01 | Valid content → embedding stored, dimension = 384 | `len(vector) == 384` |

*(Full Python test cases unchanged from original — see previous testing-plan.md)*

## 6. Playwright E2E Tests (Optional MVP)

```typescript
// tests/e2e/focus-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Focus Mode Flow', () => {
  test('User can sign in, create task, and start focus session', async ({ page }) => {
    await page.goto('/')

    // Sign in
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/dashboard')

    // Create task
    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-title-input"]', 'Write documentation')
    await page.click('[data-testid="save-task-button"]')
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Write documentation')

    // Start focus
    await page.click('[data-testid="start-focus-button"]')
    await expect(page.locator('[data-testid="focus-timer"]')).toBeVisible()
    await expect(page.locator('[data-testid="dark-overlay"]')).toBeVisible()
  })
})
```

## 7. Test Execution Commands

```bash
# Vitest (unit + integration)
pnpm test                    # Run all tests
pnpm test -- --coverage      # With coverage
pnpm test -- --ui            # Interactive UI mode

# Playwright (E2E)
npx playwright install --with-deps chromium
npx playwright test

# Python Lambda tests
cd lambdas && pytest --cov=. --cov-report=html

# Generate coverage badge
pnpm test -- --coverage && npx istanbul-badges-readme
```

## 8. Coverage Enforcement in CI

```yaml
# In cicd-cloudflare-pages.yml — vitest_tests job:
script:
  - pnpm run test --coverage
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
| E2E UI tests (Playwright) | Optional; manual QA sufficient for MVP |
| Performance / load testing | Single-user app; Supabase Free Tier scales automatically |
| Security penetration testing | Academic project; RLS policies reviewed manually |
| Accessibility testing | Out of scope for MVP |
| LaTeX compilation in CI | Only `.tex` string generation tested (Tectonic skipped in CI) |
| Cross-browser testing | Chrome-only for MVP |
