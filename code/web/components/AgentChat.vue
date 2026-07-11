<template>
  <div class="card flex flex-col h-[calc(100vh-11rem)]">
    <!-- Header -->
    <div class="pb-3 border-b border-hairline dark:border-hairline-dark">
      <h2 class="font-display text-lg text-ink dark:text-on-dark">Task Assistant</h2>
      <p class="mt-0.5 text-sm text-ink-muted dark:text-on-dark-soft">
        Describe what you need to do — I'll create tasks or ask clarifying questions.
      </p>
    </div>

    <!-- Messages -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto py-3 space-y-3 min-h-0">
      <!-- Empty State -->
      <div v-if="messages.length === 0" class="py-8 text-center">
        <p class="text-sm text-ink-soft dark:text-on-dark-soft/70 mb-4">Start by telling me what you need to work on.</p>
        <div class="flex flex-wrap gap-2 justify-center">
          <button
            v-for="example in examplePrompts"
            :key="example"
            @click="sendMessage(example)"
            class="rounded-md border border-hairline dark:border-hairline-dark px-3 py-1.5 text-sm text-ink-muted dark:text-on-dark-soft hover:bg-canvas-card dark:hover:bg-surface-dark-soft transition-colors"
          >
            {{ example }}
          </button>
        </div>
      </div>

      <!-- Message Bubbles -->
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[80%] rounded-lg px-4 py-2.5 text-sm"
          :class="msg.role === 'user'
            ? 'bg-primary text-white'
            : 'bg-canvas-card dark:bg-surface-dark-soft text-ink dark:text-on-dark'"
        >
          <div class="chat-markdown" :class="{ 'chat-markdown--user': msg.role === 'user' }" v-html="renderMarkdown(msg.text)" />

          <p class="mt-1 text-2xs opacity-40 text-right">
            {{ new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
          </p>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="isLoading" class="flex justify-start">
        <div class="bg-canvas-card dark:bg-surface-dark-soft rounded-lg px-4 py-2.5 text-sm text-ink-muted dark:text-on-dark-soft">
          Thinking...
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="text-center text-sm text-error dark:text-error">
        {{ error }}
      </div>
    </div>

    <!-- Input -->
    <div class="pt-3 border-t border-hairline dark:border-hairline-dark flex gap-2 items-end">
      <textarea
        ref="inputEl"
        v-model="inputText"
        rows="1"
        class="input flex-1 resize-none max-h-40 py-2"
        placeholder="E.g., I need to write an internship report about cloud architecture... (Shift+Enter để xuống dòng)"
        @keydown="handleKeydown"
        @input="autosize"
        :disabled="isLoading"
      />
      <button
        @click="handleSend"
        class="btn-primary text-sm"
        :disabled="isLoading || !inputText.trim()"
      >
        {{ isLoading ? '...' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAgentChat } from '~/composables/useAgentChat'
import { renderMarkdown } from '~/utils/markdown'

const { messages, isLoading, error, sendMessage } = useAgentChat()

const inputText = ref('')
const inputEl = ref<HTMLTextAreaElement>()
const chatContainer = ref<HTMLDivElement>()

const examplePrompts = [
  'Write internship report about cloud architecture',
  'Study for math exam on Friday',
  'Prepare presentation slides for team meeting',
]

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// Enter gửi tin; Shift+Enter (hoặc Ctrl/Cmd+Enter) xuống dòng như các chat app khác.
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    handleSend()
  }
}

// Auto-grow textarea theo nội dung (tối đa max-h-40 ở CSS, phần dư sẽ cuộn).
function autosize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

async function handleSend() {
  if (!inputText.value.trim() || isLoading.value) return
  const text = inputText.value
  inputText.value = ''
  nextTick(autosize)
  await sendMessage(text)
  scrollToBottom()
}

// Focus input on mount
onMounted(() => {
  inputEl.value?.focus()
})

// Scroll when messages change
watch(() => messages.value.length, () => {
  scrollToBottom()
})
</script>

<style scoped>
/* Scrollbar giờ theo màu theme GLOBAL ở assets/css/main.css (áp dụng toàn app), không
   cần định nghĩa riêng ở đây nữa. */

/* v-html bypass scoped styles trừ khi dùng :deep() — style nội dung markdown render ra. */
.chat-markdown :deep(p) { margin: 0 0 0.5em; white-space: pre-wrap; }
.chat-markdown :deep(p:last-child) { margin-bottom: 0; }
.chat-markdown :deep(ul),
.chat-markdown :deep(ol) { margin: 0 0 0.5em; padding-left: 1.25em; }
.chat-markdown :deep(li) { margin: 0.15em 0; }
.chat-markdown :deep(strong) { font-weight: 600; }
.chat-markdown :deep(a) { text-decoration: underline; }
.chat-markdown :deep(code) {
  background: rgb(0 0 0 / 0.08);
  border-radius: 0.25em;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}
.chat-markdown :deep(pre) {
  background: rgb(0 0 0 / 0.08);
  border-radius: 0.375em;
  padding: 0.6em 0.75em;
  overflow-x: auto;
  margin: 0 0 0.5em;
}
.chat-markdown :deep(pre code) { background: none; padding: 0; }
.chat-markdown :deep(blockquote) {
  border-left: 2px solid currentColor;
  opacity: 0.85;
  padding-left: 0.75em;
  margin: 0 0 0.5em;
}
.chat-markdown--user :deep(code),
.chat-markdown--user :deep(pre) { background: rgb(255 255 255 / 0.15); }
</style>
