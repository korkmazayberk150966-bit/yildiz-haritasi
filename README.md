# Gökkubbe

Mobil öncelikli, statik ve offline çalışan bir astronomi PWA'sı. Kullanıcı doğum tarihi, saati ve konumunu girer; uygulama o anki yerel gökyüzünü WebGL ile render eder.

## Kurulum

```bash
npm install
npm run data:hyg
npm run data:planets
npm run data:deep-space
npm run build
```

HYG indirmesi için ağ erişimi yoksa geliştirme amaçlı küçük örnek asset:

```bash
npx tsx data/build-hyg.ts --sample
```

## Mimari

- Vite + TypeScript + Three.js.
- PWA cache ve manifest `vite-plugin-pwa` ile üretilir.
- Gezegen, Güneş ve Ay konumları runtime API kullanmadan `astronomy-engine` ile istemci tarafında hesaplanır.
- HYG v4.x CSV build aşamasında `Float32Array` binary asset'e dönüştürülür: `[RA, Dec, magnitude, B-V]`.
- Yıldızlar tekil mesh değil, `BufferGeometry + Points + ShaderMaterial` ile çizilir.
- B-V renk indeksi shader içinde B-V -> Kelvin -> RGB blackbody yaklaşımıyla renge dönüşür.
- HYG koordinatları J2000 epoğundadır. Çıplak göz deneyimi için doğum tarihiyle J2000 arasındaki presesyon farkı ihmal edilebilir kabul edilir; gezegen konumları tarihe göre `astronomy-engine` ile hesaplanır.

## Adaptif Kalite

Uygulama cihaz belleği, çekirdek sayısı, pixel ratio ve kısa FPS ölçümüne göre kalite profili seçer. Zayıf cihazlarda pixel ratio ve point cloud limitleri otomatik düşer. Katman 3 Gaia temsili ve Katman 4 kozmik ağ için sert üst sınırlar vardır; amaç RAM/GPU taşmasını ve çöküşü önlemektir.

Katman 2 gezegen render'ı da aynı kalite profiline bağlıdır. Düşük profilde küre segmentleri azalır; Dünya gece ışıkları, bulut katmanı ve atmosfer gibi ekstra draw-call/texture kullanan katmanlar kapatılır. Yüklenen dokular GPU'ya verilmeden önce kalite profiline göre 512/1024/2048 px üst sınırına indirgenir. Gezegen doku asset'leri Katman 2 ilk açıldığında lazy yüklenir ve PWA cache'e dahil edilir.

## Katman 2 Doku Hatti

Gerçekçi gezegen dokuları için:

```bash
npm run data:planets
```

Bu script JPL Solar System Simulator texture maps, NASA SVS Earth At Night ve NASA Visible Earth cloud map kaynaklarını `public/textures/planets/` altına indirir. Runtime'da NASA/JPL API veya uzak texture çağrısı yapılmaz.

## Fotogerçekçi Deep-Space Asset Hattı

Katman 1/3/4 için NASA SVS Deep Star Maps 2020 ve NASA/Hubble atlaslarını üretmek:

```bash
npm run data:deep-space
```

Script ana kaynak olarak celestial/J2000 koordinatlı, parlak Hipparcos/Tycho yıldızları ayrılmış `milkyway_2020_4k/8k.exr` dosyalarını hedefler. Bu yerel ortamda EXR decoder desteği yoksa otomatik olarak aynı SVS ürününün `milkyway_2020_4k_print.jpg` fallback'inden optimize WebP üretir. Büyük deep-space asset'leri PWA precache'e alınmaz; service worker bunları runtime cache ile sınırlı süre/sayıda saklar.

## Astroloji Sözlüğü

Analiz katmanı `src/data/astro-glossary.ts` içindeki gömülü sözlüğü kullanır. Bu veri 6 Haziran 2026'da Notion'daki “Gökkubbe — Astroloji Sözlüğü” sayfasından build-time olarak okunup yapılandırılmıştır; uygulama runtime'da Notion'a veya internete bağlanmaz.

Notion'daki sözlük güncellenirse akış:

```bash
# Notion plugin ile sayfayı tekrar oku, ASTRO_GLOSSARY içeriğini güncelle.
npm run data:astro-glossary
npm test
npm run build
```

`npm run data:astro-glossary` gömülü sözlüğün beklenen ana bölümlerini doğrular; Notion fetch işlemi bilinçli olarak runtime'a eklenmez.

## GitHub Pages

Bu repo bir proje sayfası olarak `https://kullanici.github.io/yildiz-haritasi/` altında yayınlanacaksa varsayılan ayar hazırdır:

```ts
// vite.config.ts
base: "/yildiz-haritasi/"
```

Kök domain veya `https://kullanici.github.io/` için yayınlayacaksan:

```ts
base: "/"
```

Build çıktısı:

```bash
npm run build
```

`dist/` klasörü GitHub Pages'e verilir. Yanlış `base` ayarı asset 404 hatalarına ve boş sayfaya neden olur.

## Test

```bash
npm test
npm run build
```

## Durum

İlk sürüm Katman 1'i üretim kalitesinde hedefler. Katman 2-4 için modüler render iskeleti ve adaptif nokta limitleri hazırdır; sonraki adım bu katmanları daha zengin açık veri setleriyle doldurmaktır.
