import * as THREE from "three";

export interface NebulaConfig {
  center: THREE.Vector3;
  /** Yarı eksen boyutları (scene units) */
  rx: number;
  ry: number;
  rz: number;
  innerColor: THREE.Color;
  outerColor: THREE.Color;
  particleCount: number;
  baseOpacity: number;
  pixelRatio?: number;
}

// Basit hash tabanlı pseudo-Perlin (shader'da gerçek noise pahalı olur)
function hash(n: number): number {
  const x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Bir nebulayı 3B hacimsel parçacık bulutu olarak oluşturur.
 * Kamera içinden/etrafından geçince derinlik hissedilir.
 */
export function createVolumetricNebula(cfg: NebulaConfig): THREE.Points {
  const { center, rx, ry, rz, innerColor, outerColor, particleCount, baseOpacity } = cfg;
  const pr = cfg.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const aSizes = new Float32Array(particleCount);
  const aOpacities = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    // Üstel yoğunlaşma: merkeze doğru parçacık yoğunluğu artar
    const r = Math.pow(Math.random(), 0.42);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    // Organik dağılım: hash tabanlı ince gürültü
    const noiseScale = 0.28 * r;
    const nx = (hash(i * 1.3 + 0.1) - 0.5) * noiseScale;
    const ny = (hash(i * 2.7 + 0.5) - 0.5) * noiseScale * 0.5;
    const nz = (hash(i * 3.9 + 0.9) - 0.5) * noiseScale;

    positions[i * 3]     = center.x + (r * rx * Math.sin(phi) * Math.cos(theta) + nx * rx);
    positions[i * 3 + 1] = center.y + (r * ry * Math.cos(phi) * 0.55 + ny * ry);
    positions[i * 3 + 2] = center.z + (r * rz * Math.sin(phi) * Math.sin(theta) + nz * rz);

    // Renk: iç → dış gradyan + hafif varyasyon
    const t = r * r; // dışa doğru daha hızlı geçiş
    const c = innerColor.clone().lerp(outerColor, t);
    // Hafif renk varyasyonu: her parçacık tam aynı olmasın
    c.r = Math.min(1, c.r + (Math.random() - 0.5) * 0.12);
    c.g = Math.min(1, c.g + (Math.random() - 0.5) * 0.08);
    c.b = Math.min(1, c.b + (Math.random() - 0.5) * 0.10);
    colors[i * 3]     = Math.max(0, c.r);
    colors[i * 3 + 1] = Math.max(0, c.g);
    colors[i * 3 + 2] = Math.max(0, c.b);

    // Boyut: merkeze yakın büyük ve yoğun, dışta küçük ve seyrek
    aSizes[i] = 0.7 + Math.random() * 2.2 + (1 - r) * 1.4;

    // Opaklık: üstel düşüş + rastgele varyasyon
    const falloff = Math.pow(1 - r, 0.7);
    aOpacities[i] = Math.min(1, baseOpacity * falloff * (0.45 + Math.random() * 1.1));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(aSizes, 1));
  geo.setAttribute("aOpacity", new THREE.BufferAttribute(aOpacities, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uPixelRatio: { value: pr }
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        vColor = color;
        vOpacity = aOpacity;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        // Yakın → büyük, uzak → küçük ama en küçük 2px
        float dist = max(0.1, -mvPos.z);
        gl_PointSize = clamp(aSize * uPixelRatio * 220.0 / dist, 2.0, 48.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        // Yumuşak Gaussian düşüş — nebula bulutu hissi
        float alpha = exp(-d * d * 8.0) * vOpacity;
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  });

  return new THREE.Points(geo, mat);
}

/**
 * Birden fazla nebula konfigürasyonunu gökyüzü koordinat sistemiyle dönüştürür.
 */
export interface SkyNebulaSpec {
  position: THREE.Vector3; // gökyüzü alanında 3B konum
  angularSizeDeg: number;
  key: string;
}

// Nebula renk paletleri — gerçek astronomik renklere yakın
const NEBULA_PALETTES: Record<string, [string, string]> = {
  orion:  ["#ff4d7a", "#3d7dff"],  // H-alpha pembe + OIII mavi
  crab:   ["#ff3030", "#ffcc00"],  // synchrotron kırmızı + filament sarı
  eagle:  ["#18d080", "#8820ff"],  // teal + derin mor
  carina: ["#ff6020", "#20a0ff"],  // WR yıldızları turuncu + iyonize mavi
  lagoon: ["#ff80a0", "#40c8ff"],  // H-alpha + mavi sürekli
  default: ["#9060ff", "#20d0c8"], // genel mor-teal
};

export function getNebulaColors(key: string): [THREE.Color, THREE.Color] {
  const palette = NEBULA_PALETTES[key] ?? NEBULA_PALETTES.default;
  return [new THREE.Color(palette[0]), new THREE.Color(palette[1])];
}
