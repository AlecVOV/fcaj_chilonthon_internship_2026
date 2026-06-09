# Admin CMS — Nuxt 4 Dashboard (Role-Gated)

> **Project:** Focus Mode App (Web-Only)  
> **Platform:** Nuxt 4 (same codebase as main app, admin middleware)  
> **Access:** Admin-only (Supabase RLS + `app_metadata.role === 'admin'`)  
> **Core Features:** Media library CRUD + Vectorization trigger + Aggregated stats  

---

## 1. Architecture

```
┌──────────────────────────────────────────────────┐
│           Nuxt 4 Web App (Single Codebase)         │
│                                                    │
│  /dashboard, /focus, /tasks, ...     ← User routes │
│  /admin/*                            ← Admin routes │
│                                                    │
│  ┌──────────────────────────────────┐            │
│  │  middleware/admin.ts              │            │
│  │  Checks authStore.isAdmin         │            │
│  │  Redirects non-admin to /dashboard│            │
│  └──────────────────────────────────┘            │
│                                                    │
│  Admin Pages:                                      │
│  ┌─────────────┐  ┌──────────────┐               │
│  │ Dashboard    │  │ Media Library │               │
│  │ (Stats)      │  │ Manager       │               │
│  └─────────────┘  └──────┬───────┘               │
│                          │                         │
│         POST /api/admin/vectorize                   │
│         (Nitro server proxy → Lambda)               │
└──────────────────────────┼────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │  API Gateway  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────────┐
                    │  focus-admin-     │
                    │  vectorize Lambda │
                    └──────┬───────────┘
                           │
                    ┌──────▼───────────┐
                    │  Supabase         │
                    │  media_library    │
                    │  (pgvector)       │
                    └──────────────────┘
```

## 2. Admin Middleware

```typescript
// middleware/admin.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()

  // Not authenticated → redirect to login
  if (!authStore.isAuthenticated) {
    return navigateTo('/?redirect=' + to.fullPath)
  }

  // Authenticated but not admin → redirect to dashboard
  if (!authStore.isAdmin) {
    return navigateTo('/dashboard')
  }

  // Admin → allow
})
```

Applied to admin routes:

```vue
<!-- pages/admin/index.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'admin'],  // Both global auth + admin check
  layout: 'default',
})
</script>
```

### Setting Admin Role in Supabase

```sql
-- Mark a specific user as admin
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = '{{ADMIN_EMAIL}}';
```

## 3. Routes & Navigation

```
/admin                → Admin Dashboard (aggregate stats)
/admin/media          → Media Library list
/admin/media/add      → Add new media item (form + vectorize)
/admin/media/[id]     → Edit media item
/admin/users          → User overview list
/admin/users/[id]     → Per-user detail & analytics
```

## 4. Admin Dashboard Page

```vue
<!-- pages/admin/index.vue -->
<script setup lang="ts">
import { useAdminStats } from '~/composables/useAdminStats'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'default',
})

const { stats, isLoading, error, refresh } = useAdminStats()
</script>

<template>
  <div class="admin-dashboard">
    <h1>Admin Dashboard</h1>

    <!-- Stat Cards -->
    <div class="stats-grid">
      <StatCard title="Total Users" :value="stats?.totalUsers ?? 0" icon="👥" />
      <StatCard title="Total Focus Hours" :value="stats?.totalFocusHours ?? 0" icon="⏱️" />
      <StatCard title="Active Today" :value="stats?.activeToday ?? 0" icon="✅" />
      <StatCard title="Media Items" :value="stats?.mediaCount ?? 0" icon="📚" />
    </div>

    <!-- Leaderboard -->
    <section class="leaderboard">
      <h2>🏆 Top Focus Users (This Month)</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>Total Hours</th>
            <th>Streak</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, i) in stats?.leaderboard" :key="entry.userId">
            <td>{{ i + 1 }}</td>
            <td>
              <NuxtLink :to="`/admin/users/${entry.userId}`">
                {{ entry.displayName ?? entry.userId.slice(0, 8) }}
              </NuxtLink>
            </td>
            <td>{{ (entry.totalSeconds / 3600).toFixed(1) }}h</td>
            <td>🔥 {{ entry.streakDays }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Media Library Breakdown -->
    <section>
      <h2>Media Library</h2>
      <div class="media-breakdown">
        <div v-for="(count, type) in stats?.mediaByType" :key="type">
          <span>{{ type }}</span>: <strong>{{ count }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
</style>
```

### Admin Stats Composable

