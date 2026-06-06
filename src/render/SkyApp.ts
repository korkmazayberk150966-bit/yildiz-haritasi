import * as THREE from "three";

import { CONSTELLATION_SEGMENTS, constellationSegmentToVectors } from "../astro/constellations";
import { computeSolarSystemObjects } from "../astro/planets";
import type { AppMode, LayerId, ObservationTime, QualityProfile, ResolvedLocation } from "../types";
import { loadSkyStars } from "./data";
import {
  createCosmicGalaxyLayer,
  createDeepSkyBackground,
  createMilkyWayInteriorLayer,
  createVolumetricNebulaGroup,
  DeepSpaceAssets
} from "./deepSpaceLayers";
import { AdaptiveQualityController, detectInitialQuality } from "./quality";
import { createRoundPointMaterial } from "./roundPointMaterial";
import type { PlanetInfo } from "./SolarSystemLayer";
import { SolarSystemLayer } from "./SolarSystemLayer";
import { createStarMaterial } from "./starMaterial";
import { TileManager } from "./streamingTiles";
import {
  GALACTIC_CENTER,
  MilkyWayFlightController,
  SUN_START,
  type FlightControlsElements
} from "./MilkyWayFlightController";

// Lazy-load postprocessing (bloom) — ilk pakete girmesin
type Composer = { render(): void; setSize(w: number, h: number): void };

interface SkyAppOptions {
  container: HTMLElement;
  mode: AppMode;
  astrologyEnabled: boolean;
  location?: ResolvedLocation;
  observation?: ObservationTime;
  onLayerChange: (layer: LayerId) => void;
  onStatus: (status: string) => void;
  onSolarSystemReady?: (ready: boolean) => void;
  onMilkyWayFlightActive?: (active: boolean) => void;
  onNeedsAstrologyInput?: () => void;
  onPlanetInfo: (info: PlanetInfo | Record<string, unknown> | null) => void;
  flightControls?: FlightControlsElements;
}

const LAYERS: LayerId[] = ["sky", "stars", "constellations", "solar-system", "milky-way", "cosmic-web"];
const VISIBLE_GROUP_BY_LAYER: Record<LayerId, LayerId> = {
  sky: "sky",
  stars: "sky",
  constellations: "sky",
  "solar-system": "solar-system",
  "milky-way": "milky-way",
  "cosmic-web": "cosmic-web"
};
const SKY_RADIUS = 180;
const HORIZON_RADIUS = 120;

export class SkyApp {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(68, 1, 0.01, 5000);
  private renderer: THREE.WebGLRenderer;
  private groups = new Map<LayerId, THREE.Group>();
  private quality: QualityProfile;
  private qualityController: AdaptiveQualityController;
  private animation = 0;
  private activeLayer: LayerId = "sky";
  private rotation = new THREE.Vector2(0, 0.14);
  private targetRotation = new THREE.Vector2(0, 0.14);
  private zoom = 1;
  private dragging = false;
  private lastPointer = new THREE.Vector2();
  private solarSystemLayer?: SolarSystemLayer;
  private lastFrame = performance.now();
  private targetFov = 68;
  private activePointers = new Map<number, THREE.Vector2>();
  private lastPinchDistance?: number;
  private starMaterials: THREE.ShaderMaterial[] = [];
  private pointerDownAt?: THREE.Vector2;
  private interactiveSkyGroup = new THREE.Group();
  private brightStars: any[] = [];
  private constellationsInfo: any[] = [];
  private raycaster = new THREE.Raycaster();
  private deepSpaceAssets = new DeepSpaceAssets();
  private milkyWayMounted = false;
  private cosmicMounted = false;
  private composer?: Composer;
  private driftAngle = 0; // kamera sürüklenme açısı
  private tileManager?: TileManager;
  private milkyWayFlight: MilkyWayFlightController;
  private fallbackObservation: ObservationTime = {
    localDateTime: new Date().toISOString(),
    utcDate: new Date(),
    timezone: "UTC"
  };

