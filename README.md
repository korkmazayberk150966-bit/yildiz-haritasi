# Yildiz Haritasi

Mobil oncelikli, statik ve offline calisan bir astronomi PWA'si. Kullanici dogum tarihi, saati ve konumunu girer; uygulama o anki yerel gokyuzunu WebGL ile render eder.

## Kurulum

```bash
npm install
npm run data:hyg
npm run data:planets
npm run data:deep-space
npm run build
```

HYG indirmesi icin ag erisimi yoksa gelistirme amacli kucuk ornek asset:

```bash
npx tsx data/build-hyg.ts --sample
```

## Mimari

- Vite + TypeScript + Three.js.
- PWA cache ve manifest `vite-plugin-pwa` ile uretilir.
- Gezegen, Gunes ve Ay konumlari runtime API kullanmadan `astronomy-engine` ile istemci tarafinda hesaplanir.
- HYG v4.x CSV build asamasinda `Float32Array` binary asset'e donusturulur: `[RA, Dec, magnitude, B-V]`.
- Yildizlar tekil mesh degil, `BufferGeometry + Points + ShaderMaterial` ile cizilir.
- B-V renk indeksi shader icinde B-V -> Kelvin -> RGB blackbody yaklasimiyla renge donusur.
- HYG koordinatlari J2000 epogundadir. Ciplak goz deneyimi icin dogum tarihiyle J2000 arasindaki presesyon farki ihmal edilebilir kabul edilir; gezegen konumlari tarihe gore `astronomy-engine` ile hesaplanir.

## Adaptif Kalite

Uygulama cihaz bellegi, cekirdek sayisi, pixel ratio ve kisa FPS olcumune gore kalite profili secer. Zayif cihazlarda pixel ratio ve point cloud limitleri otomatik duser. Katman 3 Gaia temsili ve Katman 4 kozmik ag icin sert ust sinirlar vardir; amac RAM/GPU tasmasini ve cokusu onlemektir.

Katman 2 gezegen render'i de ayni kalite profiline baglidir. Dusuk profilde kure segmentleri azalir; Dunya gece isiklari, bulut katmani ve atmosfer gibi ekstra draw-call/texture kullanan katmanlar kapatilir. Yuklenen dokular GPU'ya verilmeden once kalite profiline gore 512/1024/2048 px ust sinirina indirgenir. Gezegen doku asset'leri Katman 2 ilk acildiginda lazy yuklenir ve PWA cache'e dahil edilir.

## Katman 2 Doku Hatti

Gercekci gezegen dokulari icin:

```bash
npm run data:planets
```

Bu script JPL Solar System Simulator texture maps, NASA SVS Earth At Night ve NASA Visible Earth cloud map kaynaklarini `public/textures/planets/` altina indirir. Runtime'da NASA/JPL API veya uzak texture cagrisi yapilmaz.

## Fotogercekci Deep-Space Asset Hatti

Katman 1/3/4 icin NASA SVS Deep Star Maps 2020 ve NASA/Hubble atlaslarini uretmek:

```bash
npm run data:deep-space
```

Script ana kaynak olarak celestial/J2000 koordinatli, parlak Hipparcos/Tycho yildizlari ayrilmis `milkyway_2020_4k/8k.exr` dosyalarini hedefler. Bu yerel ortamda EXR decoder destegi yoksa otomatik olarak ayni SVS urununun `milkyway_2020_4k_print.jpg` fallback'inden optimize WebP uretir. Buyuk deep-space asset'leri PWA precache'e alinmaz; service worker bunlari runtime cache ile sinirli sure/sayida saklar.

## GitHub Pages

Bu repo bir proje sayfasi olarak `https://kullanici.github.io/yildiz-haritasi/` altinda yayinlanacaksa varsayilan ayar hazirdir:

```ts
// vite.config.ts
base: "/yildiz-haritasi/"
```

Kok domain veya `https://kullanici.github.io/` icin yayinlayacaksan:

```ts
base: "/"
```

Build ciktisi:

```bash
npm run build
```

`dist/` klasoru GitHub Pages'e verilir. Yanlis `base` ayari asset 404 hatalarina ve bos sayfaya neden olur.

## Test

```bash
npm test
npm run build
```

## Durum

Ilk surum Katman 1'i uretim kalitesinde hedefler. Katman 2-4 icin moduler render iskeleti ve adaptif nokta limitleri hazirdir; sonraki adim bu katmanlari daha zengin acik veri setleriyle doldurmaktir.
