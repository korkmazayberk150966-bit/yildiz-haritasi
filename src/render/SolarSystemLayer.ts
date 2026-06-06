import { Body, HelioVector } from "astronomy-engine";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";

import {
  buildAspectText,
  findAspect,
  getPlanetLongitude,
  longitudeToZodiac,
  PLANET_MEANINGS
} from "../astro/astrology";
import type { ObservationTime, QualityProfile } from "../types";
import { createAtmosphereMaterial, createEarthMaterial } from "./earthMaterial";

// 1 gerçek saniye = 5 simülasyon günü (animasyon modunda)
const SIM_DAYS_PER_SECOND = 5;

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface PlanetSpec {
  body: Body;
  name: string;
  texture: string;
  radius: number;
  visualRadius: number;
  axialTilt: number;
  rotationHours: number;
  orbitalPeriodDays: number;
  fallbackColor: string;
}

interface PlanetHandle {
  spec: PlanetSpec;
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  distanceAu: number;
  orbitRadius: number;
  orbitSpeed: number;
  currentAngle: number;
}

// Pano için genişletilmiş gezegen bilgisi
export interface PlanetInfo {
  name: string;
  symbol: string;
  distanceAu: number;
  distanceKm: number;
  zodiacSign: string;
  zodiacDegree: number;
  meaning: string;
  keywords: string;
  aspectText: string;
  isGenerational: boolean;
}

const PLANETS: PlanetSpec[] = [
  { body: Body.Mercury, name: "Merkür",  texture: "mercury.jpg",   radius: 0.018, visualRadius: 0.055, axialTilt: 0.03,   rotationHours: 1407.6,  orbitalPeriodDays: 87.97,  fallbackColor: "#9e9a92" },
  { body: Body.Venus,   name: "Venüs",   texture: "venus.jpg",     radius: 0.044, visualRadius: 0.075, axialTilt: 177.4,  rotationHours: -5832.5, orbitalPeriodDays: 224.7,  fallbackColor: "#d99b46" },
  { body: Body.Earth,   name: "Dünya",   texture: "earth-day.jpg", radius: 0.047, visualRadius: 0.082, axialTilt: 23.44,  rotationHours: 23.93,   orbitalPeriodDays: 365.25, fallbackColor: "#4d86c6" },
  { body: Body.Mars,    name: "Mars",    texture: "mars.jpg",      radius: 0.025, visualRadius: 0.066, axialTilt: 25.19,  rotationHours: 24.62,   orbitalPeriodDays: 686.97, fallbackColor: "#bb6a45" },
  { body: Body.Jupiter, name: "Jüpiter", texture: "jupiter.jpg",   radius: 0.18,  visualRadius: 0.22,  axialTilt: 3.13,   rotationHours: 9.93,    orbitalPeriodDays: 4332.6, fallbackColor: "#d5a36a" },
  { body: Body.Saturn,  name: "Satürn",  texture: "saturn.jpg",    radius: 0.15,  visualRadius: 0.19,  axialTilt: 26.73,  rotationHours: 10.7,    orbitalPeriodDays: 10759,  fallbackColor: "#d8bd7f" },
  { body: Body.Uranus,  name: "Uranüs",  texture: "uranus.jpg",    radius: 0.09,  visualRadius: 0.13,  axialTilt: 97.77,  rotationHours: -17.2,   orbitalPeriodDays: 30687,  fallbackColor: "#63b5df" },
  { body: Body.Neptune, name: "Neptün",  texture: "neptune.jpg",   radius: 0.088, visualRadius: 0.13,  axialTilt: 28.32,  rotationHours: 16.1,    orbitalPeriodDays: 60190,  fallbackColor: "#4979c9" }
];

const TEXTURE_BASE = `${import.meta.env.BASE_URL}textures/planets/`;
const AU_TO_KM = 149_597_870.7;

// ─── Ana Sınıf ────────────────────────────────────────────────────────────────

