// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || '',
      apiGatewayUrl: process.env.NUXT_PUBLIC_API_GATEWAY_URL || '',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  },

  pinia: {
    storesDirs: ['./stores'],
  },

  routeRules: {
    '/': { ssr: false },
    '/dashboard': { ssr: false },
    '/focus': { ssr: false },
    '/tasks': { ssr: false },
    '/calendar': { ssr: false },
    '/agent': { ssr: false },
    '/profile': { ssr: false },
    '/author': { ssr: false },
    '/admin': { ssr: false },
    '/admin/**': { ssr: false },
  },

  imports: {
    dirs: ['composables'],
  },

  app: {
    head: {
      title: 'FCAJ Worklog Repository  — AI-Powered Focus & Productivity',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },

  compatibilityDate: '2025-05-22',
})
