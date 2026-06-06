import { ASTRO_GLOSSARY } from "../src/data/astro-glossary";

const expected = {
  elements: 4,
  modalities: 3,
  signs: 12,
  planets: 10,
  houses: 12,
  aspects: 7
};

for (const [key, count] of Object.entries(expected)) {
  const actual = ASTRO_GLOSSARY[key as keyof typeof expected].length;
  if (actual !== count) {
    throw new Error(`astro-glossary.${key} beklenen ${count}, bulunan ${actual}`);
  }
}

console.log("Astroloji sözlüğü doğrulandı.");
console.log("Notion güncelleme akışı:");
console.log("1. Notion:search ile 'Gökkubbe — Astroloji Sözlüğü' sayfasını bul.");
console.log("2. Notion:fetch ile tüm içeriği oku.");
console.log("3. İçeriği src/data/astro-glossary.ts içindeki ASTRO_GLOSSARY yapısına dönüştür.");
console.log("4. npm run data:astro-glossary, npm test ve npm run build ile doğrula.");