export class SolarSystemLayer {
  readonly group = new THREE.Group();
  private textureLoader = new THREE.TextureLoader();
  private spinningObjects: Array<{ spin: THREE.Object3D; speed: number }> = [];
  private mounted = false;
  private geometrySegments: number;
  private enableEarthExtras: boolean;
  private planetHandles: PlanetHandle[] = [];
  private raycaster = new THREE.Raycaster();
  private controls?: OrbitControls;
  private camera?: THREE.PerspectiveCamera;

  // Animasyon (D maddesi)
  private animationEnabled = false;  // Varsayılan: KAPALI, doğum anında donmuş
  private sunLightRef?: THREE.PointLight;

  // Gezegene uçuş
  private flyTarget?: THREE.Vector3;
  private flyCameraTarget?: THREE.Vector3;
  private isFlying = false;

  constructor(private observation: ObservationTime, private quality: QualityProfile) {
    this.geometrySegments = quality.name === "low" ? 24 : quality.name === "medium" ? 32 : 48;
    this.enableEarthExtras = quality.name !== "low";
  }

  // Animasyon oynat/durdur (D maddesi — isteğe bağlı)
  setAnimationEnabled(enabled: boolean): void {
    this.animationEnabled = enabled;
  }

  enableControls(): void {
    if (this.controls) this.controls.enabled = true;
  }

  disableControls(): void {
    if (this.controls) this.controls.enabled = false;
  }

  async mount(camera: THREE.PerspectiveCamera, domElement: HTMLElement): Promise<void> {
    if (this.mounted) return;
    this.mounted = true;
    this.camera = camera;

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 16;
    this.controls.enabled = false;

    this.group.add(new THREE.AmbientLight("#1a2540", 0.28));
    const sunLight = new THREE.PointLight("#fff5e0", 5.5, 22, 1.2);
    sunLight.position.set(0, 0, 0);
    this.group.add(sunLight);
    this.sunLightRef = sunLight;

    this.createSun();
    await Promise.all(PLANETS.map((p) => this.createPlanet(p)));
    this.group.add(this.createLabel(
      "Tarihe bağlı heliyosentrik konumlar — doğum anı görünümü",
      new THREE.Vector3(0, 0.68, 0), "#dbe7ff", 0.52
    ));
  }

  update(deltaSeconds: number): void {
    // Kendi ekseni dönüşü — sadece animasyon modunda VE yavaş
    if (this.animationEnabled) {
      for (const item of this.spinningObjects) {
        item.spin.rotation.y += item.speed * deltaSeconds * 0.35; // yavaşlatılmış
      }
      // Yörünge (revolution) — sadece animasyon modunda
      for (const handle of this.planetHandles) {
        handle.currentAngle += handle.orbitSpeed * deltaSeconds * SIM_DAYS_PER_SECOND;
        handle.pivot.position.x = Math.cos(handle.currentAngle) * handle.orbitRadius;
        handle.pivot.position.z = Math.sin(handle.currentAngle) * handle.orbitRadius;
      }
    }

    // Güneş hafif ışık titreşimi
    if (this.sunLightRef) {
      const t = performance.now() / 1000;
      this.sunLightRef.intensity = 5.5 + Math.sin(t * 2.3) * 0.08 + Math.sin(t * 7.1) * 0.04;
    }

    // Gezegene uçuş animasyonu
    if (this.isFlying && this.camera && this.flyTarget && this.flyCameraTarget && this.controls) {
      const t = 1 - Math.pow(0.018, deltaSeconds);
      this.camera.position.lerp(this.flyCameraTarget, t);
      this.controls.target.lerp(this.flyTarget, t);
      if (this.camera.position.distanceTo(this.flyCameraTarget) < 0.04) {
        this.isFlying = false;
        this.controls.enabled = true;
      }
    }

    this.controls?.update();
  }

  resetFocus(): void {
    if (!this.camera || !this.controls) return;
    this.isFlying = true;
    this.controls.enabled = false;
    this.flyTarget = new THREE.Vector3(0, 0, 0);
    this.flyCameraTarget = new THREE.Vector3(0, 3.4, 5.8);
    this.controls.target.set(0, 0, 0);
  }

