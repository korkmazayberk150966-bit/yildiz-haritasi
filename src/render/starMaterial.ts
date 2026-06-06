import * as THREE from "three";

interface StarMaterialOptions {
  sizeScale?: number;
  opacity?: number;
  twinkle?: boolean;
}

export function createStarMaterial(options: StarMaterialOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uSizeScale: { value: options.sizeScale ?? 1 },
      uOpacity: { value: options.opacity ?? 1 },
      uTime: { value: 0 },
      uTwinkle: { value: options.twinkle ? 1 : 0 }
    },
    vertexShader: `
      uniform float uPixelRatio;
      uniform float uSizeScale;
      uniform float uTime;
      uniform int uTwinkle;
      attribute float magnitude;
      attribute float bv;
      varying float vMagnitude;
      varying float vBv;
      varying float vTwinkle;

      void main() {
        vMagnitude = magnitude;
        vBv = bv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

        // Gerçek kadir ölçeğine göre parlaklık: mag 7.0'a kadar görünür
        float brightness = clamp((7.0 - magnitude) / 7.0, 0.05, 1.0);

        // Çok parlak yıldızlar (mag < 1) ekstra büyük
        float starClass = smoothstep(1.0, -1.5, magnitude);

        // Doğal twinkle: yavaş, nefes alır gibi
        float twinkle = 1.0;
        if (uTwinkle == 1) {
          float t = uTime;
          float phase = position.x * 0.041 + position.y * 0.027 + position.z * 0.019;
          twinkle = 0.88 + 0.12 * sin(t * 1.8 + phase)
                        * (0.7 + 0.3 * sin(t * 0.7 + phase * 2.1));
        }
        vTwinkle = twinkle;

        float attenuated = 200.0 / max(150.0, -mvPosition.z);
        // Boyut: sönük yıldızlar ince nokta, parlak yıldızlar belirgin
        float rawSize = (0.7 + brightness * 3.8 + starClass * 2.2) * uPixelRatio * uSizeScale * attenuated;
        gl_PointSize = clamp(rawSize, 0.5, 9.0 * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uOpacity;
      varying float vMagnitude;
      varying float vBv;
      varying float vTwinkle;

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      float bvToKelvin(float bv) {
        float safeBv = clamp(bv, -0.4, 2.0);
        return 4600.0 * ((1.0 / (0.92 * safeBv + 1.7)) + (1.0 / (0.92 * safeBv + 0.62)));
      }

      vec3 kelvinToRgb(float kelvin) {
        float temp = clamp(kelvin, 1000.0, 40000.0) / 100.0;
        float red;
        float green;
        float blue;

        if (temp <= 66.0) {
          red = 255.0;
          green = 99.4708025861 * log(temp) - 161.1195681661;
        } else {
          red = 329.698727446 * pow(temp - 60.0, -0.1332047592);
          green = 288.1221695283 * pow(temp - 60.0, -0.0755148492);
        }

        if (temp >= 66.0) {
          blue = 255.0;
        } else if (temp <= 19.0) {
          blue = 0.0;
        } else {
          blue = 138.5177312231 * log(temp - 10.0) - 305.0447927307;
        }

        return vec3(clamp01(red / 255.0), clamp01(green / 255.0), clamp01(blue / 255.0));
      }

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        // Keskin çekirdek + geniş yumuşak halo
        float core = smoothstep(0.5, 0.03, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.42;
        // Parlak yıldızlar için ekstra geniş halka
        float brightHalo = smoothstep(0.48, 0.0, d) * 0.18 * smoothstep(2.5, -1.5, vMagnitude);
        float alpha = clamp(core + halo + brightHalo, 0.0, 1.0);

        float brightness = pow(clamp((7.0 - vMagnitude) / 7.0, 0.05, 1.0), 1.2) * vTwinkle;
        vec3 color = kelvinToRgb(bvToKelvin(vBv));

        // Hafif beyazlaştırma: çok sıcak/soğuk uçlarda renk daha saf
        color = mix(color, vec3(1.0), 0.08);

        gl_FragColor = vec4(color * brightness, alpha * brightness * uOpacity);
      }
    `
  });
}
