import "./styles.css";

import { localBirthTimeToUtc, resolveLocation } from "./astro/time";
import {
  ASTRO_DISCLAIMER,
  findGlossaryConstellation,
  findGlossaryFixedStar,
  findGlossarySignByName
} from "./data/astro-glossary";
import { LandingScene } from "./render/LandingScene";
import type { PlanetInfo } from "./render/SolarSystemLayer";
import { SkyApp } from "./render/SkyApp";
import { detectInitialQuality } from "./render/quality";
import type { BirthInput, LayerId, ResolvedLocation } from "./types";

interface CityRecord {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
let skyApp: SkyApp | undefined;
let landingScene: LandingScene | undefined;
let cities: CityRecord[] = [];
let astroEnabled = false;
let latestAstrologyInput: { input: BirthInput; location: ResolvedLocation } | undefined;

app.innerHTML = `
  <main class="shell">
    <section class="intro" id="intro">
      <div class="landing-canvas" id="landing-canvas" aria-hidden="true"></div>
      <div class="landing-overlay">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">Gökkubbe</p>
            <h1>Gökkubbe</h1>
          </div>
        </div>
        <p class="lead">Canlı bir galaksi içinde serbestçe dolaş ya da doğum anının yerel gökyüzünü bilimsel hesaplarla aç.</p>
        <div class="mode-grid" aria-label="Başlangıç modu">
          <button class="mode-card primary" id="free-roam" type="button">
            <span>Serbest Gezi</span>
            <small>Tarih ve konum istemeden Samanyolu içine gir.</small>
          </button>
          <button class="mode-card" id="open-astro" type="button">
            <span>Astroloji Modu</span>
            <small>Doğum tarihi, saat ve şehirle yerel gökyüzünü oluştur.</small>
          </button>
        </div>
        <p class="status" id="form-status">App shell ve temel veriler cache'lenir; büyük uzay verileri gerektiğinde yayın hostundan akar.</p>
      </div>
    </section>
    <section class="viewer" id="viewer" hidden>
      <div class="canvas-wrap" id="canvas-wrap"></div>
      <div class="loading-overlay" id="loading-overlay" hidden>
        <div class="loader-ring"></div>
        <p>Gökkubbe hazırlanıyor</p>
      </div>
      <div class="topbar">
        <button class="secondary" id="back">Giriş</button>
        <p id="scene-status">Hazırlanıyor...</p>
        <label class="astro-toggle" title="Astrolojik yorumları aç/kapat">
          <input id="astro-toggle" type="checkbox" />
          <span>Astroloji</span>
        </label>
        <button class="secondary compact" id="anim-toggle" hidden>Zaman</button>
        <button class="secondary compact" id="reset-view" hidden>Tümünü sığdır</button>
      </div>
      <div class="flight-hud" id="flight-hud" hidden>
        <div class="hud-cell">
          <span>Konum</span>
          <strong id="flight-region">Güneş Çevresi</strong>
        </div>
        <div class="hud-compass" aria-label="Galaktik merkez yönü">
          <span id="center-arrow">▲</span>
          <small>Sgr A*</small>
        </div>
        <div class="hud-cell">
          <span>Hız</span>
          <strong id="flight-speed">0 ly/sn</strong>
        </div>
        <p class="flight-hint" id="flight-hint">Gezmek için sürükle / W A S D veya yön tuşlarını kullan. Shift ile boost.</p>
      </div>
      <aside class="planet-card" id="planet-card" hidden></aside>
      <div class="mobile-flight-controls" id="mobile-flight-controls" hidden aria-label="Samanyolu uçuş kontrolleri">
        <div class="flight-joystick" id="flight-joystick" aria-label="İleri geri ve sağ sol hareket">
          <span></span>
        </div>
        <div class="look-pad" id="look-pad" aria-label="Bakışı döndürme alanı"></div>
        <div class="vertical-buttons">
          <button type="button" id="flight-up" aria-label="Yukarı çık">Yukarı</button>
          <button type="button" id="flight-down" aria-label="Aşağı in">Aşağı</button>
        </div>
        <button type="button" class="boost-button" id="flight-boost" aria-label="Hızlan">Boost</button>
      </div>
      <nav class="layers" aria-label="Katmanlar">
        <button data-layer="sky">Gökyüzü</button>
        <button data-layer="stars">Yıldızlar</button>
        <button data-layer="constellations">Takımyıldız</button>
        <button data-layer="solar-system">Sistem</button>
        <button data-layer="milky-way" class="active">Samanyolu</button>
        <button data-layer="cosmic-web">Evren</button>
      </nav>
    </section>
    <section class="astro-panel" id="astro-panel" hidden aria-label="Astroloji ve yerel gökyüzü formu">
      <div class="panel-grabber" aria-hidden="true"></div>
      <div class="astro-panel-head">
        <div>
          <p class="eyebrow">Astroloji Modu</p>
          <h2>Zaman ve konumu seç</h2>
        </div>
        <button class="secondary compact" id="close-astro" type="button" aria-label="Formu kapat">×</button>
      </div>
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
      </form>
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
const astroPanel = document.querySelector<HTMLElement>("#astro-panel")!;
const astroToggle = document.querySelector<HTMLInputElement>("#astro-toggle")!;
const flightHud = document.querySelector<HTMLElement>("#flight-hud")!;
const mobileFlightControls = document.querySelector<HTMLElement>("#mobile-flight-controls")!;

mountLandingScene();
loadCities().catch((error) => {
  statusEl.textContent = error instanceof Error ? error.message : "Şehir verisi yüklenemedi.";
});

document.querySelector<HTMLButtonElement>("#free-roam")!.addEventListener("click", () => {
  startFreeRoam().catch(handleStartError);
});

document.querySelector<HTMLButtonElement>("#open-astro")!.addEventListener("click", () => {
  openAstroPanel("Doğum bilgilerini girince yerel gökyüzü ve yorum paneli açılır.");
});

document.querySelector<HTMLButtonElement>("#close-astro")!.addEventListener("click", () => {
  astroPanel.hidden = true;
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
  astroPanel.hidden = true;
  planetCard.hidden = true;
  mountLandingScene();
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

astroToggle.addEventListener("change", () => {
  astroEnabled = astroToggle.checked;
  skyApp?.setAstrologyEnabled(astroEnabled);
  if (astroEnabled && !latestAstrologyInput) {
    openAstroPanel("Astrolojik yorumlar için doğum zamanı ve konum gerekir.");
  }
  if (!astroEnabled) planetCard.hidden = true;
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
    latestAstrologyInput = { input, location };
    await startAstrologyMode(input, location);
  } catch (error) {
    console.error("Submit error:", error);
    statusEl.textContent = error instanceof Error ? error.message : "Bilinmeyen hata.";
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
  button.addEventListener("click", () => skyApp?.setLayer(button.dataset.layer as LayerId));
});

async function startFreeRoam(): Promise<void> {
  if (!isWebGlAvailable()) throw new Error("WebGL desteklenmiyor; bu uygulama WebGL gerektirir.");
  astroEnabled = false;
  astroToggle.checked = false;
  await startSkyApp("free-roam");
}

async function startAstrologyMode(input: BirthInput, location: ResolvedLocation): Promise<void> {
  if (!isWebGlAvailable()) throw new Error("WebGL desteklenmiyor; bu uygulama WebGL gerektirir.");
  astroEnabled = true;
  astroToggle.checked = true;
  const observation = localBirthTimeToUtc(input.date, input.time || "21:00", location.timezone);
  await startSkyApp("astrology", location, observation);
}

async function startSkyApp(
  mode: "free-roam" | "astrology",
  location?: ResolvedLocation,
  observation?: ReturnType<typeof localBirthTimeToUtc>
): Promise<void> {
  statusEl.textContent = mode === "free-roam" ? "Serbest gezi açılıyor..." : "Gökyüzü hesaplanıyor...";
  loadingOverlay.hidden = false;
  astroPanel.hidden = true;
  intro.hidden = true;
  viewer.hidden = false;
  landingScene?.dispose();
  landingScene = undefined;
  skyApp?.dispose();

  skyApp = new SkyApp({
    container: canvasWrap,
    mode,
    astrologyEnabled: astroEnabled,
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
        animEnabled = false;
        skyApp?.setSolarAnimation(false);
        animToggle.textContent = "Zaman";
        animToggle.classList.remove("active");
      }
    },
    onMilkyWayFlightActive: (active) => {
      flightHud.hidden = !active;
      mobileFlightControls.hidden = !active;
    },
    onNeedsAstrologyInput: () => openAstroPanel("Yerel gökyüzü için tarih, saat ve konum gerekir."),
    onPlanetInfo: renderInfoPanel,
    flightControls: {
      hud: flightHud,
      region: document.querySelector<HTMLElement>("#flight-region")!,
      speed: document.querySelector<HTMLElement>("#flight-speed")!,
      centerArrow: document.querySelector<HTMLElement>("#center-arrow")!,
      hint: document.querySelector<HTMLElement>("#flight-hint")!,
      mobileControls: mobileFlightControls,
      joystick: document.querySelector<HTMLElement>("#flight-joystick")!,
      lookPad: document.querySelector<HTMLElement>("#look-pad")!,
      upButton: document.querySelector<HTMLElement>("#flight-up")!,
      downButton: document.querySelector<HTMLElement>("#flight-down")!,
      boostButton: document.querySelector<HTMLElement>("#flight-boost")!
    }
  });
  await skyApp.mount();
  loadingOverlay.hidden = true;
}

function renderInfoPanel(info: any | null): void {
  if (!info) {
    planetCard.hidden = true;
    return;
  }

  if (info.type === "star") {
    const fixedStar = astroEnabled ? findGlossaryFixedStar(String(info.name)) : undefined;
    const fixedStarSection = fixedStar
      ? `<div class="card-section card-meaning">
          <p class="card-label">Sabit Yıldız Doğası</p>
          <p class="card-value">${fixedStar.nature}</p>
          <p class="card-text">${fixedStar.meaning}</p>
        </div>`
      : "";
    planetCard.innerHTML = `
      <div class="card-header">
        <span class="card-symbol" style="color:${starColor(info.colorDesc)}">★</span>
        <div>
          <p class="card-kicker">Parlak Yıldız</p>
          <h2>${info.name}</h2>
        </div>
        <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
      </div>
      <div class="card-grid">
        <div class="card-section"><p class="card-label">Takımyıldız</p><p class="card-value">${info.con}</p></div>
        <div class="card-section"><p class="card-label">Uzaklık</p><p class="card-value">${info.distLy} Işık Yılı</p></div>
        <div class="card-section"><p class="card-label">Kadir</p><p class="card-value">${info.mag}</p></div>
        <div class="card-section"><p class="card-label">Tür/Renk</p><p class="card-value">${info.colorDesc}</p></div>
      </div>
      <div class="card-section card-meaning">
        <p class="card-label">Bilimsel Not</p>
        <p class="card-text">${info.desc}</p>
      </div>
      ${fixedStarSection}
      ${astroEnabled && fixedStar ? `<p class="card-disclaimer">${ASTRO_DISCLAIMER}</p>` : ""}
    `;
    planetCard.hidden = false;
    return;
  }

  if (info.type === "constellation") {
    const constellation = astroEnabled
      ? findGlossaryConstellation(String(info.name)) ?? findGlossaryConstellation(String(info.nameTR))
      : undefined;
    const sign = astroEnabled && constellation?.signKey ? findGlossarySignByName(constellation.signKey) : undefined;
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
        <div class="card-section"><p class="card-label">En Parlak Yıldız</p><p class="card-value">${brightestStar}</p></div>
      </div>
      <div class="card-section card-meaning">
        <p class="card-label">${astroEnabled ? "Mitolojik Anlamı" : "Hakkında"}</p>
        <p class="card-text">${constellationMeaning}</p>
      </div>
      ${signSection}
      ${astroEnabled ? `<p class="card-disclaimer">${ASTRO_DISCLAIMER}</p>` : ""}
    `;
    planetCard.hidden = false;
    return;
  }

  if (info.type === "black-hole") {
    const details = info.info ?? info;
    planetCard.innerHTML = `
      <div class="card-header">
        <span class="card-symbol" style="color:#ffb35a;">●</span>
        <div>
          <p class="card-kicker">Galaktik Merkez</p>
          <h2>${details.name}</h2>
        </div>
        <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
      </div>
      <div class="card-grid">
        <div class="card-section"><p class="card-label">Uzaklık</p><p class="card-value">${details.distance}</p></div>
        <div class="card-section"><p class="card-label">Kütle</p><p class="card-value">${details.mass}</p></div>
      </div>
      <div class="card-section card-meaning">
        <p class="card-label">Bilimsel Not</p>
        <p class="card-text">${details.desc}</p>
      </div>
    `;
    planetCard.hidden = false;
    return;
  }

  if (info.type === "stars" || info.type === "dust" || info.type === "nebula") {
    const details = info.info ?? info;
    const label = info.type === "dust" ? "Temsili Toz Katmanı" : info.type === "nebula" ? "Temsili Nebula Katmanı" : "Temsili Yıldız Katmanı";
    planetCard.innerHTML = `
      <div class="card-header">
        <span class="card-symbol" style="color:#9fb9ff;">✧</span>
        <div>
          <p class="card-kicker">${label}</p>
          <h2>${details.name}</h2>
        </div>
        <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
      </div>
      <div class="card-section card-meaning">
        <p class="card-label">Prosedürel Görsel</p>
        <p class="card-text">${details.desc}</p>
      </div>
      <p class="card-disclaimer">Bu görsel katman bilimsel katalog iddiası taşımaz. ${details.tileId ? `Tile: ${details.tileId}` : ""}</p>
    `;
    planetCard.hidden = false;
    return;
  }

  const planet = info as PlanetInfo;
  const kmStr = planet.distanceKm.toLocaleString("tr-TR");
  const zodiacStr = `${planet.zodiacSign} ${planet.zodiacDegree}°`;
  const generationalNote = astroEnabled && planet.isGenerational
    ? `<p class="card-note">Kuşak gezegeni: etkisi bireysel değil, toplumsal/kuşaksal okunur.</p>`
    : "";
  const aspectSection = astroEnabled && planet.name !== "Güneş" && planet.aspectText
    ? `<div class="card-section"><p class="card-label">Güneş ile Açı</p><p class="card-text">${planet.aspectText}</p></div>`
    : "";
  const astroSection = astroEnabled
    ? `<div class="card-section card-meaning">
        <p class="card-label">Astrolojik Anlam</p>
        <p class="card-keywords">${planet.keywords}</p>
        <p class="card-text">${planet.meaning}</p>
      </div>`
    : `<div class="card-section card-meaning">
        <p class="card-label">Bilimsel Not</p>
        <p class="card-text">Konum ve uzaklık astronomy-engine ile seçili tarihe göre hesaplanır. Astroloji kapalıyken sembolik yorum gösterilmez.</p>
      </div>`;

  planetCard.innerHTML = `
    <div class="card-header">
      <span class="card-symbol">${planet.symbol}</span>
      <div>
        <p class="card-kicker">Gezegen odağı</p>
        <h2>${planet.name}</h2>
      </div>
      <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
    </div>
    <div class="card-grid">
      ${astroEnabled ? `<div class="card-section"><p class="card-label">Zodyak Konumu</p><p class="card-value">${zodiacStr}</p></div>` : ""}
      <div class="card-section"><p class="card-label">Dünya'dan Uzaklık</p><p class="card-value">${kmStr} km</p></div>
    </div>
    ${astroSection}
    ${aspectSection}
    ${generationalNote}
    ${astroEnabled ? `<p class="card-disclaimer">${ASTRO_DISCLAIMER}</p>` : ""}
  `;
  planetCard.hidden = false;
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

function mountLandingScene(): void {
  const landingCanvas = document.querySelector<HTMLElement>("#landing-canvas");
  if (!landingCanvas) return;
  landingScene?.dispose();
  landingScene = new LandingScene(landingCanvas, detectInitialQuality());
}

function openAstroPanel(message?: string): void {
  astroPanel.hidden = false;
  if (message) statusEl.textContent = message;
}

function validateInput(input: BirthInput): void {
  if (!input.date) throw new Error("Doğum tarihi zorunlu.");
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) throw new Error("Geçerli enlem/boylam gir.");
  if (Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) throw new Error("Enlem veya boylam aralık dışında.");
}

function handleStartError(error: unknown): void {
  console.error("Start error:", error);
  statusEl.textContent = error instanceof Error ? error.message : "Bilinmeyen hata.";
  loadingOverlay.hidden = true;
  intro.hidden = false;
  viewer.hidden = true;
  mountLandingScene();
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

function starColor(colorDesc = ""): string {
  if (colorDesc.includes("Mavi")) return "#9fb9e8";
  if (colorDesc.includes("Sarı")) return "#ffe28a";
  if (colorDesc.includes("Kırmızı")) return "#ff8a8a";
  return "#fff";
}
