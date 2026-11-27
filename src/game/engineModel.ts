import type { Controls } from './physics';

// Approximate audio gearing, not a homologated drivetrain simulation.
const RATIOS = [4.0, 2.9, 2.15, 1.7, 1.35, 1.1, 0.9, 0.75];
export const REDLINE = 7200;
const IDLE = 850;
// Wheel circumference 1.98 m, final drive 4.1; speed is in metres/second.
const wheelRpm = (speed: number) => Math.abs(speed) * 60 / 1.98 * 4.1;

/** Audio-only automatic transmission; leaves the arcade driving physics intact. */
export class EngineModel {
  rpm = IDLE;
  gear = 0;
  load = 0;
  shiftRemaining = 0;
  boost = 0;
  blowoff = 0;
  shiftPulse = 0;
  private wasAccelerating = false;
  private cooldown = 0;
  private reverse = false;

  update(speed: number, controls: Controls, delta: number) {
    const dt = Math.max(0, Math.min(delta, 0.1));
    const reverse = speed < -0.3;
    const accelerating = reverse
      ? controls.brake && !controls.throttle
      : controls.throttle && !controls.brake;
    this.blowoff *= Math.exp(-dt * 9);
    this.shiftPulse *= Math.exp(-dt * 22);
    if (this.wasAccelerating && !accelerating && this.rpm > 2500) this.blowoff = this.boost;
    this.wasAccelerating = accelerating;
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
      if (coupled > (accelerating ? 6600 : 3800) && this.gear < RATIOS.length - 1) this.gear++;
      else if (coupled < 1800 && this.gear > 0) this.gear--;
      if (this.gear !== previous) {
        this.shiftRemaining = 0.12;
        this.shiftPulse = this.load;
        this.cooldown = 0.65;
      }
    }
    const shifting = this.shiftRemaining > 0;
    const targetLoad = accelerating && !shifting ? 1 : 0;
    this.load += (targetLoad - this.load) * (1 - Math.exp(-dt * 12));
    // Clutch slip lets the engine rise off idle during launch, including reverse.
    const launch = accelerating ? 1500 : IDLE;
    const target = Math.min(REDLINE, Math.max(launch,
      wheelRpm(speed) * (reverse ? 3.2 : RATIOS[this.gear])));
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt * (shifting ? 15 : 8)));
    const targetBoost = accelerating && !shifting
      ? Math.max(0, Math.min(1, (this.rpm - 1600) / 2300)) : 0;
    this.boost += (targetBoost - this.boost) * (1 - Math.exp(-dt * (targetBoost > this.boost ? 3 : 11)));
    return this;
  }
}
