import * as THREE from "three";

import { DEG2RAD } from "../astro/math";
import type { ResolvedLocation } from "../types";

export function createDeepSkyMaterial(texture: THREE.Texture, location: ResolvedLocation, lstDegrees: number): THREE.ShaderMaterial {
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uMap: { value: texture },
      uLatitude: { value: location.latitude * DEG2RAD },
      uLst: { value: lstDegrees * DEG2RAD },
      uOpacity: { value: 0.78 }
    },
    vertexShader: `
      varying vec3 vDir;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = normalize(world.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uLatitude;
      uniform float uLst;
      uniform float uOpacity;
      varying vec3 vDir;
      const float PI = 3.141592653589793;

      void main() {
        vec3 dir = normalize(vDir);
        float alt = asin(clamp(dir.y, -1.0, 1.0));
        float az = atan(dir.x, dir.z);
        float sinAlt = sin(alt);
        float cosAlt = cos(alt);
        float sinLat = sin(uLatitude);
        float cosLat = cos(uLatitude);
        float dec = asin(clamp(sinAlt * sinLat + cosAlt * cosLat * cos(az), -1.0, 1.0));
        float h = atan(-sin(az) * cosAlt, sinAlt * cosLat - cosAlt * sinLat * cos(az));
        float ra = mod(uLst - h + 2.0 * PI, 2.0 * PI);
        float u = 1.0 - ra / (2.0 * PI);
        float v = 0.5 - dec / PI;
        vec3 color = texture2D(uMap, vec2(u, v)).rgb;
        float horizonFade = smoothstep(-0.08, 0.08, dir.y);
        gl_FragColor = vec4(color * uOpacity * horizonFade, 1.0);
      }
    `
  });
}

export function createAtlasBillboardMaterial(texture: THREE.Texture, columns: number, rows: number): THREE.ShaderMaterial {
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: texture },
      uColumns: { value: columns },
      uRows: { value: rows },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float atlasIndex;
      attribute float pointSize;
      attribute float intensity;
      varying float vAtlasIndex;
      varying float vIntensity;

      void main() {
        vAtlasIndex = atlasIndex;
        vIntensity = intensity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float attenuation = 360.0 / max(90.0, -mvPosition.z);
        gl_PointSize = clamp(pointSize * attenuation * uPixelRatio, 1.2, 70.0 * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uColumns;
      uniform float uRows;
      varying float vAtlasIndex;
      varying float vIntensity;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float d = length(centered);
        if (d > 0.5) discard;
        float col = mod(vAtlasIndex, uColumns);
        float row = floor(vAtlasIndex / uColumns);
        vec2 tileUv = (vec2(col, row) + gl_PointCoord) / vec2(uColumns, uRows);
        vec4 texel = texture2D(uMap, tileUv);
        float edge = smoothstep(0.5, 0.34, d);
        gl_FragColor = vec4(texel.rgb * vIntensity, texel.a * edge * vIntensity);
      }
    `
  });
}
