"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Efecto 3D de la tarjeta de sellos: se inclina hacia el mouse o el dedo, con un brillo que sigue al puntero.
// En Android también se inclina al mover el celular (giroscopio). Respeta "reducir movimiento" del sistema.
const MAX_X = 12; // grados arriba/abajo
const MAX_Y = 16; // grados izquierda/derecha

export function Inclinable({ children, giroscopio = false }: { children: ReactNode; giroscopio?: boolean }) {
  const caja = useRef<HTMLDivElement>(null);
  const tocando = useRef(false);

  function aplicar(x: number, y: number, activo: boolean) {
    const el = caja.current;
    if (!el) return;
    // x, y entre 0 y 1 (posición del puntero sobre la tarjeta).
    el.style.setProperty("--rx", `${((0.5 - y) * 2 * MAX_X).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * 2 * MAX_Y).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
    el.dataset.activo = activo ? "1" : "";
  }

  const quieto = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mover(e: React.PointerEvent) {
    if (quieto()) return;
    const r = e.currentTarget.getBoundingClientRect();
    tocando.current = true;
    aplicar(
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      true,
    );
  }

  function soltar() {
    tocando.current = false;
    aplicar(0.5, 0.5, false);
  }

  // Giroscopio (Android y navegadores que no piden permiso). En iPhone pide permiso y no lo activamos.
  useEffect(() => {
    if (!giroscopio || quieto() || typeof DeviceOrientationEvent === "undefined") return;
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function") return;
    let base: { b: number; g: number } | null = null;
    let cuadro = 0;
    const leer = (e: DeviceOrientationEvent) => {
      if (tocando.current || e.beta == null || e.gamma == null) return;
      base ??= { b: e.beta, g: e.gamma };
      // La posición inicial cuenta como "derecha"; 20° de giro llevan al máximo.
      const x = Math.min(1, Math.max(0, 0.5 + (e.gamma - base.g) / 40));
      const y = Math.min(1, Math.max(0, 0.5 + (e.beta - base.b) / 40));
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => aplicar(x, y, Math.abs(x - 0.5) + Math.abs(y - 0.5) > 0.04));
    };
    window.addEventListener("deviceorientation", leer);
    return () => {
      window.removeEventListener("deviceorientation", leer);
      cancelAnimationFrame(cuadro);
    };
  }, [giroscopio]);

  return (
    <div className="flex w-full max-w-sm justify-center" style={{ perspective: "1000px" }}>
      <div className="tarjeta-saludo flex w-full justify-center [transform-style:preserve-3d]">
        <div
          ref={caja}
          onPointerMove={mover}
          onPointerLeave={soltar}
          onPointerCancel={soltar}
          onPointerUp={(e) => e.pointerType !== "mouse" && soltar()}
          className="tarjeta-inclinable relative flex w-full justify-center"
          style={{ touchAction: "pan-y" }}
        >
          {children}
          <span aria-hidden className="tarjeta-brillo pointer-events-none absolute inset-0 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