```typescript
// composables/useAdminStats.ts
export function useAdminStats() {
  const stats = ref<AdminStats | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStats() {
    isLoading.value = true
    try {
      const { $supabase } = useNuxtApp()
      const supabase = $supabase as SupabaseClient

      // Parallel queries
      const [
        { count: totalUsers },
        { data: hoursData },
        { data: mediaData },
        { data: leaderboard },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_total_focus_hours'),
        supabase.from('media_library').select('type'),
        supabase
          .from('daily_stats')
          .select('user_id, total_focus_seconds')
          .gte('date', new Date(Date.now() - 30 * 86400000).toISOString())
          .order('total_focus_seconds', { ascending: false })
          .limit(10),
      ])

      // Count by media type
      const mediaByType: Record<string, number> = {}
      for (const item of (mediaData ?? [])) {
        mediaByType[item.type] = (mediaByType[item.type] ?? 0) + 1
      }

      stats.value = {
        totalUsers: totalUsers ?? 0,
        totalFocusHours: (hoursData as any)?.total_hours ?? 0,
        mediaCount: (mediaData ?? []).length,
        activeToday: 0, // TODO: query from daily_stats where date = today
        mediaByType,
        leaderboard: (leaderboard ?? []).map((row) => ({
          userId: row.user_id,
          totalSeconds: row.total_focus_seconds,
          streakDays: 0, // TODO: compute streak
        })),
      }
    } catch (e: any) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  return { stats, isLoading, error, refresh: fetchStats }
}

interface AdminStats {
  totalUsers: number
  totalFocusHours: number
  mediaCount: number
  activeToday: number
  mediaByType: Record<string, number>
  leaderboard: AdminLeaderboardEntry[]
}

interface AdminLeaderboardEntry {
  userId: string
  displayName?: string
  totalSeconds: number
  streakDays: number
}
```

## 5. Media Library — CRUD Page

```vue
<!-- pages/admin/media.vue -->
<script setup lang="ts">
import { useMediaLibrary } from '~/composables/useMediaLibrary'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'default',
})

const {
  media,
  isLoading,
  typeFilter,
  searchQuery,
  fetchMedia,
  deactivateMedia,
} = useMediaLibrary()

const showAddForm = ref(false)

onMounted(() => fetchMedia())
</script>

<template>
  <div class="media-library">
    <div class="header">
      <h1>Media Library</h1>
      <button @click="showAddForm = true">+ Add New</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="typeFilter" @change="fetchMedia">
        <option value="">All Types</option>
        <option value="quote">Quote</option>
        <option value="sutra">Sutra</option>
        <option value="video">Video</option>
        <option value="article">Article</option>
        <option value="audio">Audio</option>
      </select>
      <input
        v-model="searchQuery"
        placeholder="Search media..."
        @input="fetchMedia"
      />
    </div>

    <!-- Media List -->
    <div v-if="isLoading" class="loading">Loading...</div>
    <div v-else class="media-grid">
      <MediaCard
        v-for="item in media"
        :key="item.id"
        :item="item"
        @deactivate="deactivateMedia(item.id)"
        @edit="navigateTo(`/admin/media/${item.id}`)"
      />
    </div>

    <!-- Add Form (modal or inline) -->
    <MediaAddForm
      v-if="showAddForm"
      @close="showAddForm = false"
      @saved="showAddForm = false; fetchMedia()"
    />
  </div>
</template>
```

## 6. Add Media — Vectorization Trigger

```vue
<!-- pages/admin/media/add.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'admin'],
})

const title = ref('')
const contentText = ref('')
const contentUrl = ref('')
const type = ref<'quote' | 'sutra' | 'video' | 'article' | 'audio'>('quote')
const source = ref('')
const tags = ref<string[]>([])

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const submitSuccess = ref(false)

async function handleSubmit() {
  if (!title.value || !contentText.value) return

  isSubmitting.value = true
  submitError.value = null

  try {
    // Call Nitro server proxy → API Gateway → Lambda
    const response = await $fetch('/api/admin/vectorize', {
      method: 'POST',
      body: {
        title: title.value,
        content_text: contentText.value,
        content_url: contentUrl.value || undefined,
        type: type.value,
        source: source.value || undefined,
        tags: tags.value,
      },
    })

    submitSuccess.value = true
    setTimeout(() => navigateTo('/admin/media'), 1500)
  } catch (e: any) {
    submitError.value = e.data?.message ?? 'Vectorization failed'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="media-add-page">
    <h1>Add New Content</h1>

    <form @submit.prevent="handleSubmit">
      <!-- Type selector -->
      <div class="field">
        <label>Type</label>
        <select v-model="type">
          <option value="quote">Quote</option>
          <option value="sutra">Sutra</option>
          <option value="video">Video</option>
          <option value="article">Article</option>
          <option value="audio">Audio</option>
        </select>
      </div>

      <!-- Title -->
      <div class="field">
        <label>Title *</label>
        <input v-model="title" required placeholder="e.g., Patience in Adversity" />
      </div>

      <!-- Content Text -->
      <div class="field">
        <label>Content Text *</label>
        <textarea
          v-model="contentText"
          required
          rows="8"
          placeholder="Paste full text to be embedded..."
        />
      </div>

      <!-- URL (optional) -->
      <div class="field">
        <label>Content URL (optional)</label>
        <input v-model="contentUrl" placeholder="https://youtube.com/watch?v=..." />
      </div>

      <!-- Source -->
      <div class="field">
        <label>Source</label>
        <input v-model="source" placeholder="e.g., Lamrim Class 2023 — Week 5" />
      </div>

      <!-- Tags -->
      <div class="field">
        <label>Tags</label>
        <TagInput v-model="tags" />
      </div>

      <!-- Submit -->
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Vectorizing...' : '🚀 Vectorize & Save' }}
      </button>

      <p v-if="submitError" class="error">{{ submitError }}</p>
      <p v-if="submitSuccess" class="success">✅ Content embedded & saved! Redirecting...</p>
    </form>
  </div>
</template>
```

