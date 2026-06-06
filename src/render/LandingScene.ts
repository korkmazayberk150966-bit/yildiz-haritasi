import * as THREE from "three";

import type { QualityProfile } from "../types";
import { createRoundPointMaterial } from "./roundPointMaterial";

export class LandingScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.01, 900);
  private renderer: THREE.WebGLRenderer;
  private frame = 0;
  private start = performance.now();
  private pointer = new THREE.Vector2();
  private dust?: THREE.Points;
  private stars?: THREE.Points;
  private core?: THREE.Mesh;

  constructor(private container: HTMLElement, private quality: QualityProfile) {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: quality.antialias,
      powerPreference: "high-performance"
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = quality.name === "high" ? 0.86 : 0.72;
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.container.appendChild(this.renderer.domElement);
    this.camera.position.set(0.2, 0.12, 4.6);
    this.build();
    this.bind();
    this.resize();
    this.animate();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  private build(): void {
    this.scene.add(new THREE.AmbientLight("#5f7fb8", 0.18));
    this.scene.add(this.createStarDrift());
    this.scene.add(this.createDustRibbon());
    this.scene.add(this.createGalacticCore());
    if (this.quality.cinematicEffects !== "off") {
      this.scene.add(this.createForegroundNebula("#2f6dff", new THREE.Vector3(-2.6, 0.35, -0.9)));
      this.scene.add(this.createForegroundNebula("#ff8b48", new THREE.Vector3(2.2, -0.5, -1.4)));
    }
  }

  private bind(): void {
    this.container.addEventListener("pointermove", (event) => {
      const rect = this.container.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2,
        ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2
      );
    }, { passive: true });
    window.addEventListener("resize", this.resize);
  }

  private resize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  };

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    const t = (performance.now() - this.start) / 1000;
    const fly = t * 0.035;
    this.camera.position.x = Math.sin(fly * 0.9) * 0.32 + this.pointer.x * 0.05;
    this.camera.position.y = 0.12 + Math.cos(fly * 0.7) * 0.16 - this.pointer.y * 0.04;
    this.camera.position.z = 4.4 + Math.sin(fly * 0.55) * 0.35;
    this.camera.lookAt(Math.sin(fly) * 0.25, Math.cos(fly * 0.8) * 0.08, -2.4);
    if (this.stars) this.stars.rotation.y += 0.00022;
    if (this.dust) {
      this.dust.rotation.y -= 0.00016;
      this.dust.rotation.z = Math.sin(t * 0.08) * 0.025;
    }
    if (this.core) this.core.scale.setScalar(1 + Math.sin(t * 0.4) * 0.035);
    this.renderer.render(this.scene, this.camera);
  };

  private createStarDrift(): THREE.Points {
    const count = this.quality.name === "low" ? 1200 : this.quality.name === "medium" ? 2400 : 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const intensities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 9;
      positions.set([Math.cos(theta) * r, y, Math.sin(theta) * r - 30], i * 3);
      const cool = 0.72 + Math.random() * 0.28;
      colors.set([0.62 * cool, 0.76 * cool, cool], i * 3);
      sizes[i] = 0.7 + Math.random() * 1.8;
      intensities[i] = 0.28 + Math.random() * 0.7;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    this.stars = new THREE.Points(geometry, createRoundPointMaterial({ opacity: 0.62, maxPointSize: 3.2 }));
    return this.stars;
  }

  private createDustRibbon(): THREE.Points {
    const count = this.quality.name === "low" ? 900 : this.quality.name === "medium" ? 1800 : 3200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const intensities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 18;
      const z = -7 - Math.random() * 20;
      const y = Math.sin(x * 0.7) * 0.55 + (Math.random() - 0.5) * 0.9;
      positions.set([x, y, z], i * 3);
      const warm = 0.55 + Math.random() * 0.35;
      colors.set([0.9 * warm, 0.48 * warm, 0.26 * warm], i * 3);
      sizes[i] = 1.4 + Math.random() * 4.2;
      intensities[i] = 0.06 + Math.random() * 0.16;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    this.dust = new THREE.Points(geometry, createRoundPointMaterial({ opacity: 0.55, maxPointSize: 9 }));
    return this.dust;
  }

  private createGalacticCore(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - vec2(0.5));
          float core = smoothstep(0.46, 0.0, d);
          vec3 color = mix(vec3(0.18, 0.32, 0.72), vec3(1.0, 0.66, 0.32), core);
          gl_FragColor = vec4(color, core * 0.48);
        }
      `
    });
    this.core = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), material);
    this.core.position.set(0, 0.1, -12);
    return this.core;
  }

  private createForegroundNebula(color: string, position: THREE.Vector3): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: this.quality.name === "high" ? 0.08 : 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), material);
    mesh.position.copy(position);
    mesh.scale.set(1.6, 0.7, 1.0);
    return mesh;
  }
}
