import { emptyControls } from "./physics";
export const controls = emptyControls();
const mapping: Record<string, keyof typeof controls> = {
  KeyW: "throttle",
  ArrowUp: "throttle",
  KeyS: "brake",
  ArrowDown: "brake",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "handbrake",
};
export function bindInput(action: (key: string) => void) {
  const pressed = new Set<string>();
  const sync = () => {
    Object.assign(controls, emptyControls());
    for (const key of pressed) if (mapping[key]) controls[mapping[key]] = true;
  };
  const down = (e: KeyboardEvent) => {
    if (
      e.code !== "Escape" &&
      (e.target as HTMLElement)?.matches("input,button,select")
    )
      return;
    if (mapping[e.code] || ["KeyR", "KeyC", "Escape"].includes(e.code))
      e.preventDefault();
    pressed.add(e.code);
    sync();
    if (!e.repeat) action(e.code);
  };
  const up = (e: KeyboardEvent) => {
    pressed.delete(e.code);
    sync();
  };
  const blur = () => {
    pressed.clear();
    sync();
    action("blur");
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    pressed.clear();
    sync();
  };
}
