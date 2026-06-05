import * as THREE from "three";

export function createRoundPointMaterial(options: { opacity?: number; maxPointSize?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uOpacity: { value: options.opacity ?? 1 },
      uMaxPointSize: { value: options.maxPointSize ?? 6 }
    },
    vertexShader: `
      uniform float uPixelRatio;
      uniform float uMaxPointSize;
      attribute float pointSize;
      attribute float intensity;
      varying vec3 vColor;
      varying float vIntensity;

      void main() {
        vColor = color;
        vIntensity = intensity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float attenuation = 260.0 / max(90.0, -mvPosition.z);
        gl_PointSize = clamp(pointSize * attenuation * uPixelRatio, 0.8, uMaxPointSize * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vIntensity;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.12, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.16;
        float alpha = clamp(core + halo, 0.0, 1.0) * vIntensity * uOpacity;
        gl_FragColor = vec4(vColor * vIntensity, alpha);
      }
    `
  });
}
