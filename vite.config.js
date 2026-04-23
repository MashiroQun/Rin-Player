import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      // Service Worker を自動的に登録する設定
      registerType: 'autoUpdate',
      // マニフェストに含める静的アセット（アイコンなど）
      includeAssets: ['character.png'],
      manifest: {
        name: 'Rin☪︎ Music Player',
        short_name: 'Rin Music',
        description: 'Rin☪︎ Official Music Player PWA',
        start_url: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#0b1024',
        theme_color: '#1f2b5e',
        lang: 'ja',
        icons: [
          {
            src: 'character.png', // publicからの相対パス
            sizes: '500x500',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'character.png',
            sizes: '500x500',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      // 開発環境（npm run dev）でもPWAをシミュレートしたい場合
      devOptions: {
        enabled: true
      }
    })
  ]
})
