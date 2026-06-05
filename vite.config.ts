import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/yildiz-haritasi/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["stars/hyg-stars.bin", "data/cities.json", "textures/planets/*"],
      manifest: {
        name: "Yildiz Haritasi",
        short_name: "Yildiz",
        description: "Dogum ani icin offline calisan bilimsel gokyuzu haritasi.",
        theme_color: "#050712",
        background_color: "#050712",
        display: "standalone",
        orientation: "portrait",
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
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ]
});
