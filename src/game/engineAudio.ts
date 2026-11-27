import { EngineModel } from './engineModel';
import type { Controls } from './physics';

/** Continuous combustion harmonics + filtered intake noise, generated locally. */
export class EngineAudio {
  readonly model = new EngineModel();
  private context: AudioContext | null = null;
  private master?: GainNode;
  private exhaust?: OscillatorNode;
  private mechanical?: OscillatorNode;
  private exhaustGain?: GainNode;
  private mechanicalGain?: GainNode;
  private intakeGain?: GainNode;
  private filter?: BiquadFilterNode;
  private turbo?: OscillatorNode;
  private turboGain?: GainNode;
  private blowoffGain?: GainNode;
  private shiftGain?: GainNode;
  private intakeFilter?: BiquadFilterNode;
  private revMatchGain?: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private active = false;
  private volume = 0.65;
  private disposed = false;

  /** Called directly inside a user gesture, for browser autoplay policies. */
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) this.create();
      if (this.context?.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional: unavailable devices/APIs must not stop driving.
      this.release();
    }
  }

  private create() {
    const ctx = new AudioContext();
    this.context = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    this.master = master;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.12;
    master.connect(compressor).connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    filter.Q.value = 0.7;
    const exhaustBody = ctx.createBiquadFilter();
    exhaustBody.type = 'peaking'; exhaustBody.frequency.value = 160;
    exhaustBody.Q.value = 0.8; exhaustBody.gain.value = 5;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass'; highpass.frequency.value = 35;
    filter.connect(exhaustBody).connect(highpass).connect(master);
    this.filter = filter;

    // Four-stroke inline-four: two combustion pulses per crank revolution.
    // Unequal harmonic strengths give exhaust a pulsing, rounded timbre.
    const real = new Float32Array(33);
    const imag = new Float32Array(33);
    for (let n = 1; n < imag.length; n++) {
      real[n] = Math.cos(n * 0.37) / Math.pow(n, 1.15) * (n % 2 ? 1 : 0.65);
      imag[n] = Math.sin(n * 0.37) / Math.pow(n, 1.15) * (n % 2 ? 1 : 0.65);
    }
    const exhaust = ctx.createOscillator();
    exhaust.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    exhaust.frequency.value = this.model.rpm / 30;
    const exhaustGain = ctx.createGain();
    exhaustGain.gain.value = 0.22;
    exhaust.connect(exhaustGain).connect(filter);
    this.exhaust = exhaust;
    this.exhaustGain = exhaustGain;
    // Dedicated combustion transient, independent of pedal load and shift cut.
    // The main exhaust path alone softened braking blips almost to silence.
    const blipFilter = ctx.createBiquadFilter();
    blipFilter.type = 'bandpass'; blipFilter.frequency.value = 750; blipFilter.Q.value = 0.6;
    const revMatchGain = ctx.createGain(); revMatchGain.gain.value = 0;
    exhaust.connect(blipFilter).connect(revMatchGain).connect(master);
    this.revMatchGain = revMatchGain;

    const mechanical = ctx.createOscillator();
    mechanical.type = 'triangle';
    mechanical.frequency.value = this.model.rpm / 60;
    const mechanicalGain = ctx.createGain();
    mechanicalGain.gain.value = 0.06;
    mechanical.connect(mechanicalGain).connect(master);
    this.mechanical = mechanical;
    this.mechanicalGain = mechanicalGain;

    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    let low = 0;
    for (let i = 0; i < samples.length; i++) {
      low = low * 0.96 + (Math.random() * 2 - 1) * 0.04;
      samples[i] = (Math.random() * 2 - 1) * 0.65 + low;
    }
    const intake = ctx.createBufferSource();
    intake.buffer = noise;
    intake.loop = true;
    const intakeFilter = ctx.createBiquadFilter();
    intakeFilter.type = 'bandpass';
    intakeFilter.frequency.value = 1100;
    intakeFilter.Q.value = 0.6;
    this.intakeFilter = intakeFilter;
    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0.025;
    intake.connect(intakeFilter).connect(intakeGain).connect(filter);
    this.intakeGain = intakeGain;

    const turbo = ctx.createOscillator();
    turbo.type = 'sine'; turbo.frequency.value = 1700;
    const turboGain = ctx.createGain(); turboGain.gain.value = 0;
    turbo.connect(turboGain).connect(master);
    this.turbo = turbo; this.turboGain = turboGain;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass'; airFilter.frequency.value = 2400; airFilter.Q.value = 0.7;
    const blowoffGain = ctx.createGain(); blowoffGain.gain.value = 0;
    intake.connect(airFilter).connect(blowoffGain).connect(master);
    this.blowoffGain = blowoffGain;
    const shiftFilter = ctx.createBiquadFilter();
    shiftFilter.type = 'lowpass'; shiftFilter.frequency.value = 420;
    const shiftGain = ctx.createGain(); shiftGain.gain.value = 0;
    intake.connect(shiftFilter).connect(shiftGain).connect(master);
    this.shiftGain = shiftGain;

    // Small irregularity in firing pitch avoids an unnaturally static idle.
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 7.3;
    const flutterGain = ctx.createGain();
    flutterGain.gain.value = 6;
    flutter.connect(flutterGain).connect(exhaust.detune);
    this.sources = [exhaust, mechanical, intake, flutter, turbo];
    for (const source of this.sources) source.start();
    this.setOutput(this.active, this.volume);
  }

  setOutput(active: boolean, volume: number) {
    this.active = active;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(active ? this.volume * 0.7 : 0,
        this.context.currentTime, 0.035);
    }
  }

  update(speed: number, controls: Controls, dt: number) {
    if (!this.active) return;
    const { rpm, load, shiftRemaining, boost, blowoff, shiftPulse, revMatch } = this.model.update(speed, controls, dt);
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;
    const time = ctx.currentTime;
    const smooth = (param: AudioParam | undefined, value: number) =>
      param?.setTargetAtTime(value, time, 0.04);
    this.exhaust?.frequency.setTargetAtTime(rpm / 30, time, revMatch > 0 ? 0.008 : 0.04);
    this.revMatchGain?.gain.setTargetAtTime(revMatch * 0.5, time, 0.008);
    smooth(this.mechanical?.frequency, rpm / 60);
    smooth(this.exhaustGain?.gain, (0.17 + load * 0.24 + boost * 0.045) * (shiftRemaining > 0 ? 0.25 + revMatch * 0.75 : 1));
    smooth(this.mechanicalGain?.gain, 0.035 + rpm / 7200 * 0.045);
    smooth(this.intakeGain?.gain, 0.012 + load * 0.07 + boost * 0.045);
    smooth(this.filter?.frequency, 380 + rpm * 0.25 + load * 1500);
    smooth(this.intakeFilter?.frequency, 650 + rpm * 0.23);
    smooth(this.turbo?.frequency, 1600 + boost * 2200 + rpm * 0.07);
    smooth(this.turboGain?.gain, boost * 0.018);
    smooth(this.blowoffGain?.gain, blowoff * 0.22);
    smooth(this.shiftGain?.gain, shiftPulse * 0.32);
  }

  private release() {
    for (const source of this.sources) {
      try { source.stop(); } catch { /* source may not have started */ }
      source.disconnect();
    }
    this.sources = [];
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }

  dispose() {
    this.disposed = true;
    this.release();
  }
}
