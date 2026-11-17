import type { Controls } from './physics';

const RATIOS = [3.4, 2.15, 1.48, 1.1, 0.86];
const IDLE = 850;
// Wheel circumference 1.98 m, final drive 4.1; speed is in metres/second.
const wheelRpm = (speed: number) => Math.abs(speed) * 60 / 1.98 * 4.1;

/** Audio-only automatic transmission; leaves the arcade driving physics intact. */
export class EngineModel {
  rpm = IDLE;
  gear = 0;
  load = 0;
  shiftRemaining = 0;
  private cooldown = 0;
  private reverse = false;

  update(speed: number, controls: Controls, delta: number) {
    const dt = Math.max(0, Math.min(delta, 0.1));
    const reverse = speed < -0.3;
    const accelerating = reverse
      ? controls.brake && !controls.throttle
      : controls.throttle && !controls.brake;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.shiftRemaining = Math.max(0, this.shiftRemaining - dt);
    if (Math.abs(speed) < 0.5 || reverse !== this.reverse) {
      this.gear = 0;
      this.shiftRemaining = 0;
      this.cooldown = 0;
    }
    this.reverse = reverse;
    const coupled = wheelRpm(speed) * RATIOS[this.gear];
    if (!reverse && this.cooldown === 0) {
      const previous = this.gear;
      if (coupled > 4400 && this.gear < RATIOS.length - 1) this.gear++;
      else if (coupled < 1700 && this.gear > 0) this.gear--;
      if (this.gear !== previous) {
        this.shiftRemaining = 0.22;
        this.cooldown = 0.65;
      }
    }
    const shifting = this.shiftRemaining > 0;
    const targetLoad = accelerating && !shifting ? 1 : 0;
    this.load += (targetLoad - this.load) * (1 - Math.exp(-dt * 12));
    // Clutch slip lets the engine rise off idle during launch, including reverse.
    const launch = accelerating ? 1500 : IDLE;
    const target = Math.min(6200, Math.max(launch,
      wheelRpm(speed) * (reverse ? 3.2 : RATIOS[this.gear])));
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt * (shifting ? 15 : 8)));
    return this;
  }
}
