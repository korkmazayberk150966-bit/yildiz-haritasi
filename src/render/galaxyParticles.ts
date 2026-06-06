import * as THREE from "three";

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface GalaxySpec {
  center: THREE.Vector3;
  /** Euler açıları (oryantasyon) */
  rotation: THREE.Euler;
  radius: number;
  thickness: number;
  armCount: 2 | 4;
  armBend: number;        // spiral sıkılığı (1 = gevşek, 3 = sıkı)
  particleCount: number;
  innerColor: THREE.Color;
  midColor: THREE.Color;
  outerColor: THREE.Color;
  /** Parçacık boyut çarpanı (uzak galaksiler için < 1) */
  sizeScale: number;
  /** Opaklık çarpanı */
  opacityScale: number;
}

export interface GalaxyParticleArrays {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  opacities: Float32Array;
  count: number;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

/** Box-Muller Gaussian örnekleyici */
function gaussian(mean = 0, std = 1): number {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Ana Galaksi Oluşturucu ───────────────────────────────────────────────────

/**
 * Logaritmik spiral kollu 3B galaksi parçacıklarını HAM DIZI olarak döndürür.
 * Çağıran kod bunları büyük BufferGeometry'ye merge edebilir (tek draw call).
 */
export function buildSpiralGalaxyArrays(spec: GalaxySpec): GalaxyParticleArrays {
  const { center, radius, thickness, armCount, armBend,
          particleCount, innerColor, midColor, outerColor,
          sizeScale, opacityScale } = spec;

  const rot = new THREE.Matrix4().makeRotationFromEuler(spec.rotation);

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const opacities = new Float32Array(particleCount);

  // Parçacık bütçesi dağılımı
  const coreCount = Math.floor(particleCount * 0.22);
  const armCount_n = Math.floor(particleCount * 0.64);
  const diskCount = particleCount - coreCount - armCount_n;

  const tmp = new THREE.Vector3();
  let offset = 0;

  // 1. ÇEKİRDEK (bulge) — sıcak sarı-turuncu
  for (let i = 0; i < coreCount; i++) {
    const r = Math.pow(Math.random(), 2.8) * radius * 0.22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    tmp.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.52,
      r * Math.sin(phi) * Math.sin(theta)
    );
    applyRotAndCenter(tmp, rot, center, positions, offset);

    // Renk: saf iç renk + hafif varyasyon
    const fade = Math.pow(r / (radius * 0.22), 0.5);
    lerpColor(innerColor, midColor, fade * 0.4, colors, offset);

    sizes[offset] = (0.9 + Math.random() * 1.8) * sizeScale;
    opacities[offset] = opacityScale * (0.55 + (1 - fade) * 0.45);
    offset++;
  }

  // 2. SPİRAL KOLLAR
  const armParticlesEach = Math.floor(armCount_n / armCount);
  for (let a = 0; a < armCount; a++) {
    const baseAngle = (a / armCount) * Math.PI * 2;

    for (let j = 0; j < armParticlesEach; j++) {
      const t = Math.pow(Math.random(), 0.7); // uçlara doğru seyrekleşir
      const r = radius * (0.12 + t * 0.88);

      // Logaritmik spiral: angle artar t ile
      const spiralAngle = baseAngle + armBend * Math.log(1 + t * 2.5);
      const spreadSigma = radius * 0.055 * (0.5 + t * 1.5);

      const localX = r * Math.cos(spiralAngle) + gaussian(0, spreadSigma);
      const localZ = r * Math.sin(spiralAngle) + gaussian(0, spreadSigma);
      // Disk inceliyor dışa doğru
      const localY = gaussian(0, thickness * Math.exp(-r / (radius * 0.55)));

      tmp.set(localX, localY, localZ);
      applyRotAndCenter(tmp, rot, center, positions, offset);

      // Renk: iç kol sıcak, dış kol soğuk
      const colorT = r / radius;
      lerpColor3(innerColor, midColor, outerColor, colorT, colors, offset);

      sizes[offset] = (0.5 + Math.random() * 1.4 + (1 - t) * 0.8) * sizeScale;
      opacities[offset] = opacityScale * (0.18 + (1 - t) * 0.52) * (0.6 + Math.random() * 0.8);
      offset++;
    }
  }

  // 3. DAĞINIK DİSK (arka plan)
  for (let i = 0; i < diskCount; i++) {
    const r = Math.sqrt(Math.random()) * radius;
    const theta = Math.random() * Math.PI * 2;
    tmp.set(
      r * Math.cos(theta) + gaussian(0, radius * 0.04),
      gaussian(0, thickness * 0.3 * Math.exp(-r / (radius * 0.7))),
      r * Math.sin(theta) + gaussian(0, radius * 0.04)
    );
    applyRotAndCenter(tmp, rot, center, positions, offset);

    lerpColor3(innerColor, midColor, outerColor, r / radius, colors, offset);

    sizes[offset] = (0.3 + Math.random() * 0.7) * sizeScale;
    opacities[offset] = opacityScale * 0.12 * Math.random();
    offset++;
  }

  return { positions, colors, sizes, opacities, count: particleCount };
}

/**
 * Basit Gaussian blob — arka plan (uzak) galaksiler için.
 * Çok ucuz: birkaç onlarca parçacık, blob görünümü.
 */
export function buildBlobGalaxyArrays(spec: {
  center: THREE.Vector3;
  radius: number;
  flattening: number;  // y ekseni düzleştirme (0..1)
  color: THREE.Color;
  particleCount: number;
  sizeScale: number;
  opacityScale: number;
}): GalaxyParticleArrays {
  const { center, radius, flattening, color, particleCount, sizeScale, opacityScale } = spec;

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const opacities = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const r = Math.pow(Math.random(), 0.55) * radius;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3]     = center.x + r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = center.y + r * Math.cos(phi) * (1 - flattening);
    positions[i * 3 + 2] = center.z + r * Math.sin(phi) * Math.sin(theta);

