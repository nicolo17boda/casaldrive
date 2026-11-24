/** Suspend Babylon's RAF loop entirely while idle; wake on explicit invalidation. */
export class DemandRenderLoop {
  private running = false;
  private disposed = false;
  private last: number | null = null;
  constructor(
    private readonly start: (frame: () => void) => void,
    private readonly stop: (frame: () => void) => void,
    private readonly draw: (delta: number) => boolean,
    private readonly now: () => number = () => performance.now(),
  ) {}
  private readonly frame = () => {
    if (!this.running || this.disposed) return;
    const time = this.now();
    const delta = this.last === null ? 0 : Math.min(Math.max((time - this.last) / 1000, 0), 0.1);
    this.last = time;
    if (!this.draw(delta)) this.suspend();
  };
  wake() {
    if (this.disposed || this.running) return;
    this.running = true;
    this.last = null;
    this.start(this.frame);
  }
  suspend() {
    if (!this.running) return;
    this.running = false;
    this.last = null;
    this.stop(this.frame);
  }
  dispose() {
    this.suspend();
    this.disposed = true;
  }
}
