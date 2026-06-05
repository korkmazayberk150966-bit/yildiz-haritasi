import * as THREE from "three";

import { CONSTELLATION_SEGMENTS, constellationSegmentToVectors } from "../astro/constellations";
import { computeSolarSystemObjects } from "../astro/planets";
import type { LayerId, ObservationTime, QualityProfile, ResolvedLocation } from "../types";
import { loadSkyStars } from "./data";
import { AdaptiveQualityController, detectInitialQuality } from "./quality";
import { SolarSystemLayer } from "./SolarSystemLayer";
import { createStarMaterial } from "./starMaterial";

interface SkyAppOptions {
  container: HTMLElement;
  location: ResolvedLocation;
  observation: ObservationTime;
  onLayerChange: (layer: LayerId) => void;
  onStatus: (status: string) => void;
}

const LAYERS: LayerId[] = ["sky", "solar-system", "milky-way", "cosmic-web"];

export class SkyApp {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(65, 1, 0.01, 5000);
  private renderer: THREE.WebGLRenderer;
  private groups = new Map<LayerId, THREE.Group>();
  private quality: QualityProfile;
  private qualityController: AdaptiveQualityController;
  private animation = 0;
  private activeLayer: LayerId = "sky";
  private rotation = new THREE.Vector2(0.2, 0.1);
  private targetRotation = new THREE.Vector2(0.2, 0.1);
  private zoom = 1;
  private dragging = false;
  private lastPointer = new THREE.Vector2();
  private solarSystemLayer?: SolarSystemLayer;
  private lastFrame = performance.now();