  focusFromScreenPoint(
    point: THREE.Vector2,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLElement
  ): PlanetInfo | null {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((point.x - rect.left) / rect.width) * 2 - 1,
      -(((point.y - rect.top) / rect.height) * 2 - 1)
    );
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects(this.planetHandles.map((h) => h.mesh), false);
    if (!hits[0]) return null;
    const handle = this.planetHandles.find((h) => h.mesh === hits[0].object);
    if (!handle) return null;

    // Gezegene uçuş
    const world = new THREE.Vector3();
    handle.pivot.getWorldPosition(world);
    const offset = new THREE.Vector3(0.55, 0.42, 1.0).normalize()
      .multiplyScalar(Math.max(0.65, handle.spec.visualRadius * 5.5));
    this.isFlying = true;
    this.flyTarget = world.clone();
    this.flyCameraTarget = world.clone().add(offset);
    if (this.controls) this.controls.enabled = false;

    // Astroloji hesapla (D)
    return this.buildPlanetInfo(handle.spec, handle.distanceAu);
  }

  /**
   * Gezegen için tam astroloji bilgisi — doğum zamanında hesaplanır.
   */
  private buildPlanetInfo(spec: PlanetSpec, distanceAu: number): PlanetInfo {
    const date = this.observation.utcDate;
    const meaning = PLANET_MEANINGS[spec.name] ?? PLANET_MEANINGS["Jüpiter"];

    // Geosentrik ekliptik boylam → burç
    const lon = getPlanetLongitude(spec.body, date);
    const zodiac = longitudeToZodiac(lon);

    // Güneş açısı (Güneş için gösterme)
    let aspectText = "";
    if (spec.name !== "Güneş") {
      const sunLon = getPlanetLongitude(Body.Sun, date);
      const aspect = findAspect(lon, sunLon);
      aspectText = buildAspectText(spec.name, aspect, aspect ? undefined : Math.abs(lon - sunLon) % 360);
    }

    return {
      name: spec.name,
      symbol: meaning.symbol,
      distanceAu,
      distanceKm: Math.round(distanceAu * AU_TO_KM),
      zodiacSign: zodiac.sign,
      zodiacDegree: zodiac.degree,
      meaning: meaning.fullMeaning,
      keywords: meaning.keywords,
      aspectText,
      isGenerational: meaning.isGenerational ?? false
    };
  }

  dispose(): void {
    this.controls?.dispose();
  }

  // ─── Güneş (C maddesi — gerçekçi shader) ─────────────────────────────────

  private createSun(): void {
    const sunGeo = new THREE.SphereGeometry(0.2, this.geometrySegments, this.geometrySegments);

    // Gerçekçi granülasyonlu Güneş shader'ı
    const sunMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Basit hash tabanlı gürültü (granülasyon)
        float hash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 19.19);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1;
            a *= 0.48;
          }
          return v;
        }

        void main() {
          // Limb darkening
          float limb = pow(clamp(abs(vNormal.z), 0.0, 1.0), 0.4);
          // Granülasyon dokusu — yavaş hareket
          vec2 uvAnim = vUv * 14.0 + vec2(uTime * 0.012, uTime * 0.007);
          float granule = fbm(uvAnim) * 0.5 + fbm(uvAnim * 1.8 + 3.1) * 0.3;
          float granuleStrength = 0.12 * limb;

          // Renk: merkez beyaz-sarı, kenar turuncu
          vec3 core = vec3(1.0, 0.96, 0.82);
          vec3 mid  = vec3(1.0, 0.82, 0.38);
          vec3 edge = vec3(0.92, 0.55, 0.16);
          vec3 color = mix(edge, mid, limb * 0.6);
          color = mix(color, core, pow(limb, 1.8));
          // Granülasyon tonu
          color += granule * granuleStrength * vec3(0.18, 0.12, 0.04);
          color = clamp(color, 0.0, 1.0);

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.userData = {
      isSun: true,
      spec: { name: "Güneş", body: Body.Sun, visualRadius: 0.2, texture: "", rotationHours: 0, orbitAu: 0, color: "#ffcc00" },
      distanceAu: 0,
      radiusAu: 0.2
    };
    this.spinningObjects.push({ spin: sunMesh, speed: 0 }); // spin yok ama time uniform güncellenecek
    this.group.add(sunMesh);

    // Shader uTime güncelleme için özel kayıt
    this.spinningObjects.push({
      spin: {
        rotation: { y: 0 },
        // Sahte obje — uTime güncelleme için kullanıyoruz
        get userData() { return { sunMat }; }
      } as unknown as THREE.Object3D,
      speed: 1
    });

    // İç glow (narenciye)
    this.group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 32, 32),
      new THREE.MeshBasicMaterial({
        color: "#ff8820", transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    ));
    // Korona halkası 1
    this.group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 32, 32),
      new THREE.MeshBasicMaterial({
        color: "#ff6600", transparent: true, opacity: 0.040,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    ));
    // Korona halkası 2 (çok geniş, çok sönük)
    this.group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshBasicMaterial({
        color: "#ff4400", transparent: true, opacity: 0.014,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    ));
  }

  // ─── Gezegen oluşturma ────────────────────────────────────────────────────

  private async createPlanet(spec: PlanetSpec): Promise<void> {
    const helioVec = HelioVector(spec.body, this.observation.utcDate);
    const distanceAu = this.distanceFromEarthAu(spec.body);
    const orbitRadius = 0.56 + Math.log1p(helioVec.Length()) * 0.82;
    const startAngle = Math.atan2(helioVec.y, helioVec.x);
    const orbitSpeedRadPerDay = (2 * Math.PI) / spec.orbitalPeriodDays;

    const pivot = new THREE.Group();
    // D: Başlangıç konumu astronomy-engine'den — DONMUŞ (animasyon kapalıyken değişmez)
    pivot.position.set(Math.cos(startAngle) * orbitRadius, 0, Math.sin(startAngle) * orbitRadius);
    this.group.add(pivot);
    this.group.add(this.createOrbit(orbitRadius));

    const spin = new THREE.Group();
    spin.rotation.z = THREE.MathUtils.degToRad(spec.axialTilt);
    pivot.add(spin);

    const material = spec.body === Body.Earth
      ? await this.createEarthShaderMaterial(spec, pivot.position)
      : await this.createPlanetMaterial(spec);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.visualRadius, this.geometrySegments, this.geometrySegments),
      material
    );
    mesh.userData = {
      spec,
      distanceAu,
      radiusAu: spec.visualRadius,
      planet: spec.name
    };
    spin.add(mesh);

    this.planetHandles.push({
      spec, pivot, mesh, distanceAu,
      orbitRadius,
      orbitSpeed: orbitSpeedRadPerDay,
      currentAngle: startAngle
    });

    const spinSpeed = (Math.PI * 2) / Math.max(Math.abs(spec.rotationHours) * 0.8, 8)
      * Math.sign(spec.rotationHours || 1);
    this.spinningObjects.push({ spin: mesh, speed: spinSpeed });

    if (spec.body === Body.Earth) await this.decorateEarth(spin, spec.visualRadius, pivot.position);
    if (spec.body === Body.Saturn) this.addSaturnRings(spin, spec.visualRadius);

    pivot.add(this.createLabel(
      spec.name,
      new THREE.Vector3(0, spec.visualRadius * 2.1, 0),
      "#e7f0ff",
      Math.max(0.2, spec.visualRadius * 1.4)
    ));
  }

  // Güneş shader uTime güncelleme (animate döngüsünde çağrılır)
  updateSunTime(t: number): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isSun) {
        const mat = obj.material as THREE.ShaderMaterial;
        if (mat.uniforms?.uTime) mat.uniforms.uTime.value = t;
      }
    });
  }

  private createOrbit(radius: number): THREE.Line {
    const orbit = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2).getPoints(256);
    const geometry = new THREE.BufferGeometry().setFromPoints(orbit.map((p) => new THREE.Vector3(p.x, 0, p.y)));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: "#3a5585", transparent: true, opacity: 0.28, depthWrite: false
    }));
  }

  private async createPlanetMaterial(spec: PlanetSpec): Promise<THREE.MeshStandardMaterial> {
    const texture = await this.loadTexture(spec.texture);
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: texture ? "#ffffff" : spec.fallbackColor,
      roughness: 0.88,
      metalness: 0
    });
  }

  private async createEarthShaderMaterial(spec: PlanetSpec, position: THREE.Vector3): Promise<THREE.Material> {
    const dayMap = await this.loadTexture(spec.texture);
    const nightMap = this.enableEarthExtras ? await this.loadTexture("earth-night.png") : undefined;
    const material = createEarthMaterial(dayMap ?? this.solidTexture(spec.fallbackColor), nightMap);
    const sunDir = new THREE.Vector3(0, 0, 0).sub(position).normalize();
    if (material instanceof THREE.ShaderMaterial) {
      material.uniforms.uSunDirection.value.copy(sunDir);
    }
    return material;
  }

  private async decorateEarth(spin: THREE.Group, radius: number, _position: THREE.Vector3): Promise<void> {
    if (!this.enableEarthExtras) return;
    const clouds = await this.loadTexture("earth-clouds.jpg");
    if (clouds) {
      const cloudMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.012, this.geometrySegments, this.geometrySegments),
        new THREE.MeshStandardMaterial({ map: clouds, transparent: true, opacity: 0.35, depthWrite: false })
      );
      spin.add(cloudMesh);
      this.spinningObjects.push({ spin: cloudMesh, speed: 0.035 });
    }
    spin.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.08, 32, 32),
      createAtmosphereMaterial()
    ));
  }

  private addSaturnRings(spin: THREE.Group, radius: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.35, radius * 2.4, this.geometrySegments * 2),
      this.createRingMaterial()
    );
    ring.rotation.x = Math.PI / 2;
    spin.add(ring);
  }

  private createRingMaterial(): THREE.MeshBasicMaterial {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = 16;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0,    "rgba(255,255,255,0)");
    gradient.addColorStop(0.14, "rgba(210,188,140,0.28)");
    gradient.addColorStop(0.28, "rgba(245,220,158,0.72)");
    gradient.addColorStop(0.44, "rgba(60,48,36,0.22)");
    gradient.addColorStop(0.58, "rgba(238,215,162,0.68)");
    gradient.addColorStop(0.78, "rgba(220,198,148,0.48)");
    gradient.addColorStop(1,    "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    return new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0.82,
      side: THREE.DoubleSide, depthWrite: false
    });
  }

  private async loadTexture(file: string): Promise<THREE.Texture | undefined> {
    return new Promise((resolve) => {
      this.textureLoader.load(
        `${TEXTURE_BASE}${file}`,
        (texture) => resolve(this.optimizeTexture(texture)),
        undefined,
        () => resolve(undefined)
      );
    });
  }

  private distanceFromEarthAu(body: Body): number {
    if (body === Body.Earth) return 0;
    const date = this.observation.utcDate;
    const planet = HelioVector(body, date);
    const earth = HelioVector(Body.Earth, date);
    const dx = planet.x - earth.x;
    const dy = planet.y - earth.y;
    const dz = planet.z - earth.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private optimizeTexture(texture: THREE.Texture): THREE.Texture {
    const image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!image) return texture;
    const maxWidth = this.quality.name === "low" ? 512 : this.quality.name === "medium" ? 1024 : 2048;
    const srcW = image.width;
    if (!srcW || srcW <= maxWidth) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.quality.name === "high" ? 4 : 1;
      return texture;
    }
    const scale = maxWidth / srcW;
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.dispose();
    const opt = new THREE.CanvasTexture(canvas);
    opt.colorSpace = THREE.SRGBColorSpace;
    opt.generateMipmaps = this.quality.name !== "low";
    opt.minFilter = this.quality.name === "low" ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    opt.anisotropy = this.quality.name === "high" ? 4 : 1;
    return opt;
  }

  private solidTexture(color: string): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 2; canvas.height = 2;
    canvas.getContext("2d")!.fillStyle = color;
    canvas.getContext("2d")!.fillRect(0, 0, 2, 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createLabel(text: string, position: THREE.Vector3, color: string, scale = 0.34): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 512; canvas.height = 128;
    ctx.fillStyle = color;
    ctx.font = "600 30px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false
    }));
    sprite.position.copy(position);
    sprite.scale.set(scale, scale * 0.25, 1);
    return sprite;
  }
}
