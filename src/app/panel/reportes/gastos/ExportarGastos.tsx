"use client";

type Fila = { fecha: string; tipo: string; categoria: string; detalle: string; proveedor: string; medio: string; monto: number };

// Descarga los gastos en CSV (se abre en Excel con tildes y separado por punto y coma, como lo usa Excel en Chile).
export function ExportarGastos({ nombre, filas }: { nombre: string; filas: Fila[] }) {
  function descargar() {
    const celda = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lineas = [
      ["Fecha", "Tipo", "Categoría", "Detalle", "Proveedor", "Medio de pago", "Monto"].map(celda).join(";"),
      ...filas.map((f) => [f.fecha, f.tipo, f.categoria, f.detalle, f.proveedor, f.medio, f.monto].map(celda).join(";")),
    ];
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <button type="button" className="boton px-3 py-1.5" onClick={descargar} disabled={filas.length === 0}>
      Exportar a Excel
    </button>
  );
}
