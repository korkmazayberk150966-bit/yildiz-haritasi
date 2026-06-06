import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/yildiz-haritasi/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["stars/hyg-stars.bin", "data/cities.json", "textures/planets/*"],
      manifest: {
        name: "Gökkubbe",
        short_name: "Gökkubbe",
        description: "Doğum anına göre çalışan bilimsel ve etkileşimli gökyüzü deneyimi.",
        theme_color: "#050712",
        background_color: "#050712",
        display: "standalone",
        orientation: "any",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,bin,json,woff2}"],
        globIgnores: ["**/textures/deep-space/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/textures/deep-space/"),
            handler: "CacheFirst",
            options: {
              cacheName: "deep-space-runtime-v1",
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 14
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ]
});
