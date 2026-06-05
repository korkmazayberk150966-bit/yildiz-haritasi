import * as THREE from "three";

export function createStarMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
    },
    vertexShader: `
      attribute float magnitude;
      attribute float bv;
      varying float vMagnitude;
      varying float vBv;

      void main() {
        vMagnitude = magnitude;
        vBv = bv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float brightness = clamp((6.8 - magnitude) / 6.8, 0.08, 1.0);
        gl_PointSize = (2.0 + brightness * 7.0) * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vMagnitude;
      varying float vBv;

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
        float dist = length(uv);
        float alpha = smoothstep(0.5, 0.0, dist);
        float brightness = pow(clamp((6.8 - vMagnitude) / 6.8, 0.08, 1.0), 1.4);
        vec3 color = kelvinToRgb(bvToKelvin(vBv));
        gl_FragColor = vec4(color * brightness, alpha * brightness);
      }
    `
  });
}