    const fade = r / radius;
    colors[i * 3]     = Math.min(1, color.r * (1 + (Math.random() - 0.5) * 0.2));
    colors[i * 3 + 1] = Math.min(1, color.g * (1 + (Math.random() - 0.5) * 0.2));
    colors[i * 3 + 2] = Math.min(1, color.b * (1 + (Math.random() - 0.5) * 0.2));

    sizes[i] = (0.6 + Math.random() * 1.0) * sizeScale;
    opacities[i] = opacityScale * (1 - fade * 0.7) * (0.4 + Math.random() * 0.7);
  }

  return { positions, colors, sizes, opacities, count: particleCount };
}

/**
 * Ham parçacık dizilerini birleştirerek tek THREE.Points nesnesi oluşturur.
 * Tek draw call → yüksek performans.
 */
export function mergeGalaxyArraysToPoints(
  galaxies: GalaxyParticleArrays[],
  pixelRatio = 1
): THREE.Points {
  const total = galaxies.reduce((s, g) => s + g.count, 0);

  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const opacities = new Float32Array(total);

  let offset = 0;
  for (const g of galaxies) {
    positions.set(g.positions.subarray(0, g.count * 3), offset * 3);
    colors.set(g.colors.subarray(0, g.count * 3), offset * 3);
    sizes.set(g.sizes.subarray(0, g.count), offset);
    opacities.set(g.opacities.subarray(0, g.count), offset);
    offset += g.count;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));

  return new THREE.Points(geo, createGalaxyMaterial(pixelRatio));
}

export function createGalaxyMaterial(pixelRatio = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexColors: true,
    uniforms: {
      uPixelRatio: { value: pixelRatio }
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
        float dist = max(0.1, -mvPos.z);
        gl_PointSize = clamp(aSize * uPixelRatio * 230.0 / dist, 1.0, 48.0);
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
        // Keskin çekirdek + yumuşak halo
        float core = smoothstep(0.5, 0.04, d);
        float halo = exp(-d * d * 7.5) * 0.18;
        float alpha = clamp(core + halo, 0.0, 1.0) * vOpacity;
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  });
}

// ─── Dahili Yardımcılar ───────────────────────────────────────────────────────

function applyRotAndCenter(
  v: THREE.Vector3,
  rot: THREE.Matrix4,
  center: THREE.Vector3,
  out: Float32Array,
  i: number
): void {
  v.applyMatrix4(rot);
  out[i * 3]     = v.x + center.x;
  out[i * 3 + 1] = v.y + center.y;
  out[i * 3 + 2] = v.z + center.z;
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number, out: Float32Array, i: number): void {
  out[i * 3]     = a.r + (b.r - a.r) * t;
  out[i * 3 + 1] = a.g + (b.g - a.g) * t;
  out[i * 3 + 2] = a.b + (b.b - a.b) * t;
}

function lerpColor3(
  a: THREE.Color, b: THREE.Color, c: THREE.Color,
  t: number, out: Float32Array, i: number
): void {
  const t2 = Math.min(t * 2, 1);
  if (t < 0.5) {
    lerpColor(a, b, t2, out, i);
  } else {
    lerpColor(b, c, t2 - 1, out, i);
  }
  // Hafif rastgele ton varyasyonu
  out[i * 3]     = Math.min(1, Math.max(0, out[i * 3]     + (Math.random() - 0.5) * 0.08));
  out[i * 3 + 1] = Math.min(1, Math.max(0, out[i * 3 + 1] + (Math.random() - 0.5) * 0.06));
  out[i * 3 + 2] = Math.min(1, Math.max(0, out[i * 3 + 2] + (Math.random() - 0.5) * 0.07));
}
