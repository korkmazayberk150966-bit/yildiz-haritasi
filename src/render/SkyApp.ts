import * as THREE from "three";

import { CONSTELLATION_SEGMENTS, constellationSegmentToVectors } from "../astro/constellations";
import { computeSolarSystemObjects } from "../astro/planets";
import type { LayerId, ObservationTime, QualityProfile, ResolvedLocation } from "../types";
import { loadSkyStars } from "./data";
import {
  createCosmicGalaxyLayer,
  createDeepSkyBackground,
  createMilkyWayExternalLayer,
  createNebulaSprites,
  DeepSpaceAssets
} from "./deepSpaceLayers";
import { AdaptiveQualityController, detectInitialQuality } from "./quality";
import { createRoundPointMaterial } from "./roundPointMaterial";
import { SolarSystemLayer } from "./SolarSystemLayer";
import { createStarMaterial } from "./starMaterial";

interface SkyAppOptions {
  container: HTMLElement;
  location: ResolvedLocation;
  observation: ObservationTime;
  onLayerChange: (layer: LayerId) => void;
  onStatus: (status: string) => void;
  onSolarSystemReady?: (ready: boolean) => void;
  onPlanetInfo?: (info: { name: string; distanceAu: number } | null) => void;
}

const LAYERS: LayerId[] = ["sky", "solar-system", "milky-way", "cosmic-web"];
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
  private deepSpaceAssets = new DeepSpaceAssets();
  private milkyWayMounted = false;
  private cosmicMounted = false;

  constructor(private options: SkyAppOptions) {
    this.quality = detectInitialQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.qualityController = new AdaptiveQualityController(this.quality, (profile) => this.applyQuality(profile));
    this.camera.position.set(0, 0.02, 0);
    this.renderer.setClearColor("#050712", 1);
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.options.container.appendChild(this.renderer.domElement);
    this.createLayerGroups();
    this.bindControls();
    this.resize();
  }

  async mount(): Promise<void> {
    this.options.onStatus("Gokyuzu hazirlaniyor...");
    await this.mountSkyLayer();
    this.setLayer("sky");
    this.animate();
    console.info(`[quality] ${this.quality.name} kalite profili ile hazir.`);
    this.options.onStatus("Hazir");
  }

  setLayer(layer: LayerId): void {
    this.activeLayer = layer;
    for (const [id, group] of this.groups) group.visible = id === layer;
    this.zoom = LAYERS.indexOf(layer) + 1;
    this.options.onLayerChange(layer);
    if (layer === "sky") {
      this.options.onSolarSystemReady?.(false);
      this.options.onPlanetInfo?.(null);
      this.camera.position.set(0, 0.02, 0);
      this.targetFov = THREE.MathUtils.clamp(this.targetFov, 38, 78);
    } else if (layer === "solar-system") {
      this.options.onSolarSystemReady?.(true);
      this.options.onPlanetInfo?.(null);
      this.resetSolarSystemView();
    } else {
      this.options.onSolarSystemReady?.(false);
      this.options.onPlanetInfo?.(null);
      this.camera.position.set(0, 0, 2.25);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    }
    if (layer === "solar-system") {
      void this.ensureSolarSystemLayer();
    } else if (layer === "milky-way") {
      void this.ensureMilkyWayLayer();
    } else if (layer === "cosmic-web") {
      void this.ensureCosmicLayer();
    }
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.options.container;
    this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }

  dispose(): void {
    cancelAnimationFrame(this.animation);
    this.renderer.dispose();
    this.options.container.replaceChildren();
  }

  private createLayerGroups(): void {
    for (const layer of LAYERS) {
      const group = new THREE.Group();
      this.scene.add(group);
      this.groups.set(layer, group);
    }
  }

  private async mountSkyLayer(): Promise<void> {
    const group = this.groups.get("sky")!;
    const stars = await loadSkyStars(
      `${import.meta.env.BASE_URL}stars/hyg-stars.bin`,
      this.options.observation.utcDate,
      this.options.location,
      this.quality.starPointLimit
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(stars.positions, 3));
    geometry.setAttribute("magnitude", new THREE.BufferAttribute(stars.meta.filter((_, index) => index % 2 === 0), 1));
    geometry.setAttribute("bv", new THREE.BufferAttribute(stars.meta.filter((_, index) => index % 2 === 1), 1));
    const starMaterial = createStarMaterial({ twinkle: this.quality.name === "high" });
    this.starMaterials.push(starMaterial);
    const starField = new THREE.Points(geometry, starMaterial);
    starField.scale.setScalar(SKY_RADIUS);
    await this.addPhotographicSky(group);
    group.add(this.createAtmosphereDome());
    group.add(this.createGround());
    group.add(this.createMilkyWayBand());
    group.add(starField);
    if (this.quality.name !== "low") {
      const glowMaterial = createStarMaterial({ sizeScale: 1.75, opacity: 0.07 });
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
    try {
      group.add(await createDeepSkyBackground(this.deepSpaceAssets, this.quality, this.options.observation, this.options.location));
      group.add(await createNebulaSprites(this.deepSpaceAssets, this.options.observation, this.options.location));
    } catch (error) {
      console.warn("[deep-space] Photographic sky fallback active.", error);
    }
  }

  private createHorizon(): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.sin(angle) * HORIZON_RADIUS, 0, Math.cos(angle) * HORIZON_RADIUS));
    }
    const material = new THREE.LineBasicMaterial({ color: "#4d6a96", transparent: true, opacity: 0.75 });
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
  }

  private createConstellations(): THREE.LineSegments {
    const positions = new Float32Array(CONSTELLATION_SEGMENTS.length * 2 * 3);
    CONSTELLATION_SEGMENTS.forEach((segment, index) => {
      const [from, to] = constellationSegmentToVectors(segment, this.options.observation.utcDate, this.options.location);
      positions.set(from.map((value) => value * SKY_RADIUS), index * 6);
      positions.set(to.map((value) => value * SKY_RADIUS), index * 6 + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: "#6d88b8", transparent: true, opacity: 0.22, depthWrite: false })
    );
  }

  private addDirectionLabels(group: THREE.Group): void {
    const labels: Array<[string, number, number, number]> = [
      ["K", 0, 2.4, HORIZON_RADIUS],
      ["D", HORIZON_RADIUS, 2.4, 0],
      ["G", 0, 2.4, -HORIZON_RADIUS],
      ["B", -HORIZON_RADIUS, 2.4, 0]
    ];
    labels.forEach(([text, x, y, z]) => group.add(this.createSpriteLabel(text, new THREE.Vector3(x, y, z), "#9fb9e8", 7)));
  }

  private addSolarLabels(group: THREE.Group): void {
    const objects = computeSolarSystemObjects(this.options.observation.utcDate, this.options.location).filter((object) => object.altitude > -10);
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
      uniforms: {
        uHorizonGlow: { value: this.quality.name === "low" ? 0.18 : 0.32 }
      },
      vertexShader: `
        varying vec3 vWorld;

        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = normalize(world.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uHorizonGlow;
        varying vec3 vWorld;

        void main() {
          float horizon = pow(1.0 - clamp(vWorld.y, 0.0, 1.0), 2.2);
          vec3 zenith = vec3(0.015, 0.027, 0.075);
          vec3 lowSky = vec3(0.08, 0.13, 0.22) * uHorizonGlow;
          gl_FragColor = vec4(mix(zenith, lowSky, horizon), 1.0);
        }
      `
    });
    return new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 0.995, 32, 16), material);
  }

  private createGround(): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(HORIZON_RADIUS * 1.4, 96);
    const material = new THREE.MeshBasicMaterial({ color: "#02040a", transparent: true, opacity: 0.86, depthWrite: true });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    return ground;
  }

  private createMilkyWayBand(): THREE.Points {
    const count = this.quality.name === "low" ? 550 : this.quality.name === "medium" ? 1200 : 2200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(62), 0, THREE.MathUtils.degToRad(28)));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const band = (Math.random() - 0.5) * 0.18;
      const radius = SKY_RADIUS * (0.985 + Math.random() * 0.01);
      const vector = new THREE.Vector3(Math.cos(angle), band, Math.sin(angle)).normalize().applyMatrix4(tilt).multiplyScalar(radius);
      positions.set([vector.x, vector.y, vector.z], i * 3);
      const warmth = 0.72 + Math.random() * 0.24;
      colors.set([0.42 * warmth, 0.52 * warmth, 0.78 * warmth], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const sizes = new Float32Array(count);
    const intensities = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      sizes[i] = 0.55 + Math.random() * 1.4;
      intensities[i] = 0.28 + Math.random() * 0.42;
    }
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    const material = createRoundPointMaterial({
      opacity: this.quality.name === "low" ? 0.16 : 0.24,
      maxPointSize: this.quality.name === "low" ? 2.4 : 3.4
    });
    return new THREE.Points(geometry, material);
  }

  private async ensureSolarSystemLayer(): Promise<void> {
    const group = this.groups.get("solar-system")!;
    if (this.solarSystemLayer) return;
    this.options.onStatus("Gunes sistemi hazirlaniyor...");
    this.solarSystemLayer = new SolarSystemLayer(this.options.observation, this.quality);
    group.add(this.solarSystemLayer.group);
    await this.solarSystemLayer.mount();
    this.options.onStatus("Gunes sistemi hazir");
  }

  private async ensureMilkyWayLayer(): Promise<void> {
    if (this.milkyWayMounted) return;
    this.milkyWayMounted = true;
    const group = this.groups.get("milky-way")!;
    this.options.onStatus("Samanyolu hazirlaniyor...");
    try {
      group.add(await createMilkyWayExternalLayer(this.deepSpaceAssets, this.quality));
      group.add(this.createSpriteLabel("Samanyolu dis gorunumu temsilidir; Gunes ~8 kpc uzaklikta isaretlenir.", new THREE.Vector3(0, 0.62, 0), "#dbe7ff", 0.48));
    } catch (error) {
      console.warn("[deep-space] Milky Way atlas fallback active.", error);
      this.mountPointCloudLayer("milky-way", this.quality.gaiaPointLimit, "#8bb7ff", 120);
    }
    this.options.onStatus("Samanyolu hazir");
  }

  private async ensureCosmicLayer(): Promise<void> {
    if (this.cosmicMounted) return;
    this.cosmicMounted = true;
    const group = this.groups.get("cosmic-web")!;
    this.options.onStatus("Evren katmani hazirlaniyor...");
    try {
      group.add(await createCosmicGalaxyLayer(this.deepSpaceAssets, this.quality));
      group.add(this.createSpriteLabel("Galaksi dagilimi temsilidir; gercek katalog konumlari degildir.", new THREE.Vector3(0, 42, 0), "#dbe7ff", 18));
    } catch (error) {
      console.warn("[deep-space] Cosmic atlas fallback active.", error);
      this.mountPointCloudLayer("cosmic-web", this.quality.cosmicPointLimit, "#a8f7ff", 420);
    }
    this.options.onStatus("Evren katmani hazir");
  }

  private mountPointCloudLayer(layer: LayerId, count: number, color: string, radius: number): void {
    const group = this.groups.get(layer)!;
    const safeCount = Math.max(1000, count);
    const positions = new Float32Array(safeCount * 3);
    const colors = new Float32Array(safeCount * 3);
    const sizes = new Float32Array(safeCount);
    const intensities = new Float32Array(safeCount);
    for (let i = 0; i < safeCount; i += 1) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.12, r * Math.sin(phi) * Math.sin(theta)], i * 3);
      const depth = 1 - r / radius;
      const base = new THREE.Color(color);
      const tint = layer === "cosmic-web" ? new THREE.Color("#d7fbff") : new THREE.Color("#eef4ff");
      base.lerp(tint, Math.random() * 0.35);
      colors.set([base.r, base.g, base.b], i * 3);
      sizes[i] = (layer === "milky-way" ? 0.55 : 1.05) + Math.random() * (layer === "milky-way" ? 1.6 : 2.8);
      intensities[i] = 0.22 + depth * 0.45 + Math.random() * 0.28;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    const material = createRoundPointMaterial({
      opacity: layer === "milky-way" ? 0.5 : 0.62,
      maxPointSize: layer === "milky-way" ? 4.2 : 6.5
    });
    group.add(new THREE.Points(geometry, material));
    const text = layer === "milky-way"
      ? "Samanyolu: Gunes'in galaktik konumu insan omrunde anlamli degismez."
      : "Kozmik ag: dogum aninin fotografi degil, kozmik adresimizin temsili.";
    group.add(this.createSpriteLabel(text, new THREE.Vector3(0, radius * 0.1, 0), "#dbe7ff"));
  }

  private createSpriteLabel(text: string, position: THREE.Vector3, color: string, worldScale = 0.38): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = color;
    context.font = "600 34px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.copy(position);
    sprite.scale.set(worldScale, worldScale * 0.25, 1);
    return sprite;
  }

  private bindControls(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.lastPointer.set(event.clientX, event.clientY);
      this.pointerDownAt = new THREE.Vector2(event.clientX, event.clientY);
      this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      if (this.activePointers.size === 2) {
        const [first, second] = [...this.activePointers.values()];
        const distance = first.distanceTo(second);
        if (this.lastPinchDistance) {
          this.targetFov = THREE.MathUtils.clamp(this.targetFov - (distance - this.lastPinchDistance) * 0.08, 28, 82);
        }
        this.lastPinchDistance = distance;
        return;
      }
      if (!this.dragging) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.targetRotation.x -= dx * 0.0032;
      this.targetRotation.y = THREE.MathUtils.clamp(this.targetRotation.y - dy * 0.0032, -1.35, 1.35);
      this.lastPointer.set(event.clientX, event.clientY);
    });
    const endPointer = (event: PointerEvent) => {
      if (this.activeLayer === "solar-system" && this.pointerDownAt) {
        const up = new THREE.Vector2(event.clientX, event.clientY);
        if (up.distanceTo(this.pointerDownAt) < 8) {
          const info = this.solarSystemLayer?.focusFromScreenPoint(up, this.camera, this.renderer.domElement);
          if (info) this.options.onPlanetInfo?.(info);
        }
      }
      this.activePointers.delete(event.pointerId);
      this.lastPinchDistance = undefined;
      this.dragging = this.activePointers.size > 0;
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (this.activeLayer === "sky") {
        this.targetFov = THREE.MathUtils.clamp(this.targetFov + Math.sign(event.deltaY) * 4, 28, 82);
        return;
      }
      this.zoom = THREE.MathUtils.clamp(this.zoom + Math.sign(event.deltaY) * 0.08, 1, 4);
    }, { passive: false });
    window.addEventListener("resize", () => this.resize());
  }

  private applyQuality(profile: QualityProfile): void {
    this.renderer.setPixelRatio(profile.pixelRatio);
    console.info(`[quality] Performans icin ${profile.name} kalite profiline gecildi.`);
    this.resize();
  }

  resetSolarSystemView(): void {
    this.solarSystemLayer?.resetFocus();
    this.options.onPlanetInfo?.(null);
    this.camera.position.set(0, 3.4, 5.8);
    this.camera.fov = 56;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.animation = requestAnimationFrame(this.animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    for (const material of this.starMaterials) {
      material.uniforms.uTime.value = now / 1000;
    }
    this.rotation.lerp(this.targetRotation, 0.08);
    const group = this.groups.get(this.activeLayer);
    if (this.activeLayer === "sky") {
      this.camera.position.set(0, 0.02, 0);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.rotation.x;
      this.camera.rotation.x = this.rotation.y;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, 0.08);
      this.camera.updateProjectionMatrix();
      if (group) {
        group.rotation.set(0, 0, 0);
      }
    } else if (this.activeLayer === "solar-system" && this.solarSystemLayer) {
      this.solarSystemLayer.updateCamera(this.camera, deltaSeconds);
    } else if (group) {
      group.rotation.y = this.rotation.x;
      group.rotation.x = this.rotation.y;
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 1.7 + this.zoom * 0.7, 0.04);
    }
    this.solarSystemLayer?.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
    this.qualityController.sampleFrame();
  };
}
