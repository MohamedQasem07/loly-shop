import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpg'],
      manifest: {
        name: 'Loly Store Manager',
        short_name: 'Loly Store',
        description: 'نظام إدارة محل Loly Store — مبيعات ومخزون وتقارير',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#E85B9E',
        background_color: '#FFF7F0',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'logo.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
          { src: 'logo.jpg', sizes: '192x192', type: 'image/jpeg', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true
  }
})
