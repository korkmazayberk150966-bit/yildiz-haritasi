import { Body, HelioVector } from "astronomy-engine";
import * as THREE from "three";

import type { ObservationTime, QualityProfile } from "../types";
import { createAtmosphereMaterial, createEarthMaterial } from "./earthMaterial";

interface PlanetSpec {
  body: Body;
  name: string;
  texture: string;
  radius: number;
  visualRadius: number;
  axialTilt: number;
  rotationHours: number;
  fallbackColor: string;
}

const PLANETS: PlanetSpec[] = [
  { body: Body.Mercury, name: "Merkur", texture: "mercury.jpg", radius: 0.018, visualRadius: 0.032, axialTilt: 0.03, rotationHours: 1407.6, fallbackColor: "#9e9a92" },
  { body: Body.Venus, name: "Venus", texture: "venus.jpg", radius: 0.044, visualRadius: 0.055, axialTilt: 177.4, rotationHours: -5832.5, fallbackColor: "#d99b46" },
  { body: Body.Earth, name: "Dunya", texture: "earth-day.jpg", radius: 0.047, visualRadius: 0.06, axialTilt: 23.44, rotationHours: 23.93, fallbackColor: "#4d86c6" },
  { body: Body.Mars, name: "Mars", texture: "mars.jpg", radius: 0.025, visualRadius: 0.043, axialTilt: 25.19, rotationHours: 24.62, fallbackColor: "#bb6a45" },
  { body: Body.Jupiter, name: "Jupiter", texture: "jupiter.jpg", radius: 0.18, visualRadius: 0.16, axialTilt: 3.13, rotationHours: 9.93, fallbackColor: "#d5a36a" },
  { body: Body.Saturn, name: "Saturn", texture: "saturn.jpg", radius: 0.15, visualRadius: 0.14, axialTilt: 26.73, rotationHours: 10.7, fallbackColor: "#d8bd7f" },
  { body: Body.Uranus, name: "Uranus", texture: "uranus.jpg", radius: 0.09, visualRadius: 0.09, axialTilt: 97.77, rotationHours: -17.2, fallbackColor: "#63b5df" },
  { body: Body.Neptune, name: "Neptun", texture: "neptune.jpg", radius: 0.088, visualRadius: 0.088, axialTilt: 28.32, rotationHours: 16.1, fallbackColor: "#4979c9" }
];

const TEXTURE_BASE = `${import.meta.env.BASE_URL}textures/planets/`;

export class SolarSystemLayer {
  readonly group = new THREE.Group();
  private textureLoader = new THREE.TextureLoader();
  private rotating: Array<{ pivot: THREE.Object3D; spin: THREE.Object3D; speed: number }> = [];
  private earthSunUniforms: THREE.Vector3[] = [];
  private mounted = false;
  private geometrySegments: number;
  private enableEarthExtras: boolean;

  constructor(private observation: ObservationTime, private quality: QualityProfile) {
    this.geometrySegments = quality.name === "low" ? 24 : quality.name === "medium" ? 32 : 48;
    this.enableEarthExtras = quality.name !== "low";
  }