  constructor(private options: SkyAppOptions) {
    this.quality = detectInitialQuality();
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality.antialias,
      alpha: false,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true   // Yakın/uzak z-çakışmasını önler
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.66;
    this.qualityController = new AdaptiveQualityController(this.quality, (profile) => this.applyQuality(profile));
    this.camera.position.set(0, 0.02, 0);
    this.renderer.setClearColor("#050712", 1);
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.options.container.appendChild(this.renderer.domElement);
    this.createLayerGroups();
    this.bindControls();
    this.milkyWayFlight = new MilkyWayFlightController(this.camera, this.renderer.domElement, this.options.flightControls);
    this.resize();
  }

  async mount(): Promise<void> {
    if (this.options.mode === "astrology") {
      this.options.onStatus("Gökyüzü hazırlanıyor...");
      await this.mountSkyLayer();
      this.setLayer("sky");
      this.options.onStatus("Gökyüzü hazır");
    } else {
      this.options.onStatus("Serbest gezi hazırlanıyor...");
      await this.ensureMilkyWayLayer();
      this.setLayer("milky-way");
      this.options.onStatus("Serbest gezi hazır");
    }
    this.animate();

    // Bloom'u arka planda yükle (initial pakete girmesin)
    void this.setupBloom();
  }

  setLayer(layer: LayerId): void {
    this.resetPointerState();
    if ((layer === "sky" || layer === "stars" || layer === "constellations") && !this.canMountLocalSky()) {
      this.options.onStatus("Yerel gökyüzü için Astroloji Modu / zaman-konum bilgisi gerekli.");
      this.options.onNeedsAstrologyInput?.();
      return;
    }
    this.activeLayer = layer;
    const visibleGroup = VISIBLE_GROUP_BY_LAYER[layer];
    for (const [id, group] of this.groups) group.visible = id === visibleGroup;
    this.zoom = layer === "milky-way" ? 1.25 : layer === "cosmic-web" ? 3.6 : LAYERS.indexOf(layer) + 1;
    this.options.onLayerChange(layer);
    this.milkyWayFlight.setEnabled(layer === "milky-way");
    this.options.onMilkyWayFlightActive?.(layer === "milky-way");

    if (layer === "sky" || layer === "stars" || layer === "constellations") {
      const status = layer === "stars"
        ? "Yıldızlar ve parlak yıldız seçimleri hazır"
        : layer === "constellations"
          ? "Takımyıldızları hazır"
          : "Gökyüzü hazır";
      this.options.onStatus(status);
      this.options.onSolarSystemReady?.(false);
      this.options.onPlanetInfo?.(null);
      this.camera.position.set(0, 0.02, 0);
      this.targetFov = THREE.MathUtils.clamp(this.targetFov, 38, 78);
      this.solarSystemLayer?.disableControls();
    } else if (layer === "solar-system") {
      this.options.onStatus("Güneş sistemi hazır");
      this.options.onSolarSystemReady?.(true);
      this.options.onPlanetInfo?.(null);
      this.solarSystemLayer?.disableControls(); // mount sonrası etkinleşecek
      void this.ensureSolarSystemLayer();
    } else {
      this.options.onSolarSystemReady?.(false);
      this.options.onPlanetInfo?.(null);
      if (layer !== "milky-way") this.camera.position.set(0, 0, 2.25);
      this.camera.fov = layer === "milky-way" ? 68 : 65;
      this.camera.updateProjectionMatrix();
      this.solarSystemLayer?.disableControls();
    }

    if (layer === "milky-way") {
      this.options.onStatus("Samanyolu hazır");
      void this.ensureMilkyWayLayer();
    } else if (layer === "cosmic-web") {
      this.options.onStatus("Evren hazır");
      void this.ensureCosmicLayer();
    }
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.options.container;
    this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.composer?.setSize(clientWidth, clientHeight);
  }

