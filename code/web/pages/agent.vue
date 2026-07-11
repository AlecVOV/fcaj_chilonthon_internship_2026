<template>
  <div class="animate-in h-full">
    <div class="mb-4">
      <h1 class="font-display text-display-sm text-ink dark:text-on-dark">Task Assistant</h1>
      <p class="mt-1.5 text-sm text-ink-body dark:text-on-dark-soft">
        Describe what you need to get done — the agent will create tasks or ask clarifying questions.
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <!-- Sidebar: danh sách đoạn chat -->
      <aside class="card !p-3 flex flex-col gap-2 h-[calc(100vh-11rem)]">
        <button @click="newConversation" class="btn-primary w-full text-sm">+ New chat</button>
        <div class="flex-1 overflow-y-auto space-y-1 min-h-0">
          <p v-if="isLoadingList && conversations.length === 0" class="py-2 text-center text-2xs text-ink-soft dark:text-on-dark-soft/70">Đang tải…</p>
          <p v-else-if="conversations.length === 0" class="py-2 text-center text-2xs text-ink-soft dark:text-on-dark-soft/70">Chưa có hội thoại. Bắt đầu chat để lưu.</p>
          <div
            v-for="c in conversations"
            :key="c.id"
            class="group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors"
            :class="c.id === currentId
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'text-ink-body dark:text-on-dark-soft hover:bg-canvas-card dark:hover:bg-surface-dark-soft'"
            @click="selectConversation(c.id)"
          >
            <span class="flex-1 truncate">{{ c.title }}</span>
            <button
              @click.stop="deleteConversation(c.id)"
              class="shrink-0 opacity-0 group-hover:opacity-100 text-ink-soft hover:text-error text-xs px-1"
              title="Xóa hội thoại"
            >✕</button>
          </div>
        </div>
      </aside>

      <!-- Khung chat -->
      <AgentChat />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAgentChat } from '~/composables/useAgentChat'

definePageMeta({ middleware: ['auth'] })

const { conversations, currentId, isLoadingList, loadConversations, selectConversation, newConversation, deleteConversation } = useAgentChat()

onMounted(async () => {
  await loadConversations()
  if (conversations.value.length) selectConversation(conversations.value[0].id)
  else newConversation()
})
</script>
