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
        float brightness = clamp((6.8 - magnitude) / 6.8, 0.08, 1.0);
        float twinkle = uTwinkle == 1 ? 0.9 + 0.1 * sin(uTime * 2.4 + position.x * 0.037 + position.y * 0.021) : 1.0;
        vTwinkle = twinkle;
        float attenuated = 190.0 / max(150.0, -mvPosition.z);
        float rawSize = (0.85 + brightness * 2.55) * uPixelRatio * uSizeScale * attenuated;
        gl_PointSize = clamp(rawSize, 0.75, 5.5 * uPixelRatio);
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
        float core = smoothstep(0.5, 0.08, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.25;
        float alpha = clamp(core + halo, 0.0, 1.0);
        float brightness = pow(clamp((6.8 - vMagnitude) / 6.8, 0.08, 1.0), 1.4) * vTwinkle;
        vec3 color = kelvinToRgb(bvToKelvin(vBv));
        gl_FragColor = vec4(color * brightness, alpha * brightness * uOpacity);
      }
    `
  });
}
