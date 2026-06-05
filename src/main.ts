import "./styles.css";

import { localBirthTimeToUtc, resolveLocation } from "./astro/time";
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
      <p class="eyebrow">Offline astronomi PWA</p>
      <h1>Yildiz Haritasi</h1>
      <p class="lead">Dogdugun an ve konum icin yerel gokyuzunu bilimsel, akici ve mobil oncelikli bir WebGL deneyimine cevir.</p>
      <form class="birth-form" id="birth-form">
        <label>
          <span>Dogum tarihi</span>
          <input name="date" type="date" required />
        </label>
        <label>
          <span>Dogum saati</span>
          <input name="time" type="time" value="21:00" />
        </label>
        <label>
          <span>Sehir ara</span>
          <input name="city" list="city-list" autocomplete="off" placeholder="Istanbul, Ankara, Izmir..." />
          <datalist id="city-list"></datalist>
        </label>
        <div class="grid">
          <label>
            <span>Enlem</span>
            <input name="latitude" type="number" step="0.0001" required />
          </label>
          <label>
            <span>Boylam</span>
            <input name="longitude" type="number" step="0.0001" required />
          </label>
        </div>
        <div class="actions">
          <button type="button" class="secondary" id="geo">Konumumu kullan</button>
          <button type="submit">Gokyuzunu Olustur</button>
        </div>
        <p class="status" id="form-status">Ilk yuklemeden sonra veri ve uygulama offline acilir.</p>
      </form>
    </section>
    <section class="viewer" id="viewer" hidden>
      <div class="canvas-wrap" id="canvas-wrap"></div>
      <div class="loading-overlay" id="loading-overlay" hidden>
        <div class="loader-ring"></div>
        <p>Gokyuzu hazirlaniyor</p>
      </div>
      <div class="topbar">
        <button class="secondary" id="back">Yeni tarih</button>
        <p id="scene-status">Hazirlaniyor...</p>
        <button class="secondary compact" id="reset-view" hidden>Tumunu sigdir</button>
      </div>
      <aside class="planet-card" id="planet-card" hidden></aside>
      <nav class="layers" aria-label="Katmanlar">
        <button data-layer="sky" class="active">1 Gokyuzu</button>
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
const planetCard = document.querySelector<HTMLElement>("#planet-card")!;
const loadingOverlay = document.querySelector<HTMLElement>("#loading-overlay")!;

loadCities().catch((error) => {
  statusEl.textContent = error instanceof Error ? error.message : "Sehir verisi yuklenemedi.";
});

document.querySelector<HTMLButtonElement>("#geo")!.addEventListener("click", () => {
  if (!navigator.geolocation) {
    statusEl.textContent = "Bu tarayici Geolocation API desteklemiyor.";
    return;
  }
  statusEl.textContent = "Konum izni bekleniyor...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setInput("latitude", position.coords.latitude.toFixed(4));
      setInput("longitude", position.coords.longitude.toFixed(4));
      setInput("city", "Mevcut konum");
      statusEl.textContent = "Konum alindi. Tarih ve saati kontrol edip devam edebilirsin.";
    },
    () => {
      statusEl.textContent = "Konum izni reddedildi veya konum alinamadi.";
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
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
    cityName: String(data.get("city") || "Secili konum")
  };

  try {
    validateInput(input);
    const location = resolveLocation(input.cityName || "Secili konum", input.latitude, input.longitude);
    await startSky(input, location);
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : "Bilinmeyen hata.";
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
  button.addEventListener("click", () => skyApp?.setLayer(button.dataset.layer as LayerId));
});

async function startSky(input: BirthInput, location: ResolvedLocation): Promise<void> {
  if (!isWebGlAvailable()) throw new Error("WebGL desteklenmiyor; bu uygulama WebGL gerektirir.");
  statusEl.textContent = "Gokyuzu hesaplaniyor...";
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
      sceneStatus.textContent = `${status} · ${location.name} · ${location.timezone}`;
      loadingOverlay.hidden = status === "Hazir" || status.endsWith("hazir");
    },
    onSolarSystemReady: (ready) => {
      resetView.hidden = !ready;
      if (!ready) planetCard.hidden = true;
    },
    onPlanetInfo: (info) => {
      if (!info) {
        planetCard.hidden = true;
        return;
      }
      planetCard.innerHTML = `
        <p class="card-kicker">Gezegen odagi</p>
        <h2>${info.name}</h2>
        <p>Gunes'e uzaklik: ${info.distanceAu.toFixed(2)} AU</p>
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
  if (!input.date) throw new Error("Dogum tarihi zorunlu.");
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) throw new Error("Gecerli enlem/boylam gir.");
  if (Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) throw new Error("Enlem veya boylam aralik disinda.");
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