  dispose(): void {
    cancelAnimationFrame(this.animation);
    this.solarSystemLayer?.dispose();
    this.tileManager?.dispose();
    this.milkyWayFlight.dispose();
    this.renderer.dispose();
    this.options.container.replaceChildren();
  }

  // ─── Katman grupları ──────────────────────────────────────────────────────

  private createLayerGroups(): void {
    for (const layer of LAYERS) {
      const group = new THREE.Group();
      this.scene.add(group);
      this.groups.set(layer, group);
    }
  }

  private async mountSkyLayer(): Promise<void> {
    if (!this.canMountLocalSky()) {
      this.options.onNeedsAstrologyInput?.();
      return;
    }
    const group = this.groups.get("sky")!;
    if (group.children.length > 0) return;
    const observation = this.options.observation!;
    const location = this.options.location!;
    const stars = await loadSkyStars(
      `${import.meta.env.BASE_URL}stars/hyg-stars.bin`,
      observation.utcDate,
      location,
      this.quality.starPointLimit
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(stars.positions, 3));
    geometry.setAttribute("magnitude", new THREE.BufferAttribute(stars.meta.filter((_, i) => i % 2 === 0), 1));
    geometry.setAttribute("bv", new THREE.BufferAttribute(stars.meta.filter((_, i) => i % 2 === 1), 1));

    // Yıldızları biraz farklı mesafelerde yerleştir (hafif derinlik)
    // Yüksek kalitede daha fazla varyasyon
    if (this.quality.name !== "low") {
      const pos = stars.positions;
      for (let i = 0; i < pos.length / 3; i++) {
        const jitter = 0.93 + Math.random() * 0.14;
        pos[i * 3]     *= jitter;
        pos[i * 3 + 1] *= jitter;
        pos[i * 3 + 2] *= jitter;
      }
    }

    const starMaterial = createStarMaterial({ twinkle: this.quality.name === "high" });
    this.starMaterials.push(starMaterial);
    const starField = new THREE.Points(geometry, starMaterial);
    starField.scale.setScalar(SKY_RADIUS);

    await this.addPhotographicSky(group);
    group.add(this.createAtmosphereDome());
    group.add(this.createMilkyWayBand());
    group.add(starField);

    // Interactive sky group (yıldız hitbox'ları vb. için)
    group.add(this.interactiveSkyGroup);

    // Load extra info
    try {
      const [starsRes, constsRes] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}data/bright_stars.json`),
        fetch(`${import.meta.env.BASE_URL}data/constellations_info.json`)
      ]);
      if (starsRes.ok) this.brightStars = await starsRes.json();
      if (constsRes.ok) this.constellationsInfo = await constsRes.json();
      this.createSkyHitboxes();
    } catch (err) {
      console.warn("Sky info load failed", err);
    }

    if (this.quality.name !== "low") {
      const glowMaterial = createStarMaterial({ sizeScale: 2.0, opacity: 0.055 });
      this.starMaterials.push(glowMaterial);
      const glow = new THREE.Points(geometry, glowMaterial);
      glow.scale.setScalar(SKY_RADIUS);
      group.add(glow);
    }

    group.add(this.createConstellations());
    group.add(this.createHorizon());
    this.addDirectionLabels(group);
    this.addSolarLabels(group);
  }

  private async addPhotographicSky(group: THREE.Group): Promise<void> {
    if (!this.options.observation || !this.options.location) return;
    try {
      group.add(await createDeepSkyBackground(this.deepSpaceAssets, this.quality, this.options.observation, this.options.location));
      group.add(await createVolumetricNebulaGroup(this.deepSpaceAssets, this.quality, this.options.observation, this.options.location));
    } catch (error) {
      console.warn("[deep-space] Photographic sky fallback active.", error);
    }
  }

  private async ensureSolarSystemLayer(): Promise<void> {
    if (!this.solarSystemLayer) {
      const group = this.groups.get("solar-system")!;
      this.options.onStatus("Güneş sistemi hazırlanıyor...");
      this.solarSystemLayer = new SolarSystemLayer(this.options.observation ?? this.fallbackObservation, this.quality);
      group.add(this.solarSystemLayer.group);
      await this.solarSystemLayer.mount(this.camera, this.renderer.domElement);
      this.options.onStatus("Güneş sistemi hazır");
    }
    this.camera.fov = 56;
    this.camera.updateProjectionMatrix();
    this.solarSystemLayer.resetFocus();
  }

  private async ensureMilkyWayLayer(): Promise<void> {
    if (this.milkyWayMounted) return;
    this.milkyWayMounted = true;
    const group = this.groups.get("milky-way")!;
    this.options.onStatus("Samanyolu hazırlanıyor...");
    try {
      group.add(createMilkyWayInteriorLayer(this.quality));
      this.tileManager = new TileManager(this.quality);
      group.add(this.tileManager.group);
      void this.tileManager.mount().catch((error) => {
        console.warn("[tiles] Progressive tile manifest unavailable.", error);
      });
      group.add(this.createSpriteLabel(
        "Samanyolu içi temsili görünüm — Güneş, galaktik merkezden ~26.000 ışık yılı uzaktadır.",
        new THREE.Vector3(0, 0.68, 0), "#dbe7ff", 0.52
      ));
    } catch (error) {
      console.warn("[deep-space] Milky Way fallback active.", error);
      this.mountPointCloudLayer("milky-way", this.quality.gaiaPointLimit, "#8bb7ff", 120);
    }
    this.options.onStatus("Samanyolu hazır");
  }

  private async ensureCosmicLayer(): Promise<void> {
    if (this.cosmicMounted) return;
    this.cosmicMounted = true;
    const group = this.groups.get("cosmic-web")!;
    this.options.onStatus("Evren hazırlanıyor...");
    try {
      group.add(createCosmicGalaxyLayer(this.quality));
      group.add(this.createSpriteLabel(
        "Galaksi dağılımı temsilidir — gözlemsel evrenin küçük bir kesiti.",
        new THREE.Vector3(0, 42, 0), "#dbe7ff", 18
      ));
    } catch (error) {
      console.warn("[deep-space] Cosmic fallback active.", error);
      this.mountPointCloudLayer("cosmic-web", this.quality.cosmicPointLimit, "#a8f7ff", 420);
    }
    this.options.onStatus("Evren hazır");
  }

  // ─── Bloom lazy-load ──────────────────────────────────────────────────────

  private async setupBloom(): Promise<void> {
    if (this.quality.name === "low") return;
    try {
      const [
        { EffectComposer },
        { RenderPass },
        { UnrealBloomPass }
      ] = await Promise.all([
        import("three/examples/jsm/postprocessing/EffectComposer.js"),
        import("three/examples/jsm/postprocessing/RenderPass.js"),
        import("three/examples/jsm/postprocessing/UnrealBloomPass.js")
      ]);
      const { clientWidth, clientHeight } = this.options.container;
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      // A maddesi: ölçülü bloom — sadece en parlak noktalar (yıldız çekirdekleri, Güneş)
      // Threshold yüksek → galaksi parçacıkları beyaza doymuyor
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(clientWidth, clientHeight),
        this.quality.name === "high" ? 0.18 : 0.12,  // strength — belirgin azaltıldı
        0.35,   // radius — küçük halo, lens artefaktı yok
        0.90    // threshold — yalnızca çok parlak çekirdekler
      );
      composer.addPass(bloom);
      this.composer = composer;
    } catch {
      // Bloom yüklenemezse sessizce devam et
    }
  }

  // ─── Gökyüzü bileşenleri ─────────────────────────────────────────────────

  private createHorizon(): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.sin(angle) * HORIZON_RADIUS, 0, Math.cos(angle) * HORIZON_RADIUS));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: "#4d6a96", transparent: true, opacity: 0.75 })
    );
  }

  private createSkyHitboxes(): void {
    if (!this.options.observation || !this.options.location) return;
    const starMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    for (const star of this.brightStars) {
      const seg = { name: "", from: [star.ra, star.dec], to: [star.ra, star.dec] } as any;
      const pos = constellationSegmentToVectors(seg, this.options.observation.utcDate, this.options.location)[0];
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 8), starMat);
      mesh.position.set(pos[0] * SKY_RADIUS * 0.95, pos[1] * SKY_RADIUS * 0.95, pos[2] * SKY_RADIUS * 0.95);
      mesh.userData = { type: "star", info: star };
      this.interactiveSkyGroup.add(mesh);
    }
  }

  private createConstellations(): THREE.Group {
    const group = new THREE.Group();
    const map = new Map<string, typeof CONSTELLATION_SEGMENTS>();
    CONSTELLATION_SEGMENTS.forEach(s => {
      if (!map.has(s.name)) map.set(s.name, []);
      map.get(s.name)!.push(s);
    });
    
    for (const [name, segments] of map.entries()) {
      if (!this.options.observation || !this.options.location) continue;
      const observation = this.options.observation;
      const location = this.options.location;
      const positions = new Float32Array(segments.length * 2 * 3);
      segments.forEach((segment, index) => {
        const [from, to] = constellationSegmentToVectors(segment, observation.utcDate, location);
        positions.set(from.map((v) => v * SKY_RADIUS), index * 6);
        positions.set(to.map((v) => v * SKY_RADIUS), index * 6 + 3);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ color: "#5c7aaa", transparent: true, opacity: 0.18, depthWrite: false });
      const line = new THREE.LineSegments(geometry, material);
      line.userData = { type: "constellation", info: this.constellationsInfo.find(c => c.name === name) };
      // hit test için raycast threshold
      (line as any).raycast = function(raycaster: THREE.Raycaster, intersects: any[]) {
        const oldThresh = raycaster.params.Line.threshold;
        raycaster.params.Line.threshold = 4.0;
        THREE.LineSegments.prototype.raycast.call(this, raycaster, intersects);
        raycaster.params.Line.threshold = oldThresh;
      };
      group.add(line);
    }
    return group;
  }

  private addDirectionLabels(group: THREE.Group): void {
    const labels: Array<[string, number, number, number]> = [
      ["K", 0, 2.4, HORIZON_RADIUS],
      ["D", HORIZON_RADIUS, 2.4, 0],
      ["G", 0, 2.4, -HORIZON_RADIUS],
      ["B", -HORIZON_RADIUS, 2.4, 0]
    ];
    labels.forEach(([text, x, y, z]) =>
      group.add(this.createSpriteLabel(text, new THREE.Vector3(x, y, z), "#9fb9e8", 7))
    );
  }

  private addSolarLabels(group: THREE.Group): void {
    if (!this.options.observation || !this.options.location) return;
    const objects = computeSolarSystemObjects(this.options.observation.utcDate, this.options.location)
      .filter((o) => o.altitude > -10);
    objects.forEach((object) => {
      const alt = THREE.MathUtils.degToRad(object.altitude);
      const az = THREE.MathUtils.degToRad(object.azimuth);
      const position = new THREE.Vector3(
        Math.cos(alt) * Math.sin(az) * SKY_RADIUS,
        Math.sin(alt) * SKY_RADIUS,
        Math.cos(alt) * Math.cos(az) * SKY_RADIUS
      );
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 16, 16),
        new THREE.MeshBasicMaterial({ color: object.color, transparent: true, opacity: 0.95 })
      );
      marker.position.copy(position);
      group.add(marker);
      group.add(this.createSpriteLabel(object.name, position.clone().multiplyScalar(1.006), object.color, 9));
    });
  }

  private createAtmosphereDome(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uHorizonGlow: { value: this.quality.name === "low" ? 0.18 : 0.32 } },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = normalize((modelMatrix * vec4(position, 1.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorld;
        uniform float uHorizonGlow;
        void main() {
          float y = vWorld.y;
          float horizon = pow(1.0 - abs(y), 2.5);
          vec3 deepSky = vec3(0.02, 0.03, 0.06);
          vec3 horizonGlowColor = vec3(0.05, 0.08, 0.16) * uHorizonGlow;
          gl_FragColor = vec4(mix(deepSky, horizonGlowColor, horizon), 1.0);
        }
      `,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 0.995, 32, 16), material);
  }


  private createMilkyWayBand(): THREE.Points {
    const count = this.quality.name === "low" ? 900 : this.quality.name === "medium" ? 2400 : 4500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tilt = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(THREE.MathUtils.degToRad(62), 0, THREE.MathUtils.degToRad(28))
    );
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const bw = 0.14 * Math.pow(Math.random(), 0.6);
      const band = (Math.random() < 0.5 ? 1 : -1) * bw;
      const radius = SKY_RADIUS * (0.984 + Math.random() * 0.012);
      const v = new THREE.Vector3(Math.cos(angle), band, Math.sin(angle)).normalize().applyMatrix4(tilt).multiplyScalar(radius);
      positions.set([v.x, v.y, v.z], i * 3);
      const warmth = 0.68 + Math.random() * 0.28;
      colors.set([0.38 * warmth, 0.48 * warmth, (0.72 + Math.random() * 0.15) * warmth], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const sizes = new Float32Array(count);
    const intensities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = 0.45 + Math.random() * 1.6;
      intensities[i] = 0.22 + Math.random() * 0.48;
    }
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    return new THREE.Points(geometry, createRoundPointMaterial({
      opacity: this.quality.name === "low" ? 0.08 : 0.12,
      maxPointSize: this.quality.name === "low" ? 2.8 : 3.8
    }));
  }

  private mountPointCloudLayer(layer: LayerId, count: number, color: string, radius: number): void {
    const group = this.groups.get(layer)!;
    const safeCount = Math.max(1000, count);
    const positions = new Float32Array(safeCount * 3);
    const colors = new Float32Array(safeCount * 3);
    const sizes = new Float32Array(safeCount);
    const intensities = new Float32Array(safeCount);
    for (let i = 0; i < safeCount; i++) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.12, r * Math.sin(phi) * Math.sin(theta)], i * 3);
      const base = new THREE.Color(color).lerp(new THREE.Color("#eef4ff"), Math.random() * 0.35);
      colors.set([base.r, base.g, base.b], i * 3);
      sizes[i] = 0.55 + Math.random() * 1.6;
      intensities[i] = 0.22 + (1 - r / radius) * 0.45 + Math.random() * 0.28;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    group.add(new THREE.Points(geometry, createRoundPointMaterial({ opacity: 0.55, maxPointSize: 5 })));
    const text = layer === "milky-way"
      ? "Samanyolu içi temsili görünüm"
      : "Galaksi dağılımı temsilidir";
    group.add(this.createSpriteLabel(text, new THREE.Vector3(0, radius * 0.1, 0), "#dbe7ff"));
  }

  private createSpriteLabel(text: string, position: THREE.Vector3, color: string, worldScale = 0.38): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 512; canvas.height = 128;
    ctx.fillStyle = color;
    ctx.font = "600 34px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false
    }));
    sprite.position.copy(position);
    sprite.scale.set(worldScale, worldScale * 0.25, 1);
    return sprite;
  }

  // ─── Kontroller ───────────────────────────────────────────────────────────

  private bindControls(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener("pointerdown", (event) => {
      // Her modda click tespiti için kaydet
      this.pointerDownAt = new THREE.Vector2(event.clientX, event.clientY);

      if (this.activeLayer === "milky-way") return;

      // Solar system: OrbitControls tam kontrolü alır, biz sadece click tespiti yaparız
      if (this.activeLayer === "solar-system") return;

      this.dragging = true;
      this.lastPointer.set(event.clientX, event.clientY);
      this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      // Solar system: OrbitControls yönetir
      if (this.activeLayer === "solar-system") return;
      if (this.activeLayer === "milky-way") return;

      this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      if (this.activePointers.size === 2) {
        const [first, second] = [...this.activePointers.values()];
        const distance = first.distanceTo(second);
        if (this.lastPinchDistance !== undefined) {
          this.targetFov = THREE.MathUtils.clamp(
            this.targetFov - (distance - this.lastPinchDistance) * 0.08, 28, 82
          );
        }
        this.lastPinchDistance = distance;
        return;
      }
      if (!this.dragging) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.targetRotation.x -= dx * 0.0032;
      this.targetRotation.y = THREE.MathUtils.clamp(this.targetRotation.y - dy * 0.0032, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
      this.lastPointer.set(event.clientX, event.clientY);
    });

    const endPointer = (event: PointerEvent) => {
      const isClick = this.pointerDownAt && new THREE.Vector2(event.clientX, event.clientY).distanceTo(this.pointerDownAt) < 8;
      
      if (this.activeLayer === "solar-system") {
        if (isClick) {
          const up = new THREE.Vector2(event.clientX, event.clientY);
          const info = this.solarSystemLayer?.focusFromScreenPoint(up, this.camera, this.renderer.domElement) || null;
          this.options.onPlanetInfo?.(info);
        }
        this.pointerDownAt = undefined;
        return;
      }

      if ((this.activeLayer === "sky" || this.activeLayer === "stars" || this.activeLayer === "constellations") && isClick) {
        const ndc = new THREE.Vector2(
          (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1,
          -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        // constellation çizgileri dahil tüm interactive group'ta kontrol et
        const skyGroup = this.groups.get("sky");
        const constGroup = skyGroup?.children.find(c => c.children.length > 0 && c.children[0] instanceof THREE.LineSegments);
        const targets = [...this.interactiveSkyGroup.children];
        if (this.activeLayer !== "stars" && constGroup) targets.push(...constGroup.children);
        if (this.activeLayer === "constellations") targets.splice(0, this.interactiveSkyGroup.children.length);

        const intersects = this.raycaster.intersectObjects(targets, false);
        
        // Önceki seçiliyi temizle
        if (constGroup) {
          constGroup.children.forEach((c: any) => {
            if (c.material) c.material.color.set("#5c7aaa");
          });
        }

        let found = false;
        for (const hit of intersects) {
          const ud = hit.object.userData;
          if (ud.type === "star" && this.activeLayer !== "constellations") {
            this.options.onPlanetInfo?.({ type: "star", ...ud.info });
            found = true;
            break;
          } else if (ud.type === "constellation" && this.activeLayer !== "stars") {
            if (ud.info) {
              this.options.onPlanetInfo?.({ type: "constellation", ...ud.info });
              // Highlight
              const mat = (hit.object as THREE.LineSegments).material as THREE.LineBasicMaterial;
              mat.color.set("#ffffff");
              found = true;
              break;
            }
          }
        }
        if (!found) this.options.onPlanetInfo?.(null);
      }

      if (this.activeLayer === "milky-way" && isClick) {
        const ndc = new THREE.Vector2(
          (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1,
          -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        const hits = this.raycaster.intersectObjects(this.groups.get("milky-way")?.children ?? [], true);
        const target = hits.find((hit) => {
          const type = hit.object.userData?.type ?? hit.object.parent?.userData?.type;
          return type === "black-hole" || type === "nebula" || type === "stars" || type === "dust";
        });
        const info = target
          ? (target.object.userData?.type ? target.object.userData : target.object.parent?.userData ?? null)
          : null;
        this.options.onPlanetInfo?.(info);
      }

      this.activePointers.delete(event.pointerId);
      this.lastPinchDistance = undefined;
      this.dragging = this.activePointers.size > 0;
      this.pointerDownAt = undefined;
    };

    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault(); // Her zaman sayfa kaydırmayı engelle
      if (this.activeLayer === "solar-system") return; // OrbitControls zoom
      if (this.activeLayer === "milky-way") return;
      if (this.activeLayer === "sky" || this.activeLayer === "stars" || this.activeLayer === "constellations") {
        this.targetFov = THREE.MathUtils.clamp(this.targetFov + Math.sign(event.deltaY) * 4, 28, 82);
        return;
      }
      this.zoom = THREE.MathUtils.clamp(this.zoom + Math.sign(event.deltaY) * 0.08, 1, 4);
    }, { passive: false });

    window.addEventListener("resize", () => this.resize());
  }

  private resetPointerState(): void {
    const canvas = this.renderer.domElement;
    for (const pointerId of this.activePointers.keys()) {
      try {
        if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be gone after browser-level cancel/navigation gestures.
      }
    }
    this.activePointers.clear();
    this.lastPinchDistance = undefined;
    this.dragging = false;
    this.pointerDownAt = undefined;
  }

  private applyQuality(profile: QualityProfile): void {
    this.renderer.setPixelRatio(profile.pixelRatio);
    console.debug(`[quality] ${profile.name} kalite profiline geçildi.`);
    this.resize();
  }

  /** Gezegen animasyonunu açar/kapar (D maddesi) */
  setSolarAnimation(enabled: boolean): void {
    this.solarSystemLayer?.setAnimationEnabled(enabled);
  }

  setAstrologyEnabled(enabled: boolean): void {
    this.options.astrologyEnabled = enabled;
  }

  resetSolarSystemView(): void {
    this.solarSystemLayer?.resetFocus();
    this.options.onPlanetInfo?.(null);
  }

  // ─── Ana animasyon döngüsü ────────────────────────────────────────────────

  private animate = (): void => {
    this.animation = requestAnimationFrame(this.animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    // Yıldız twinkle zamanı
    for (const material of this.starMaterials) {
      material.uniforms.uTime.value = now / 1000;
    }

    this.rotation.lerp(this.targetRotation, 0.08);
    const group = this.groups.get(this.activeLayer);

    if (this.activeLayer === "sky" || this.activeLayer === "stars" || this.activeLayer === "constellations") {
      // Çok yavaş otomatik drift — sinematik his
      this.driftAngle += deltaSeconds * 0.00008;
      this.camera.position.set(0, 0.02, 0);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.rotation.x + Math.sin(this.driftAngle) * 0.004;
      this.camera.rotation.x = this.rotation.y + Math.cos(this.driftAngle * 0.7) * 0.002;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, 0.08);
      this.camera.updateProjectionMatrix();
      if (group) group.rotation.set(0, 0, 0);

    } else if (this.activeLayer === "solar-system") {
      // OrbitControls ve uçuş animasyonu SolarSystemLayer.update() içinde

    } else if (this.activeLayer === "milky-way") {
      this.milkyWayFlight.setNearbyDistance(this.nearestMilkyWayTargetDistance());
      this.milkyWayFlight.update(deltaSeconds);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 68, 0.08);
      this.camera.updateProjectionMatrix();
      if (group) group.rotation.set(0, 0, 0);

    } else if (group) {
      group.rotation.y = this.rotation.x;
      group.rotation.x = this.rotation.y;
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 1.7 + this.zoom * 0.7, 0.04);
    }

    // Güneş sistemi animasyonları (revolution + spin + OrbitControls)
    this.solarSystemLayer?.update(deltaSeconds);
    // Güneş yüzey shader zamanı
    this.solarSystemLayer?.updateSunTime(now / 1000);
    this.tileManager?.update(this.camera);

    // Render — bloom varsa composer, yoksa direkt
    if (this.composer && this.quality.name !== "low") {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.qualityController.sampleFrame();
  };

  private canMountLocalSky(): boolean {
    return Boolean(this.options.observation && this.options.location);
  }

  private nearestMilkyWayTargetDistance(): number {
    return Math.min(
      this.camera.position.distanceTo(SUN_START),
      this.camera.position.distanceTo(GALACTIC_CENTER)
    );
  }
}