## 7. Nitro Server Proxy (Hides Lambda URL)

```typescript
// server/api/admin/vectorize.post.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Verify admin role (server-side)
  const authStore = await getSupabaseSession(event)
  if (!authStore?.user?.app_metadata?.role === 'admin') {
    throw createError({ statusCode: 403, message: 'Admin role required' })
  }

  const body = await readBody(event)

  const response = await $fetch(
    `${config.public.apiGatewayUrl}/admin/vectorize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiGatewayKey,
        'Authorization': `Bearer ${authStore.accessToken}`,
      },
      body,
    }
  )

  return response
})
```

## 8. Media Library Composable

```typescript
// composables/useMediaLibrary.ts
export function useMediaLibrary() {
  const media = ref<MediaItem[]>([])
  const isLoading = ref(false)
  const typeFilter = ref('')
  const searchQuery = ref('')

  async function fetchMedia() {
    isLoading.value = true
    try {
      const { $supabase } = useNuxtApp()
      const supabase = $supabase as SupabaseClient

      let query = supabase.from('media_library').select('*')

      if (typeFilter.value) {
        query = query.eq('type', typeFilter.value)
      }
      if (searchQuery.value) {
        query = query.ilike('title', `%${searchQuery.value}%`)
      }

      const { data } = await query
        .order('created_at', { ascending: false })
        .limit(50)

      media.value = (data ?? []) as MediaItem[]
    } finally {
      isLoading.value = false
    }
  }

  async function deactivateMedia(id: string) {
    const { $supabase } = useNuxtApp()
    const supabase = $supabase as SupabaseClient
    await supabase.from('media_library').update({ is_active: false }).eq('id', id)
    await fetchMedia()
  }

  return {
    media,
    isLoading,
    typeFilter,
    searchQuery,
    fetchMedia,
    deactivateMedia,
  }
}
```

## 9. Embedding Trigger Flow

```
Admin submits "Add Content" form
    │
    ▼
Nuxt page → $fetch('/api/admin/vectorize')   (Nitro server proxy)
    │
    ▼
Nitro server validates admin JWT → forwards to API Gateway
    │
    ▼
Lambda: focus-admin-vectorize
    │
    ├── Validate admin JWT (app_metadata.role === "admin")
    ├── Load all-MiniLM-L6-v2 model (cached in global scope)
    ├── model.encode(content_text) → 384-dim vector
    └── INSERT INTO media_library (..., embedding_vector)
    │
    ▼
Supabase pgvector index auto-updated
    │
    ▼
Content immediately available in RAG similarity searches
```

## 10. Deployment

Admin CMS is part of the main Nuxt app — no separate deploy needed:

```bash
# Build (includes admin routes)
pnpm run build

# Deploy to Cloudflare Pages (via GitLab CI)
npx wrangler pages deploy dist/ --project-name focus-mode-app
```

Access at: `https://focus-mode-app.pages.dev/admin/` (behind admin middleware)

## 11. Security Considerations

| Concern                 | Mitigation                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Unauthorized access** | `middleware/admin.ts` checks `authStore.isAdmin` on every admin route                   |
| **API abuse**           | Nitro server validates admin role before proxying to Lambda; API Gateway rate limiting  |
| **Vectorization cost**  | Admin-only; Lambda Free Tier covers moderate use                                        |
| **Data exposure**       | RLS policy: admin can INSERT/UPDATE `media_library`; all authenticated users can SELECT |
| **JWT expiry**          | Auto-refresh via Supabase SDK; Nitro middleware redirects on 401                        |
