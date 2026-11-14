"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Lee el QR de la tarjeta del cliente con la cámara (o se escribe el código a mano).
export function Escaner({ onLeido, onCerrar }: { onLeido: (texto: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [codigo, setCodigo] = useState("");
  const [sinCamara, setSinCamara] = useState(false);
  const leido = useRef(onLeido);
  leido.current = onLeido;

  useEffect(() => {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia) {
      setSinCamara(true);
      return;
    }
    let activo = true;
    let flujo: MediaStream | null = null;
    const detector = new BD({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        flujo = s;
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        while (activo) {
          try {
            const r = await detector.detect(video.current);
            if (r[0]?.rawValue) {
              activo = false;
              leido.current(r[0].rawValue);
              break;
            }
          } catch {}
          await new Promise((ok) => setTimeout(ok, 250));
        }
      })
      .catch(() => setSinCamara(true));
    return () => {
      activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escanear tarjeta"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <p className="font-semibold">Escanear la tarjeta del cliente</p>
        {!sinCamara ? (
          <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
        ) : (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-suave">
            Este navegador no puede leer QR. Escribe el código que aparece bajo el QR de la tarjeta, o escanéalo con la cámara
            del celular: si entraste al panel en ese celular, la tarjeta se abre con los botones para sumar y canjear.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (codigo.trim()) onLeido(codigo);
          }}
          className="flex gap-2"
        >
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de la tarjeta"
            aria-label="Código de la tarjeta"
            className="campo flex-1 py-2 font-mono uppercase"
            autoCapitalize="characters"
          />
          <button type="submit" className="boton">
            Buscar
          </button>
        </form>
        <button type="button" className="w-full text-sm text-suave hover:text-tinta" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
