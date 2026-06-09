// composables/useConfig.ts
// Centralised configuration — toggles between POC mock mode and real cloud back‑end.
//
// When migrating to cloud:
//   1. Set USE_MOCK_BACKEND = false in .env (or NUXT_PUBLIC_USE_MOCK_BACKEND=false)
//   2. All composables that read this flag will switch to Supabase / API Gateway automatically.

export function useConfig() {
  const config = useRuntimeConfig()

  // If the env var is not set, default to true (POC / demo mode)
  const useMockBackend = computed(() => {
    const env = config.public.useMockBackend as string | undefined
    if (env === undefined || env === null) return true
    return env !== 'false' && env !== '0'
  })

  return {
    useMockBackend,
    apiGatewayUrl: computed(() => config.public.apiGatewayUrl as string || ''),
    supabaseUrl: computed(() => config.public.supabaseUrl as string || ''),
    supabaseAnonKey: computed(() => config.public.supabaseAnonKey as string || ''),
  }
}
