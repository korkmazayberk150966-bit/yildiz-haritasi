import * as THREE from "three";

export interface FlightHudState {
  speed: number;
  regionName: string;
  centerBearingDeg: number;
  hintVisible: boolean;
}

export interface FlightControlsElements {
  hud?: HTMLElement;
  region?: HTMLElement;
  speed?: HTMLElement;
  centerArrow?: HTMLElement;
  hint?: HTMLElement;
  mobileControls?: HTMLElement;
  joystick?: HTMLElement;
  lookPad?: HTMLElement;
  upButton?: HTMLElement;
  downButton?: HTMLElement;
  boostButton?: HTMLElement;
}

export const SUN_START = new THREE.Vector3(0, 0, 0);
export const GALACTIC_CENTER = new THREE.Vector3(0, 0, -90);

const BASE_SPEED = 1.35;
const BOOST_MULTIPLIER = 7.5;
const ACCELERATION = 5.8;
const DAMPING = 5.6;
const LOOK_SENSITIVITY = 0.0032;
const TOUCH_LOOK_SENSITIVITY = 0.0048;

export function clampPitch(value: number): number {
  return THREE.MathUtils.clamp(value, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
}

export function movementInputFromKeys(keys: ReadonlySet<string>): THREE.Vector3 {
  const input = new THREE.Vector3();
  if (keys.has("keyw") || keys.has("arrowup")) input.z -= 1;
  if (keys.has("keys") || keys.has("arrowdown")) input.z += 1;
  if (keys.has("keya") || keys.has("arrowleft")) input.x -= 1;
  if (keys.has("keyd") || keys.has("arrowright")) input.x += 1;
  if (keys.has("keyq")) input.y += 1;
  if (keys.has("keye")) input.y -= 1;
  return input.lengthSq() > 1 ? input.normalize() : input;
}

export function computeAdaptiveMaxSpeed(boost: boolean, nearbyDistance: number): number {
  const proximityFactor = nearbyDistance < 1.4 ? 0.28 : nearbyDistance < 3.4 ? 0.55 : 1;
  return BASE_SPEED * proximityFactor * (boost ? BOOST_MULTIPLIER : 1);
}

export class MilkyWayFlightController {
  private enabled = false;
  private keys = new Set<string>();
  private velocity = new THREE.Vector3();
  private yaw = 0;
  private pitch = -0.08;
  private nearbyDistance = Infinity;
  private draggingLook = false;
  private lookPointerId?: number;
  private lastLook = new THREE.Vector2();
  private joystickPointerId?: number;
  private joystickOrigin = new THREE.Vector2();
  private mobileMove = new THREE.Vector2();
  private mobileVertical = 0;
  private mobileBoost = false;
  private hintTimer = 5.5;
  private readonly removeListeners: Array<() => void> = [];

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private elements: FlightControlsElements = {}
  ) {
    this.camera.rotation.order = "YXZ";
    this.bindKeyboard();
    this.bindCanvasLook();
    this.bindMobileControls();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.elements.hud?.toggleAttribute("hidden", !enabled);
    this.elements.mobileControls?.toggleAttribute("hidden", !enabled);
    if (enabled) {
      this.camera.position.copy(SUN_START).add(new THREE.Vector3(0.08, 0.02, 0.18));
      this.yaw = 0;
      this.pitch = -0.08;
      this.velocity.set(0, 0, -0.12);
      this.hintTimer = 5.5;
      this.applyLook();
    } else {
      this.keys.clear();
      this.mobileMove.set(0, 0);
      this.mobileVertical = 0;
      this.mobileBoost = false;
      this.draggingLook = false;
      this.joystickPointerId = undefined;
      this.lookPointerId = undefined;
    }
  }

  setNearbyDistance(distance: number): void {
    this.nearbyDistance = distance;
  }

  dispose(): void {
    for (const remove of this.removeListeners.splice(0)) remove();
  }

  update(deltaSeconds: number): FlightHudState {
    if (!this.enabled) {
      return { speed: 0, regionName: "Güneş Çevresi", centerBearingDeg: 0, hintVisible: false };
    }
    this.hintTimer = Math.max(0, this.hintTimer - deltaSeconds);

    const keyInput = movementInputFromKeys(this.keys);
    const mobileInput = new THREE.Vector3(this.mobileMove.x, this.mobileVertical, this.mobileMove.y);
    const input = keyInput.add(mobileInput);
    if (input.lengthSq() > 1) input.normalize();

    const boost = this.mobileBoost || this.keys.has("shiftleft") || this.keys.has("shiftright");
    const maxSpeed = computeAdaptiveMaxSpeed(boost, this.nearbyDistance);
    const desired = this.localInputToWorld(input).multiplyScalar(maxSpeed);
    const blend = 1 - Math.exp(-ACCELERATION * deltaSeconds);
    this.velocity.lerp(desired, blend);
    if (input.lengthSq() < 0.0001) {
      this.velocity.multiplyScalar(Math.exp(-DAMPING * deltaSeconds));
    }
    this.camera.position.addScaledVector(this.velocity, deltaSeconds);
    this.applyLook();

    const state = {
      speed: this.velocity.length(),
      regionName: this.regionName(),
      centerBearingDeg: this.centerBearingDeg(),
      hintVisible: this.hintTimer > 0
    };
    this.updateHud(state);
    return state;
  }

  private localInputToWorld(input: THREE.Vector3): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3()
      .addScaledVector(right, input.x)
      .addScaledVector(up, input.y)
      .addScaledVector(forward, -input.z);
  }

  private applyLook(): void {
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }

  private regionName(): string {
    const distanceFromSun = this.camera.position.distanceTo(SUN_START);
    if (distanceFromSun < 4) return "Güneş Çevresi";
    if (this.camera.position.z < -22) return "Sagittarius Yolu";
    return "Yerel Kol";
  }

  private centerBearingDeg(): number {
    const toCenter = GALACTIC_CENTER.clone().sub(this.camera.position).normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const angle = Math.atan2(toCenter.clone().cross(forward).y, toCenter.dot(forward));
    return THREE.MathUtils.radToDeg(angle);
  }

  private updateHud(state: FlightHudState): void {
    if (this.elements.region) this.elements.region.textContent = state.regionName;
    if (this.elements.speed) this.elements.speed.textContent = `${Math.round(state.speed * 720)} ly/sn`;
    if (this.elements.centerArrow) this.elements.centerArrow.style.transform = `rotate(${state.centerBearingDeg}deg)`;
    if (this.elements.hint) this.elements.hint.hidden = !state.hintVisible;
  }

  private bindKeyboard(): void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!this.enabled) return;
      const code = event.code.toLowerCase();
      if (!isFlightKey(code)) return;
      event.preventDefault();
      this.keys.add(code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.removeListeners.push(() => window.removeEventListener("keydown", onKeyDown));
    this.removeListeners.push(() => window.removeEventListener("keyup", onKeyUp));
  }

  private bindCanvasLook(): void {
    const onPointerDown = (event: PointerEvent) => {
      if (!this.enabled || this.lookPointerId !== undefined) return;
      this.draggingLook = true;
      this.lookPointerId = event.pointerId;
      this.lastLook.set(event.clientX, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!this.enabled || !this.draggingLook || this.lookPointerId !== event.pointerId) return;
      const dx = event.clientX - this.lastLook.x;
      const dy = event.clientY - this.lastLook.y;
      this.yaw -= dx * LOOK_SENSITIVITY;
      this.pitch = clampPitch(this.pitch - dy * LOOK_SENSITIVITY);
      this.lastLook.set(event.clientX, event.clientY);
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (this.lookPointerId !== event.pointerId) return;
      this.draggingLook = false;
      this.lookPointerId = undefined;
    };
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerEnd);
    this.canvas.addEventListener("pointercancel", onPointerEnd);
    this.removeListeners.push(() => this.canvas.removeEventListener("pointerdown", onPointerDown));
    this.removeListeners.push(() => this.canvas.removeEventListener("pointermove", onPointerMove));
    this.removeListeners.push(() => this.canvas.removeEventListener("pointerup", onPointerEnd));
    this.removeListeners.push(() => this.canvas.removeEventListener("pointercancel", onPointerEnd));
  }

  private bindMobileControls(): void {
    this.bindJoystick();
    this.bindLookPad();
    this.bindButton(this.elements.upButton, 1, "vertical");
    this.bindButton(this.elements.downButton, -1, "vertical");
    this.bindButton(this.elements.boostButton, 1, "boost");
  }

  private bindJoystick(): void {
    const joystick = this.elements.joystick;
    if (!joystick) return;
    const onDown = (event: PointerEvent) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      this.joystickOrigin.set(event.clientX, event.clientY);
      joystick.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!this.enabled || this.joystickPointerId !== event.pointerId) return;
      const dx = THREE.MathUtils.clamp((event.clientX - this.joystickOrigin.x) / 54, -1, 1);
      const dy = THREE.MathUtils.clamp((event.clientY - this.joystickOrigin.y) / 54, -1, 1);
      this.mobileMove.set(dx, dy);
      joystick.style.setProperty("--stick-x", `${dx * 24}px`);
      joystick.style.setProperty("--stick-y", `${dy * 24}px`);
    };
    const onEnd = (event: PointerEvent) => {
      if (this.joystickPointerId !== event.pointerId) return;
      this.joystickPointerId = undefined;
      this.mobileMove.set(0, 0);
      joystick.style.setProperty("--stick-x", "0px");
      joystick.style.setProperty("--stick-y", "0px");
    };
    joystick.addEventListener("pointerdown", onDown);
    joystick.addEventListener("pointermove", onMove);
    joystick.addEventListener("pointerup", onEnd);
    joystick.addEventListener("pointercancel", onEnd);
    this.removeListeners.push(() => joystick.removeEventListener("pointerdown", onDown));
    this.removeListeners.push(() => joystick.removeEventListener("pointermove", onMove));
    this.removeListeners.push(() => joystick.removeEventListener("pointerup", onEnd));
    this.removeListeners.push(() => joystick.removeEventListener("pointercancel", onEnd));
  }

  private bindLookPad(): void {
    const lookPad = this.elements.lookPad;
    if (!lookPad) return;
    let pointerId: number | undefined;
    const last = new THREE.Vector2();
    const onDown = (event: PointerEvent) => {
      if (!this.enabled) return;
      event.preventDefault();
      pointerId = event.pointerId;
      last.set(event.clientX, event.clientY);
      lookPad.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!this.enabled || pointerId !== event.pointerId) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      this.yaw -= dx * TOUCH_LOOK_SENSITIVITY;
      this.pitch = clampPitch(this.pitch - dy * TOUCH_LOOK_SENSITIVITY);
      last.set(event.clientX, event.clientY);
    };
    const onEnd = (event: PointerEvent) => {
      if (pointerId === event.pointerId) pointerId = undefined;
    };
    lookPad.addEventListener("pointerdown", onDown);
    lookPad.addEventListener("pointermove", onMove);
    lookPad.addEventListener("pointerup", onEnd);
    lookPad.addEventListener("pointercancel", onEnd);
    this.removeListeners.push(() => lookPad.removeEventListener("pointerdown", onDown));
    this.removeListeners.push(() => lookPad.removeEventListener("pointermove", onMove));
    this.removeListeners.push(() => lookPad.removeEventListener("pointerup", onEnd));
    this.removeListeners.push(() => lookPad.removeEventListener("pointercancel", onEnd));
  }

  private bindButton(element: HTMLElement | undefined, value: number, kind: "vertical" | "boost"): void {
    if (!element) return;
    const onDown = (event: PointerEvent) => {
      if (!this.enabled) return;
      event.preventDefault();
      if (kind === "vertical") this.mobileVertical = value;
      else this.mobileBoost = true;
      element.classList.add("active");
    };
    const onEnd = () => {
      if (kind === "vertical") this.mobileVertical = 0;
      else this.mobileBoost = false;
      element.classList.remove("active");
    };
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
    element.addEventListener("pointerleave", onEnd);
    this.removeListeners.push(() => element.removeEventListener("pointerdown", onDown));
    this.removeListeners.push(() => element.removeEventListener("pointerup", onEnd));
    this.removeListeners.push(() => element.removeEventListener("pointercancel", onEnd));
    this.removeListeners.push(() => element.removeEventListener("pointerleave", onEnd));
  }
}

function isFlightKey(code: string): boolean {
  return [
    "keyw", "keya", "keys", "keyd", "keyq", "keye",
    "arrowup", "arrowdown", "arrowleft", "arrowright",
    "shiftleft", "shiftright"
  ].includes(code);
}
