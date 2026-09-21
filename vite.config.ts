/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/functions/**', '**/pix-asaas/**'],
  },
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'fonts/*.woff2'],
      workbox: {
        // O fallback de navegação (index.html) NÃO pode capturar rotas servidas pelo
        // servidor: /__/auth/* (handler de login do Firebase — senão o popup do Google
        // abre o app em branco) e /e/* (rewrite para a function de Open Graph).
        navigateFallbackDenylist: [/^\/__\//, /^\/e\//],
      },
      manifest: {
        name: 'Atchei - Eventos e ingressos',
        short_name: 'Atchei',
        description: 'Descubra e crie os melhores eventos, festas e encontros na sua região.',
        theme_color: '#FFB34D',
        background_color: '#FFFCF8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'apple-touch-icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
