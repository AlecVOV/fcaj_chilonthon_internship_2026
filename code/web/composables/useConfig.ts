// composables/useConfig.ts
// Cloud-only configuration — Supabase + AWS API Gateway endpoints.

export function useConfig() {
  const config = useRuntimeConfig()

  return {
    apiGatewayUrl: computed(() => config.public.apiGatewayUrl as string || ''),
    supabaseUrl: computed(() => config.public.supabaseUrl as string || ''),
    supabaseAnonKey: computed(() => config.public.supabaseAnonKey as string || ''),
  }
}
