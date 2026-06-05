import * as THREE from "three";

export function createEarthMaterial(dayMap: THREE.Texture, nightMap?: THREE.Texture): THREE.ShaderMaterial | THREE.MeshStandardMaterial {
  if (!nightMap) {
    return new THREE.MeshStandardMaterial({ map: dayMap, roughness: 0.95 });
  }

  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;

      void main() {
        float daylight = smoothstep(-0.12, 0.18, dot(normalize(vWorldNormal), normalize(uSunDirection)));
        vec3 dayColor = texture2D(uDayMap, vUv).rgb;
        vec3 nightColor = texture2D(uNightMap, vUv).rgb * 1.7;
        gl_FragColor = vec4(mix(nightColor, dayColor, daylight), 1.0);
      }
    `
  });
}

export function createAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vNormal;

      void main() {
        float rim = pow(1.0 - abs(vNormal.z), 2.6);
        gl_FragColor = vec4(0.35, 0.62, 1.0, rim * 0.42);
      }
    `
  });
}
