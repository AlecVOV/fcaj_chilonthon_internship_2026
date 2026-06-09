## Admin Features (Post-Worklog Removal)

### 1. User Management

The core admin capability — oversee who's using the system.

| Feature | Description |
|---------|-------------|
| View all users | Table: name, email, role, total focus time, session count, join date |
| Change user role | Toggle between `user` and `admin` |
| Delete user | Remove accounts (with confirmation) |
| View user activity | See any user's task list and focus sessions (support/debug) |

**Data source:** `useDataService().getUsers()` — already implemented in `adminUsersStore`.

---

### 2. Media Library Management

Control what content the RAG recommender can suggest to users.

| Feature | Description |
|---------|-------------|
| View all media | Table: title, type (sutra/audio/video), content, source, embedding status |
| Add media | Form: title, type dropdown, content text/URL, source, tags |
| Edit media | Same form, pre-filled |
| Delete media | Confirmation dialog |
| Generate embeddings | Per-item "Embed" button with loading state |
| Batch embed | "Generate All Embeddings" button |
| Search/filter | Filter by title or source |

**Data source:** `useDataService().getMedia()`, `createMedia()`, `updateMedia()`, `deleteMedia()` — already implemented.

---

### 3. System-Wide Statistics

A high-level dashboard for admin overview.

| Stat | What it shows |
|------|--------------|
| Total users | Count of all registered users |
| Total sessions today | How many focus sessions across all users |
| Average focus time | Mean duration per session (all users) |
| Total focus minutes | Cumulative across all users |
| Media items | Count + how many have embeddings |

**Data source:** `useDataService().getAdminStats()` — already returns all these fields.

---

### 4. Cross-User Data Visibility

Admin can see **any user's** data for debugging or support.

| View | Description |
|------|-------------|
| All tasks (admin view) | Table showing every user's tasks with status, user ID |
| All sessions (admin view) | Every user's focus sessions with mood, duration |

This already exists in the admin overview page (`pages/admin.vue`).

---

### What Admin Should NOT Have

| Feature | Why excluded |
|---------|-------------|
| Creating/editing tasks for users | Users manage their own tasks |
| Starting focus sessions | Timer is a personal UX feature |
| Writing journal entries | Post-session reflection is personal |
| Worklog management | **You're eliminating this** |
| Report generation on behalf of users | Reports should be per-user, triggered by user |

---

### Current Implementation Status (in web)

| Admin Feature | Status | File |
|--------------|--------|------|
| User list + role toggle + delete | ✅ Done | `pages/admin/users.vue` |
| Media CRUD + embedding | ✅ Done | `pages/admin/media.vue` |
| Admin overview + stats + all tasks | ✅ Done | `pages/admin.vue` |
| Admin middleware (role gate) | ✅ Done | `middleware/admin.ts` |
| Role-based nav link | ✅ Done | `layouts/default.vue` (`v-if="isAdmin"`) |

---

### What Could Be Added (Optional)

| Feature | Value |
|---------|-------|
| **Session log viewer** | Click a user → see their session history (mood, duration, journal) — useful for support |
| **User invite system** | Admin generates invite links for new users (instead of open registration) |
| **System config** | Toggle features on/off (e.g., disable RAG, change max session duration) |
| **Export all data** | Download CSV of all users/stats for reporting |

---

**Bottom line:** Your admin already has the three core pillars — **user management**, **media library**, and **system stats**. That's solid. You don't need worklogs; the admin's job is governance, not content.