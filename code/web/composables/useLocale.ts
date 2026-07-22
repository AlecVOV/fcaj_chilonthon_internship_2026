// composables/useLocale.ts
//
// App-wide English/Vietnamese toggle. Module-level shared state (same pattern
// as useAuth/useAgentChat) so every component reacts to the same locale.
// Persisted to localStorage (focus_locale) like focus_auth_user/focus_session.

import { en } from '~/i18n/en'
import { vi } from '~/i18n/vi'

export type Locale = 'en' | 'vi'

const dictionaries = { en, vi } as const

// ── Shared state ────────────────────────────────────────────────────────────
const locale = ref<Locale>('en')
let restored = false

function restoreLocale() {
  if (import.meta.server || restored) return
  restored = true
  try {
    const saved = localStorage.getItem('focus_locale')
    if (saved === 'en' || saved === 'vi') locale.value = saved
  } catch { /* ignore */ }
}

function resolve(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), dict)
}

// ── Composable ──────────────────────────────────────────────────────────────
export function useLocale() {
  if (!import.meta.server && !restored) restoreLocale()

  /** Translate a dot-path key, e.g. t('nav.dashboard'). Falls back to English, then the key itself. */
  function t(key: string, vars?: Record<string, string | number>): string {
    const raw = resolve(dictionaries[locale.value], key) ?? resolve(dictionaries.en, key) ?? key
    let str = typeof raw === 'string' ? raw : key
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v))
    return str
  }

  function setLocale(l: Locale) {
    locale.value = l
    if (!import.meta.server) { try { localStorage.setItem('focus_locale', l) } catch { /* ignore */ } }
  }

  return { locale: computed(() => locale.value), t, setLocale }
}
