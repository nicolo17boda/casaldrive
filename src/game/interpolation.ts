import type { VehicleState } from './physics';

export interface Pose { x: number; z: number; yaw: number }
export const FIXED_STEP = 1 / 120;
/** Render between physics ticks instead of repeating the last discrete position. */
export class MotionInterpolator {
  private previous: Pose;
  private current: Pose;
  private accumulator = 0;
  readonly pose: Pose;
  constructor(state: Pose) {
    this.previous = { ...state };
    this.current = { ...state };
    this.pose = { ...state };
  }
  advance(state: VehicleState, delta: number, paused: boolean, step: () => void) {
    // Reset/teleport is external to the physics loop: never interpolate across it.
    if (state.x !== this.current.x || state.z !== this.current.z || state.yaw !== this.current.yaw) {
      Object.assign(this.previous, state);
      Object.assign(this.current, state);
      Object.assign(this.pose, state);
      this.accumulator = 0;
    }
    if (paused) return this.pose;
    this.accumulator += Math.min(Math.max(delta, 0), 0.1);
    while (this.accumulator >= FIXED_STEP) {
      Object.assign(this.previous, this.current);
      step();
      Object.assign(this.current, state);
      this.accumulator -= FIXED_STEP;
    }
    const alpha = this.accumulator / FIXED_STEP;
    this.pose.x = this.previous.x + (this.current.x - this.previous.x) * alpha;
    this.pose.z = this.previous.z + (this.current.z - this.previous.z) * alpha;
    // Heading stays unwrapped in physics, so interpolation also works through 2π.
    this.pose.yaw = this.previous.yaw + (this.current.yaw - this.previous.yaw) * alpha;
    return this.pose;
  }
}
