"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { MARCA } from "@/lib/marca";
import type { Negocio, Sucursal } from "@/lib/tipos";
import { formatoFecha, mensajeError, urlSitio } from "@/lib/utils";

type Clave = { id: string; nombre: string; prefijo: string; ultimo_uso: string | null; created_at: string };

export function Integraciones({ negocio, claves, sucursales, puede }: { negocio: Negocio; claves: Clave[]; sucursales: Sucursal[]; puede: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [nueva, setNueva] = useState<string | null>(null);
  // La dirección se lee en el navegador (si no hay una oficial configurada) para no descuadrar el HTML del servidor.
  const [sitio, setSitio] = useState(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "");
  useEffect(() => setSitio(urlSitio()), []);
  const clave = nueva ?? "tds_TU_CLAVE";

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("crear_api_clave", { p_negocio: negocio.id, p_nombre: nombre || "Clave" });
    if (error) return avisar(mensajeError(error), "error");
    setNueva(String(data));
    setNombre("");
    router.refresh();
  }

  const copiar = (t: string) => navigator.clipboard.writeText(t).then(() => avisar("Copiado"));

  const configMcp = JSON.stringify(
    { mcpServers: { [MARCA.toLowerCase().replace(/\s+/g, "-")]: { type: "http", url: `${sitio}/api/mcp`, headers: { Authorization: `Bearer ${clave}` } } } },
    null,
    2,
  );

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">API e IA</h1>
        <p className="text-sm text-suave">
          Conecta tu caja o sistema para sumar visitas solo, o pregúntale a tu IA (Claude, ChatGPT) “¿quiénes no vienen hace un
          mes?”.
        </p>
      </div>

      {!puede ? (
        <div className="tarjeta border-dashed p-5 text-sm">
          <p className="font-semibold">La API y la conexión con IA son del plan Cadena</p>
          <a href="/panel/plan" className="boton mt-3">
            Ver planes
          </a>
        </div>
      ) : (
        <>
          <section className="tarjeta space-y-3 p-5">
            <h2 className="font-semibold">Claves</h2>
            {nueva && (
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
                <p className="font-semibold">Tu clave nueva (cópiala ahora, no se vuelve a mostrar):</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-stone-100 px-2 py-1">{nueva}</code>
                  <button className="boton-secundario py-1" onClick={() => copiar(nueva)}>
                    Copiar
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-borde text-sm">
              {claves.map((k) => (
                <li key={k.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    <b>{k.nombre}</b> <code className="text-suave">{k.prefijo}…</code>
                    <span className="block text-xs text-suave">
                      {k.ultimo_uso ? `Usada el ${formatoFecha(k.ultimo_uso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, negocio.zona_horaria)}` : "Sin usar"}
                    </span>
                  </span>
                  <button
                    className="text-suave hover:text-red-700"
                    onClick={async () => {
                      if (!confirm(`¿Borrar la clave ${k.nombre}? Lo que la use dejará de funcionar.`)) return;
                      const { error } = await supabase.from("api_claves").delete().eq("id", k.id);
                      if (error) return avisar(mensajeError(error), "error");
                      router.refresh();
                    }}
                  >
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={crear} className="flex gap-2">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Caja local centro, Claude…" className="campo" aria-label="Nombre de la clave" />
              <button className="boton shrink-0">Crear clave</button>
            </form>
          </section>

          <section className="tarjeta space-y-3 p-5 text-sm">
            <h2 className="font-semibold">Conectar con la IA (MCP)</h2>
            <p className="text-suave">
              En Claude: Ajustes → Conectores → Agregar conector personalizado, con la URL <code>{sitio}/api/mcp</code> y tu clave.
              En otras apps que aceptan MCP, pega esta configuración:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-stone-900 p-3 text-xs text-stone-100">{configMcp}</pre>
            <button className="boton-secundario py-1.5" onClick={() => copiar(configMcp)}>
              Copiar configuración
            </button>
            <p className="text-suave">
              La IA puede: sumar una visita, ver la tarjeta de un cliente, listar clientes por grupo (VIP, dormidos, cerca del premio…)
              y ver tus métricas.
            </p>
          </section>

          <section className="tarjeta space-y-3 p-5 text-sm">
            <h2 className="font-semibold">API para tu caja o sistema</h2>
            <p className="text-suave">Todas las llamadas llevan el encabezado <code>Authorization: Bearer {clave}</code>.</p>
            <Ejemplo
              titulo="Sumar una visita (por código o teléfono; con monto si sumas por compra)"
              codigo={`curl -X POST ${sitio}/api/v1/sellar \\
  -H "Authorization: Bearer ${clave}" -H "Content-Type: application/json" \\
  -d '{"telefono":"+56912345678","nombre":"Camila","monto":12500${sucursales[0] ? `,"sucursal":"${sucursales[0].id}"` : ""}}'`}
              copiar={copiar}
            />
            <Ejemplo titulo="Ver una tarjeta" codigo={`curl "${sitio}/api/v1/tarjeta?telefono=912345678" -H "Authorization: Bearer ${clave}"`} copiar={copiar} />
            <Ejemplo titulo="Listar clientes (segmento: todos, cerca, premio, dormidos, nuevos, cumple, frecuentes, vip)" codigo={`curl "${sitio}/api/v1/clientes?segmento=dormidos&dias=45" -H "Authorization: Bearer ${clave}"`} copiar={copiar} />
            <Ejemplo titulo="Resumen y métricas" codigo={`curl "${sitio}/api/v1/resumen?dias=30" -H "Authorization: Bearer ${clave}"`} copiar={copiar} />
            {sucursales.length > 0 && (
              <div>
                <p className="font-medium">Ids de tus locales</p>
                <ul className="text-xs text-suave">
                  {sucursales.map((s) => (
                    <li key={s.id}>
                      {s.nombre}: <code>{s.id}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Ejemplo({ titulo, codigo, copiar }: { titulo: string; codigo: string; copiar: (t: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{titulo}</p>
        <button className="shrink-0 text-xs text-marca" onClick={() => copiar(codigo)}>
          Copiar
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto rounded-xl bg-stone-900 p-3 text-xs text-stone-100">{codigo}</pre>
    </div>
  );
}
