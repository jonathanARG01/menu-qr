"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; texto: string; tipo: "ok" | "error" };
const Ctx = createContext<(texto: string, tipo?: Toast["tipo"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const avisar = useCallback((texto: string, tipo: Toast["tipo"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === "error" ? 6000 : 2200);
  }, []);

  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-full px-4 py-2 text-sm font-medium shadow-lg ${t.tipo === "error" ? "bg-red-600 text-white" : "bg-tinta text-white"}`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
