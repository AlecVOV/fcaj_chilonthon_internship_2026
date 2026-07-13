// composables/useConfig.ts
// Cloud-only configuration — Supabase + AWS API Gateway endpoints.

export function useConfig() {
  const config = useRuntimeConfig()

  return {
    apiGatewayUrl: computed(() => config.public.apiGatewayUrl as string || ''),
    // URL riêng cho tính năng Ambient Sound (Lambda Function URL hoặc API Gateway).
    // Fallback về apiGatewayUrl nếu chưa set để tương thích ngược.
    ambientApiUrl: computed(() => (config.public.ambientApiUrl as string) || (config.public.apiGatewayUrl as string) || ''),
    // emotion-detector dùng chung route /emotion trên cùng API Gateway (agent-bff) —
    // fallback về apiGatewayUrl, không cần biến riêng nữa.
    emotionApiUrl: computed(() => (config.public.emotionApiUrl as string) || (config.public.apiGatewayUrl as string) || ''),
    // rag-recommender dùng chung route /rag trên cùng API Gateway — fallback về apiGatewayUrl.
    ragApiUrl: computed(() => (config.public.ragApiUrl as string) || (config.public.apiGatewayUrl as string) || ''),
    supabaseUrl: computed(() => config.public.supabaseUrl as string || ''),
    supabaseAnonKey: computed(() => config.public.supabaseAnonKey as string || ''),
  }
}