  async mount(): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;
    this.group.add(new THREE.AmbientLight("#32415e", 0.52));
    const sunLight = new THREE.PointLight("#fff0bf", 3.5, 16, 1.2);
    this.group.add(sunLight);
    this.createSun();
    await Promise.all(PLANETS.map((planet) => this.createPlanet(planet)));
    this.group.add(this.createLabel("Tarihe bagli heliosentrik konumlar; dokular Katman 2 icin lazy yuklenir.", new THREE.Vector3(0, 0.42, 0), "#dbe7ff"));
  }

  update(deltaSeconds: number): void {
    for (const item of this.rotating) {
      item.spin.rotation.y += item.speed * deltaSeconds;
    }
  }

  private createSun(): void {
    const material = new THREE.MeshBasicMaterial({ color: "#ffd36d" });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.11, this.geometrySegments, this.geometrySegments), material);
    this.group.add(sun);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#ffb14a", transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending })
    );
    this.group.add(glow);
  }

  private async createPlanet(spec: PlanetSpec): Promise<void> {
    const pivot = new THREE.Group();
    const spin = new THREE.Group();
    const position = this.planetPosition(spec.body);
    pivot.position.copy(position);
    spin.rotation.z = THREE.MathUtils.degToRad(spec.axialTilt);
    pivot.add(spin);
    this.group.add(pivot);
    this.group.add(this.createOrbit(position.length()));

    const material = spec.body === Body.Earth
      ? await this.createEarthShaderMaterial(spec)
      : await this.createPlanetMaterial(spec);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.visualRadius, this.geometrySegments, this.geometrySegments), material);
    spin.add(mesh);
    this.rotating.push({ pivot, spin, speed: (Math.PI * 2) / Math.max(Math.abs(spec.rotationHours) * 0.8, 8) * Math.sign(spec.rotationHours || 1) });

    if (spec.body === Body.Earth) await this.decorateEarth(spin, spec.visualRadius, position);
    if (spec.body === Body.Saturn) this.addSaturnRings(spin, spec.visualRadius);
    pivot.add(this.createLabel(spec.name, new THREE.Vector3(0, spec.visualRadius * 1.75, 0), "#e7f0ff"));
  }

  private planetPosition(body: Body): THREE.Vector3 {
    const vector = HelioVector(body, this.observation.utcDate);
    const scale = 0.72;
    return new THREE.Vector3(vector.x * scale, vector.z * scale * 0.35, vector.y * scale);
  }

  private createOrbit(radius: number): THREE.Line {
    const orbit = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2).getPoints(192);
    const geometry = new THREE.BufferGeometry().setFromPoints(orbit.map((point) => new THREE.Vector3(point.x, 0, point.y)));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#2c456d", transparent: true, opacity: 0.5 }));
  }

  private async createPlanetMaterial(spec: PlanetSpec): Promise<THREE.MeshStandardMaterial> {
    const texture = await this.loadTexture(spec.texture);
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: texture ? "#ffffff" : spec.fallbackColor,
      roughness: 0.9,
      metalness: 0
    });
  }

  private async createEarthShaderMaterial(spec: PlanetSpec): Promise<THREE.Material> {
    const dayMap = await this.loadTexture(spec.texture);
    const nightMap = this.enableEarthExtras ? await this.loadTexture("earth-night.png") : undefined;
    const material = createEarthMaterial(dayMap ?? this.solidTexture(spec.fallbackColor), nightMap);
    const sunDir = new THREE.Vector3(0, 0, 0).sub(this.planetPosition(Body.Earth)).normalize();
    if (material instanceof THREE.ShaderMaterial) {
      material.uniforms.uSunDirection.value.copy(sunDir);
      this.earthSunUniforms.push(material.uniforms.uSunDirection.value);
    }
    return material;
  }

  private async decorateEarth(spin: THREE.Group, radius: number, position: THREE.Vector3): Promise<void> {
    if (!this.enableEarthExtras) return;
    const clouds = await this.loadTexture("earth-clouds.jpg");
    if (clouds) {
      const cloudMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.012, this.geometrySegments, this.geometrySegments),
        new THREE.MeshStandardMaterial({ map: clouds, transparent: true, opacity: 0.35, depthWrite: false })
      );
      spin.add(cloudMesh);
      this.rotating.push({ pivot: spin, spin: cloudMesh, speed: 0.035 });
    }
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 32, 32), createAtmosphereMaterial());
    atmosphere.position.copy(position.clone().multiplyScalar(0));
    spin.add(atmosphere);
  }

  private addSaturnRings(spin: THREE.Group, radius: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.35, radius * 2.35, this.geometrySegments * 2),
      this.createRingMaterial()
    );
    ring.rotation.x = Math.PI / 2;
    spin.add(ring);
  }

  private createRingMaterial(): THREE.MeshBasicMaterial {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = 16;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.18, "rgba(218,198,150,0.32)");
    gradient.addColorStop(0.36, "rgba(248,225,168,0.76)");
    gradient.addColorStop(0.52, "rgba(72,58,45,0.24)");
    gradient.addColorStop(0.74, "rgba(232,209,160,0.56)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    return new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
  }

  private async loadTexture(file: string): Promise<THREE.Texture | undefined> {
    return new Promise((resolve) => {
      this.textureLoader.load(
        `${TEXTURE_BASE}${file}`,
        (texture) => {
          const optimized = this.optimizeTexture(texture);
          optimized.colorSpace = THREE.SRGBColorSpace;
          optimized.anisotropy = this.quality.name === "high" ? 4 : 1;
          resolve(optimized);
        },
        undefined,
        () => resolve(undefined)
      );
    });
  }

  private optimizeTexture(texture: THREE.Texture): THREE.Texture {
    const image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!image) return texture;
    const maxWidth = this.quality.name === "low" ? 512 : this.quality.name === "medium" ? 1024 : 2048;
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    if (!sourceWidth || sourceWidth <= maxWidth) return texture;
    const scale = maxWidth / sourceWidth;
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.dispose();
    const optimized = new THREE.CanvasTexture(canvas);
    optimized.colorSpace = THREE.SRGBColorSpace;
    optimized.generateMipmaps = this.quality.name !== "low";
    optimized.minFilter = this.quality.name === "low" ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    return optimized;
  }

  private solidTexture(color: string): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext("2d")!;
    context.fillStyle = color;
    context.fillRect(0, 0, 2, 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createLabel(text: string, position: THREE.Vector3, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = color;
    context.font = "600 30px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.position.copy(position);
    sprite.scale.set(0.34, 0.085, 1);
    return sprite;
  }
}
