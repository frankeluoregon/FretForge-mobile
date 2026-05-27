import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/chopro': 'http://localhost:3001',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'samples/**/*.mp3'],
      manifest: {
        name: 'FretForge',
        short_name: 'FretForge',
        description: 'Interactive Fretboard & Chord Progression Tool',
        theme_color: '#140f0c',
        icons: [
          {
            src: 'logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})