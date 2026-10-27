// Sonidos del panel, distintos para que se reconozcan sin mirar la pantalla:
// cocina = un pitido; mesero = "din-don"; cuenta = tres notas que suben, como una caja registradora.
export type Sonido = "cocina" | "mozo" | "cuenta";

const NOTAS: Record<Sonido, { f: number; t: number; d: number }[]> = {
  cocina: [{ f: 880, t: 0, d: 0.5 }],
  mozo: [
    { f: 659, t: 0, d: 0.45 },
    { f: 523, t: 0.28, d: 0.6 },
  ],
  cuenta: [
    { f: 784, t: 0, d: 0.18 },
    { f: 988, t: 0.12, d: 0.18 },
    { f: 1319, t: 0.24, d: 0.45 },
  ],
};

export function sonar(sonido: Sonido) {
  try {
    const ctx = new AudioContext();
    for (const n of NOTAS[sonido]) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = sonido === "cuenta" ? "triangle" : "sine";
      osc.frequency.value = n.f;
      vol.gain.setValueAtTime(0.22, ctx.currentTime + n.t);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + n.d);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + n.t);
      osc.stop(ctx.currentTime + n.t + n.d);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}
