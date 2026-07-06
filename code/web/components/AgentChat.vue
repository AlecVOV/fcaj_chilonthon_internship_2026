<template>
  <div class="card flex flex-col h-[calc(100vh-14rem)]">
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
          <p class="whitespace-pre-wrap">{{ msg.text }}</p>

          <!-- Task cards created by agent -->
          <div v-if="msg.tasks?.length" class="mt-2 space-y-1">
            <div
              v-for="task in msg.tasks"
              :key="task.id"
              class="rounded-md border border-hairline dark:border-hairline-dark bg-canvas dark:bg-surface-dark-elevated px-2.5 py-2 text-sm"
            >
              <p class="font-medium text-ink dark:text-on-dark">{{ task.title }}</p>
              <p class="mt-0.5 text-ink-soft dark:text-on-dark-soft">Status: {{ task.status }}</p>
            </div>
          </div>

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
    <div class="pt-3 border-t border-hairline dark:border-hairline-dark flex gap-2">
      <input
        ref="inputEl"
        v-model="inputText"
        class="input flex-1"
        placeholder="E.g., I need to write an internship report about cloud architecture..."
        @keyup.enter="handleSend"
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

const { messages, isLoading, error, sendMessage, clearChat } = useAgentChat()

const inputText = ref('')
const inputEl = ref<HTMLInputElement>()
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

async function handleSend() {
  if (!inputText.value.trim() || isLoading.value) return
  const text = inputText.value
  inputText.value = ''
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
