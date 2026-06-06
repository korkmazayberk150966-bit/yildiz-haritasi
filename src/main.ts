import "./styles.css";

import { localBirthTimeToUtc, resolveLocation } from "./astro/time";
import {
  ASTRO_DISCLAIMER,
  findGlossaryConstellation,
  findGlossaryFixedStar,
  findGlossarySignByName
} from "./data/astro-glossary";
import type { PlanetInfo } from "./render/SolarSystemLayer";
import { SkyApp } from "./render/SkyApp";
import type { BirthInput, LayerId, ResolvedLocation } from "./types";

interface CityRecord {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
let skyApp: SkyApp | undefined;
let cities: CityRecord[] = [];

app.innerHTML = `
  <main class="shell">
    <section class="intro" id="intro">
      <div class="intro-stars" aria-hidden="true"></div>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <p class="eyebrow">Gökkubbe</p>
          <h1>Gökkubbe</h1>
        </div>
      </div>
      <p class="lead">Doğduğun anın gökyüzünü bilimsel konum hesaplarıyla yeniden gör. Yıldızlar, gezegenler ve Samanyolu aynı gökkubbenin içinde.</p>
      <form class="birth-form" id="birth-form">
        <label class="field">
          <span>Doğum tarihi</span>
          <input name="date" type="date" required />
        </label>
        <label class="field">
          <span>Doğum saati</span>
          <input name="time" type="time" value="21:00" />
        </label>
        <label class="field">
          <span>Şehir ara</span>
          <input name="city" list="city-list" autocomplete="off" placeholder="İstanbul, Ankara, İzmir..." />
          <datalist id="city-list"></datalist>
        </label>
        <details class="advanced-coordinates">
          <summary>Gelişmiş / koordinatları gir</summary>
          <div class="grid">
            <label class="field">
              <span>Enlem</span>
              <input name="latitude" type="number" step="0.0001" required />
            </label>
            <label class="field">
              <span>Boylam</span>
              <input name="longitude" type="number" step="0.0001" required />
            </label>
          </div>
        </details>
        <div class="actions">
          <button type="button" class="secondary" id="geo">Konumumu kullan</button>
          <button type="submit">Gökyüzünü oluştur</button>
        </div>
        <p class="status" id="form-status">İlk yüklemeden sonra uygulama ve temel gökyüzü verileri offline açılır.</p>
      </form>
    </section>
    <section class="viewer" id="viewer" hidden>
      <div class="canvas-wrap" id="canvas-wrap"></div>
      <div class="loading-overlay" id="loading-overlay" hidden>
        <div class="loader-ring"></div>
        <p>Gökyüzü hazırlanıyor</p>
      </div>
      <div class="topbar">
        <button class="secondary" id="back">Yeni tarih</button>
        <p id="scene-status">Hazırlanıyor...</p>
        <button class="secondary compact" id="anim-toggle" hidden>Zaman</button>
        <button class="secondary compact" id="reset-view" hidden>Tümünü sığdır</button>
      </div>
      <aside class="planet-card" id="planet-card" hidden></aside>
      <nav class="layers" aria-label="Katmanlar">
        <button data-layer="sky" class="active">1 Gökyüzü</button>
        <button data-layer="solar-system">2 Sistem</button>
        <button data-layer="milky-way">3 Samanyolu</button>
        <button data-layer="cosmic-web">4 Evren</button>
      </nav>
    </section>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#birth-form")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#form-status")!;
const sceneStatus = document.querySelector<HTMLParagraphElement>("#scene-status")!;
const intro = document.querySelector<HTMLElement>("#intro")!;
const viewer = document.querySelector<HTMLElement>("#viewer")!;
const canvasWrap = document.querySelector<HTMLElement>("#canvas-wrap")!;
const cityList = document.querySelector<HTMLDataListElement>("#city-list")!;
const resetView = document.querySelector<HTMLButtonElement>("#reset-view")!;
const animToggle = document.querySelector<HTMLButtonElement>("#anim-toggle")!;
const planetCard = document.querySelector<HTMLElement>("#planet-card")!;
const loadingOverlay = document.querySelector<HTMLElement>("#loading-overlay")!;

loadCities().catch((error) => {
  statusEl.textContent = error instanceof Error ? error.message : "Şehir verisi yüklenemedi.";
});

document.querySelector<HTMLButtonElement>("#geo")!.addEventListener("click", () => {
  if (!navigator.geolocation) {
    statusEl.textContent = "Bu tarayıcı konum özelliğini desteklemiyor.";
    return;
  }
  statusEl.textContent = "Konum izni bekleniyor...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setInput("latitude", position.coords.latitude.toFixed(4));
      setInput("longitude", position.coords.longitude.toFixed(4));
      setInput("city", "Mevcut konum");
      statusEl.textContent = "Konum alındı. Tarih ve saati kontrol edip devam edebilirsin.";
    },
    () => {
      statusEl.textContent = "Konum izni reddedildi veya konum alınamadı.";
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
});

// Animasyon toggle (D maddesi)
let animEnabled = false;
animToggle.addEventListener("click", () => {
  animEnabled = !animEnabled;
  skyApp?.setSolarAnimation(animEnabled);
  animToggle.textContent = animEnabled ? "Dondur" : "Zaman";
  animToggle.classList.toggle("active", animEnabled);
});

document.querySelector<HTMLButtonElement>("#back")!.addEventListener("click", () => {
  skyApp?.dispose();
  skyApp = undefined;
  viewer.hidden = true;
  intro.hidden = false;
});

resetView.addEventListener("click", () => {
  skyApp?.resetSolarSystemView();
  planetCard.hidden = true;
});

planetCard.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest("[data-close-panel]")) return;
  planetCard.hidden = true;
  skyApp?.resetSolarSystemView();
});

form.city.addEventListener("change", () => {
  const selected = cities.find((city) => cityLabel(city) === form.city.value);
  if (!selected) return;
  setInput("latitude", selected.lat.toString());
  setInput("longitude", selected.lon.toString());
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const input: BirthInput = {
    date: String(data.get("date")),
    time: String(data.get("time") || "21:00"),
    latitude: Number(data.get("latitude")),
    longitude: Number(data.get("longitude")),
    cityName: String(data.get("city") || "Seçili konum")
  };

  try {
    validateInput(input);
    const location = resolveLocation(input.cityName || "Seçili konum", input.latitude, input.longitude);
    await startSky(input, location);
  } catch (error) {
    console.error("Submit error:", error);
    statusEl.textContent = error instanceof Error ? error.message : "Bilinmeyen hata.";
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
  button.addEventListener("click", () => skyApp?.setLayer(button.dataset.layer as LayerId));
});

async function startSky(input: BirthInput, location: ResolvedLocation): Promise<void> {
  if (!isWebGlAvailable()) throw new Error("WebGL desteklenmiyor; bu uygulama WebGL gerektirir.");
  statusEl.textContent = "Gökyüzü hesaplanıyor...";

  loadingOverlay.hidden = false;
  intro.hidden = true;
  viewer.hidden = false;
  skyApp?.dispose();
  const observation = localBirthTimeToUtc(input.date, input.time || "21:00", location.timezone);
  skyApp = new SkyApp({
    container: canvasWrap,
    location,
    observation,
    onLayerChange: (layer) => {
      document.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
        button.classList.toggle("active", button.dataset.layer === layer);
      });
    },
    onStatus: (status) => {
      sceneStatus.textContent = status;
    },
    onSolarSystemReady: (ready) => {
      resetView.hidden = !ready;
      animToggle.hidden = !ready;
      if (!ready) {
        planetCard.hidden = true;
        // Katman değişince animasyonu sıfırla.
        animEnabled = false;
        skyApp?.setSolarAnimation(false);
        animToggle.textContent = "Zaman";
        animToggle.classList.remove("active");
      }
    },
    onPlanetInfo: (info: any | null) => {
      if (!info) {
        planetCard.hidden = true;
        return;
      }
      
      if (info.type === "star") {
        const fixedStar = findGlossaryFixedStar(String(info.name));
        const fixedStarSection = fixedStar
          ? `<div class="card-section card-meaning">
              <p class="card-label">Sabit Yıldız Doğası</p>
              <p class="card-value">${fixedStar.nature}</p>
              <p class="card-text">${fixedStar.meaning}</p>
            </div>`
          : "";
        planetCard.innerHTML = `
          <div class="card-header">
            <span class="card-symbol" style="color:${info.colorDesc.includes('Mavi') ? '#9fb9e8' : info.colorDesc.includes('Sarı') ? '#ffe28a' : info.colorDesc.includes('Kırmızı') ? '#ff8a8a' : '#fff'}">★</span>
            <div>
              <p class="card-kicker">Parlak Yıldız</p>
              <h2>${info.name}</h2>
            </div>
            <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
          </div>
          <div class="card-grid">
            <div class="card-section"><p class="card-label">Takımyıldız</p><p class="card-value">${info.con}</p></div>
            <div class="card-section"><p class="card-label">Uzaklık</p><p class="card-value">${info.distLy} Işık Yılı</p></div>
            <div class="card-section"><p class="card-label">Kadir (Parlaklık)</p><p class="card-value">${info.mag}</p></div>
            <div class="card-section"><p class="card-label">Tür/Renk</p><p class="card-value">${info.colorDesc}</p></div>
          </div>
          <div class="card-section card-meaning">
            <p class="card-label">Hakkında</p>
            <p class="card-text">${info.desc}</p>
          </div>
          ${fixedStarSection}
          <p class="card-disclaimer">${ASTRO_DISCLAIMER}</p>
        `;
        planetCard.hidden = false;
        return;
      }

      if (info.type === "constellation") {
        const constellation = findGlossaryConstellation(String(info.name)) ?? findGlossaryConstellation(String(info.nameTR));
        const sign = constellation?.signKey ? findGlossarySignByName(constellation.signKey) : undefined;
        const constellationMeaning = constellation?.meaning ?? info.desc;
        const brightestStar = constellation?.brightestStar ?? info.brightest;
        const signSection = sign
          ? `<div class="card-section card-meaning">
              <p class="card-label">${sign.name} Burcu Bağlantısı</p>
              <p class="card-keywords">${sign.symbol} ${sign.keyword} · ${sign.element} · ${sign.modality}</p>
              <p class="card-text">${sign.meaning}</p>
            </div>`
          : "";
        planetCard.innerHTML = `
          <div class="card-header">
            <span class="card-symbol" style="color: #94b2e4;">✦</span>
            <div>
              <p class="card-kicker">Takımyıldız</p>
              <h2>${info.nameTR}</h2>
            </div>
            <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
          </div>
          <div class="card-grid">
            <div class="card-section"><p class="card-label">Latince Adı</p><p class="card-value">${constellation?.latin ?? info.name} (${info.id})</p></div>
            <div class="card-section"><p class="card-label">En Parlak Yıldızı</p><p class="card-value">${brightestStar}</p></div>
          </div>
          <div class="card-section card-meaning">
            <p class="card-label">Mitolojik Anlamı</p>
            <p class="card-text">${constellationMeaning}</p>
          </div>
          ${signSection}
          <p class="card-disclaimer">${ASTRO_DISCLAIMER}</p>
        `;
        planetCard.hidden = false;
        return;
      }

      const kmStr = info.distanceKm.toLocaleString("tr-TR");
      const zodiacStr = `${info.zodiacSign} ${info.zodiacDegree}°`;
      const generationalNote = info.isGenerational
        ? `<p class="card-note">Kuşak gezegeni: etkisi bireysel değil, toplumsal/kuşaksal okunur.</p>`
        : "";
      const aspectSection = info.name !== "Güneş" && info.aspectText
        ? `<div class="card-section"><p class="card-label">Güneş ile Açı</p><p class="card-text">${info.aspectText}</p></div>`
        : "";
      planetCard.innerHTML = `
        <div class="card-header">
          <span class="card-symbol">${info.symbol}</span>
          <div>
            <p class="card-kicker">Gezegen odağı</p>
            <h2>${info.name}</h2>
          </div>
          <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
        </div>
        <div class="card-grid">
          <div class="card-section"><p class="card-label">Zodyak Konumu</p><p class="card-value">${zodiacStr}</p></div>
          <div class="card-section"><p class="card-label">Dünya'dan Uzaklık</p><p class="card-value">${kmStr} km</p></div>
        </div>
        <div class="card-section card-meaning">
          <p class="card-label">Astrolojik Anlam</p>
          <p class="card-keywords">${info.keywords}</p>
          <p class="card-text">${info.meaning}</p>
        </div>
        ${aspectSection}
        ${generationalNote}
        <p class="card-disclaimer">${ASTRO_DISCLAIMER}</p>
      `;
      planetCard.hidden = false;
    }
  });
  await skyApp.mount();
  loadingOverlay.hidden = true;
}

async function loadCities(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/cities.json`);
  cities = await response.json() as CityRecord[];
  cityList.replaceChildren(...cities.map((city) => {
    const option = document.createElement("option");
    option.value = cityLabel(city);
    return option;
  }));
}

function validateInput(input: BirthInput): void {
  if (!input.date) throw new Error("Doğum tarihi zorunlu.");
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) throw new Error("Geçerli enlem/boylam gir.");
  if (Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) throw new Error("Enlem veya boylam aralık dışında.");
}

function isWebGlAvailable(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}

function setInput(name: string, value: string): void {
  const input = form.elements.namedItem(name) as HTMLInputElement;
  input.value = value;
}

function cityLabel(city: CityRecord): string {
  return `${city.name}, ${city.country}`;
}
