# Gökkubbe

Mobil öncelikli, statik yayınlanabilen bir astronomi PWA'sı. Varsayılan giriş “Serbest Gezi”dir: kullanıcı tarih/konum vermeden Samanyolu içi sinematik sahneye girer. “Astroloji Modu” ayrı panelden doğum tarihi, saati ve konum alır; uygulama o anki yerel gökyüzünü WebGL ile render eder.

App shell, temel HYG yıldız verisi, şehir listesi ve gezegen dokuları cache'lenir. Büyük deep-space panoramalar ve `public/tiles` altındaki streaming veriler precache'e girmez; gerektiğinde indirilir ve service worker tarafından sınırlı runtime cache ile saklanır.

## Kurulum

```bash
npm install
npm run data:hyg
npm run data:planets
npm run data:deep-space
npm run data:sample-tiles
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
- `startFreeRoam()` konumsuz galaksi-içi serbest geziyi, `startAstrologyMode()` doğum/konum tabanlı yerel gökyüzünü başlatır.
- HYG v4.x CSV build aşamasında `Float32Array` binary asset'e dönüştürülür: `[RA, Dec, magnitude, B-V]`.
- Yıldızlar tekil mesh değil, `BufferGeometry + Points + ShaderMaterial` ile çizilir.
- B-V renk indeksi shader içinde B-V -> Kelvin -> RGB blackbody yaklaşımıyla renge dönüşür.
- HYG koordinatları J2000 epoğundadır. Çıplak göz deneyimi için doğum tarihiyle J2000 arasındaki presesyon farkı ihmal edilebilir kabul edilir; gezegen konumları tarihe göre `astronomy-engine` ile hesaplanır.

## Adaptif Kalite

Uygulama cihaz belleği, çekirdek sayısı, pixel ratio ve kısa FPS ölçümüne göre kalite profili seçer. Zayıf cihazlarda pixel ratio ve point cloud limitleri otomatik düşer. Katman 3 Gaia temsili ve Katman 4 kozmik ağ için sert üst sınırlar vardır; amaç RAM/GPU taşmasını ve çöküşü önlemektir.

Kalite profili ayrıca sinematik efektleri ve streaming bütçesini yönetir: `cinematicEffects`, `streamingBudgetMb`, `maxActiveTiles`, `raymarchEnabled` ve `blackHoleEffectEnabled`. Düşük profilde bloom/parallax sadeleşir, aktif tile sayısı azalır ve ağır görsel efektler kapanır.

Katman 2 gezegen render'ı da aynı kalite profiline bağlıdır. Düşük profilde küre segmentleri azalır; Dünya gece ışıkları, bulut katmanı ve atmosfer gibi ekstra draw-call/texture kullanan katmanlar kapatılır. Yüklenen dokular GPU'ya verilmeden önce kalite profiline göre 512/1024/2048 px üst sınırına indirgenir. Gezegen doku asset'leri Katman 2 ilk açıldığında lazy yüklenir ve PWA cache'e dahil edilir.

## Serbest Gezi ve Tile Sözleşmesi

Serbest Gezi modu `milky-way` katmanını varsayılan açar. Bu katmanda dışarıdan spiral disk gösterilmez; kamera Güneş çevresinde, galaktik diskin içinde başlar. Görsel temsil içeriden görülen yıldız alanı, Samanyolu bandı, toz şeritleri ve galaktik merkez parıltısıdır. Masaüstünde W/A/S/D veya oklar, Q/E ve Shift boost; mobilde joystick, bakış alanı, yukarı/aşağı ve boost kontrolleri kullanılır. Yüksek kalite profilinde Sagittarius A* için billboard/shader tabanlı bir görsel hedef eklenir; tam raymarch/lensing sonraki veri fazına bırakılmıştır.

Streaming veri sözleşmesi `public/tiles/manifest.json` ile başlar. Her tile:

- `id`, `kind`, `lod`, `url`, `byteLength`
- `bounds.min/max`
- `pointCount`

alanlarını taşır. Binary tile formatı MVP için `Float32Array` stride 8 şeklindedir: `[x, y, z, r, g, b, pointSize, intensity]`.

Örnek küçük LOD setini üretmek:

```bash
npm run data:sample-tiles
```

Varsayılan host GitHub Pages `public/tiles` dizinidir. MVP sample tile'ları kamera çevresi, galaktik düzlem bandı ve toz lane dağılımı üretir; kuş bakışı spiral dağılımı üretmez. İleride Edenhofer/Gaia ETL çıktıları aynı manifest sözleşmesine göre CDN veya bucket'a taşınabilir.

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

Script ana kaynak olarak celestial/J2000 koordinatlı, parlak Hipparcos/Tycho yıldızları ayrılmış `milkyway_2020_4k/8k.exr` dosyalarını hedefler. Bu yerel ortamda EXR decoder desteği yoksa otomatik olarak aynı SVS ürününün `milkyway_2020_4k_print.jpg` fallback'inden optimize WebP üretir. Büyük deep-space asset'leri ve `public/tiles` verileri PWA precache'e alınmaz; service worker bunları runtime cache ile sınırlı süre/sayıda saklar.

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

`dist/` klasörü GitHub Pages'e verilir. Yanlış `base` ayarı asset/tile 404 hatalarına ve boş sayfaya neden olur.

## Test

```bash
npm test
npm run build
```

## Durum

Mevcut sürüm sinematik Serbest Gezi MVP'sini, Astroloji Modu panelini, Katman 1 yerel gökyüzünü, gerçekçi Katman 2 gezegenlerini ve Katman 3/4 görsel iskeletini içerir. Büyük bilimsel tiled streaming/ETL veri üretimi sonraki faza bırakılmıştır.