  constructor(private options: SkyAppOptions) {
    this.quality = detectInitialQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, alpha: false, powerPreference: "high-performance" });
    this.qualityController = new AdaptiveQualityController(this.quality, (profile) => this.applyQuality(profile));
    this.camera.position.set(0, 0, 2.25);
    this.renderer.setClearColor("#050712", 1);
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.options.container.appendChild(this.renderer.domElement);
    this.createLayerGroups();
    this.bindControls();
    this.resize();
  }

  async mount(): Promise<void> {
    this.options.onStatus("Yildiz verisi yukleniyor...");
    await this.mountSkyLayer();
    this.mountPointCloudLayer("milky-way", this.quality.gaiaPointLimit, "#8bb7ff", 120);
    this.mountPointCloudLayer("cosmic-web", this.quality.cosmicPointLimit, "#a8f7ff", 420);
    this.setLayer("sky");
    this.animate();
    this.options.onStatus(`${this.quality.name} kalite profili ile hazir.`);
  }

  setLayer(layer: LayerId): void {
    this.activeLayer = layer;
    for (const [id, group] of this.groups) group.visible = id === layer;
    this.zoom = LAYERS.indexOf(layer) + 1;
    this.options.onLayerChange(layer);
    if (layer === "solar-system") {
      void this.ensureSolarSystemLayer();
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
    group.add(new THREE.Points(geometry, createStarMaterial()));
    group.add(this.createConstellations());
    group.add(this.createHorizon());
    this.addDirectionLabels(group);
    this.addSolarLabels(group);
  }

  private createHorizon(): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)));
    }
    const material = new THREE.LineBasicMaterial({ color: "#4d6a96", transparent: true, opacity: 0.75 });
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
  }

  private createConstellations(): THREE.LineSegments {
    const positions = new Float32Array(CONSTELLATION_SEGMENTS.length * 2 * 3);
    CONSTELLATION_SEGMENTS.forEach((segment, index) => {
      const [from, to] = constellationSegmentToVectors(segment, this.options.observation.utcDate, this.options.location);
      positions.set(from, index * 6);
      positions.set(to, index * 6 + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: "#5f7fb8", transparent: true, opacity: 0.42 })
    );
  }

  private addDirectionLabels(group: THREE.Group): void {
    const labels: Array<[string, number, number, number]> = [
      ["K", 0, 0, 1.08],
      ["D", 1.08, 0, 0],
      ["G", 0, 0, -1.08],
      ["B", -1.08, 0, 0]
    ];
    labels.forEach(([text, x, y, z]) => group.add(this.createSpriteLabel(text, new THREE.Vector3(x, y, z), "#9fb9e8")));
  }

  private addSolarLabels(group: THREE.Group): void {
    const objects = computeSolarSystemObjects(this.options.observation.utcDate, this.options.location).filter((object) => object.altitude > -10);
    objects.forEach((object) => {
      const alt = THREE.MathUtils.degToRad(object.altitude);
      const az = THREE.MathUtils.degToRad(object.azimuth);
      const position = new THREE.Vector3(Math.cos(alt) * Math.sin(az), Math.sin(alt), Math.cos(alt) * Math.cos(az));
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 16, 16),
        new THREE.MeshBasicMaterial({ color: object.color })
      );
      marker.position.copy(position);
      group.add(marker);
      group.add(this.createSpriteLabel(object.name, position.clone().multiplyScalar(1.06), object.color));
    });
  }

  private async ensureSolarSystemLayer(): Promise<void> {
    const group = this.groups.get("solar-system")!;
    if (this.solarSystemLayer) return;
    this.options.onStatus("Gezegen dokulari tembel yukleniyor...");
    this.solarSystemLayer = new SolarSystemLayer(this.options.observation, this.quality);
    group.add(this.solarSystemLayer.group);
    await this.solarSystemLayer.mount();
    this.options.onStatus("Gercekci gezegen render'i hazir.");
  }

  private mountPointCloudLayer(layer: LayerId, count: number, color: string, radius: number): void {
    const group = this.groups.get(layer)!;
    const safeCount = Math.max(1000, count);
    const positions = new Float32Array(safeCount * 3);
    for (let i = 0; i < safeCount; i += 1) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.12, r * Math.sin(phi) * Math.sin(theta)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: layer === "milky-way" ? 0.18 : 0.7, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending });
    group.add(new THREE.Points(geometry, material));
    const text = layer === "milky-way"
      ? "Samanyolu: Gunes'in galaktik konumu insan omrunde anlamli degismez."
      : "Kozmik ag: dogum aninin fotografi degil, kozmik adresimizin temsili.";
    group.add(this.createSpriteLabel(text, new THREE.Vector3(0, radius * 0.1, 0), "#dbe7ff"));
  }

  private createSpriteLabel(text: string, position: THREE.Vector3, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = color;
    context.font = "600 34px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.position.copy(position);
    sprite.scale.set(0.38, 0.095, 1);
    return sprite;
  }

  private bindControls(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.lastPointer.set(event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.targetRotation.x += dx * 0.004;
      this.targetRotation.y += dy * 0.004;
      this.lastPointer.set(event.clientX, event.clientY);
    });
    canvas.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const next = THREE.MathUtils.clamp(this.zoom + Math.sign(event.deltaY) * 0.08, 1, 4);
      this.setLayer(LAYERS[Math.round(next) - 1]);
    }, { passive: false });
    window.addEventListener("resize", () => this.resize());
  }

  private applyQuality(profile: QualityProfile): void {
    this.renderer.setPixelRatio(profile.pixelRatio);
    this.options.onStatus(`Performans icin ${profile.name} kalite profiline gecildi.`);
    this.resize();
  }

  private animate = (): void => {
    this.animation = requestAnimationFrame(this.animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.rotation.lerp(this.targetRotation, 0.08);
    const group = this.groups.get(this.activeLayer);
    if (group) {
      group.rotation.y = this.rotation.x;
      group.rotation.x = this.rotation.y;
    }
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 1.7 + this.zoom * 0.7, 0.04);
    this.solarSystemLayer?.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
    this.qualityController.sampleFrame();
  };
}
