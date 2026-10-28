"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/AuthShell";
import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { PAIS_BASE } from "@/lib/region";
import { urlSitio } from "@/lib/utils";
import {
  cambiarClave,
  cambiarCorreo,
  datosRestaurante,
  eliminarRestaurante,
  enlaceClave,
  guardarDatos,
  type DatosRestaurante,
  type Miembro,
} from "./cuentas";

const ROL: Record<Miembro["rol"], string> = { dueno: "Dueño", mesero: "Mesero", cocina: "Cocina", staff: "Soporte" };
const numero = (n: number) => Number(n).toLocaleString(PAIS_BASE.locale);
const fecha = (d: string) =>
  new Date(d).toLocaleDateString(PAIS_BASE.locale, { day: "numeric", month: "short", year: "numeric" });

// Ventana de /admin para cambiar los datos de un restaurante, el correo y la contraseña de su gente, o borrarlo.
export function EditarRestaurante({ id, nombre, onCerrar }: { id: string; nombre: string; onCerrar: () => void }) {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosRestaurante | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function cargar() {
    const r = await datosRestaurante(id);
    if ("error" in r) setError(r.error);
    else setDatos(r.ok);
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  // Tras cada cambio se recarga la lista de /admin (correos de los dueños, nombre, dirección).
  const listo = () => {
    router.refresh();
    cargar();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editar"
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-borde bg-superficie shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-4 sm:px-6">
          <h2 id="titulo-editar" className="min-w-0 flex-1 truncate text-lg font-semibold">
            {borrando ? "Eliminar restaurante" : `Datos y acceso · ${datos?.nombre ?? nombre}`}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl leading-none text-suave hover:text-tinta"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <Aviso>{error}</Aviso>
          ) : !datos ? (
            <p className="py-10 text-center text-sm text-suave">Cargando…</p>
          ) : borrando ? (
            <Eliminar datos={datos} onVolver={() => setBorrando(false)} onCerrar={onCerrar} />
          ) : (
            <div className="space-y-7">
              <FormDatos datos={datos} onGuardado={listo} />
              <section>
                <h3 className="font-semibold">Personas con acceso</h3>
                <p className="mb-3 text-xs text-suave">
                  Cambia el correo con el que entran o su contraseña. El cambio de correo vale al momento, sin confirmar.
                </p>
                {datos.miembros.length === 0 ? (
                  <p className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-suave">Sin cuentas: es una demo.</p>
                ) : (
                  <ul className="space-y-3">
                    {datos.miembros.map((m) => (
                      <TarjetaMiembro key={m.user_id} restauranteId={datos.id} m={m} onCambio={listo} />
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-2xl border border-red-200 p-4">
                <h3 className="font-semibold text-red-700">Eliminar restaurante</h3>
                <p className="mt-1 text-sm text-suave">
                  Borra la carta, mesas, pedidos, reservas, caja, clientes y fotos. No se puede deshacer.
                </p>
                <button
                  type="button"
                  onClick={() => setBorrando(true)}
                  className="mt-3 rounded-xl border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Eliminar…
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormDatos({ datos, onGuardado }: { datos: DatosRestaurante; onGuardado: () => void }) {
  const avisar = useToast();
  const [nombre, setNombre] = useState(datos.nombre);
  const [slug, setSlug] = useState(datos.slug);
  const [whatsapp, setWhatsapp] = useState(datos.whatsapp ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const cambioSlug = slug.trim() !== datos.slug;
  const cambio = nombre.trim() !== datos.nombre || cambioSlug || whatsapp.replace(/\D/g, "") !== (datos.whatsapp ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        empezar(async () => {
          const r = await guardarDatos(datos.id, { nombre, slug, whatsapp });
          if ("error" in r) setError(r.error);
          else {
            avisar("Datos guardados");
            onGuardado();
          }
        });
      }}
    >
      <h3 className="font-semibold">Datos del restaurante</h3>
      <div>
        <label htmlFor="ed-nombre" className="etiqueta-campo">
          Nombre
        </label>
        <input
          id="ed-nombre"
          required
          maxLength={80}
          className="campo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="ed-slug" className="etiqueta-campo">
          Dirección de la carta
        </label>
        <input
          id="ed-slug"
          required
          minLength={3}
          maxLength={50}
          pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
          className="campo font-mono text-sm"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        />
        {cambioSlug && (
          <p className="mt-1 text-xs text-amber-600">
            Ojo: los QR ya impresos apuntan a /{datos.slug} y dejarán de funcionar. Habrá que imprimirlos de nuevo.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="ed-whatsapp" className="etiqueta-campo">
          WhatsApp del local
        </label>
        <input
          id="ed-whatsapp"
          inputMode="tel"
          placeholder="56912345678"
          className="campo"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" className="boton" disabled={!cambio || pendiente}>
        {pendiente ? "Guardando…" : "Guardar datos"}
      </button>
    </form>
  );
}

type Modo = null | "correo" | "clave" | "enlace";

function TarjetaMiembro({ restauranteId, m, onCambio }: { restauranteId: string; m: Miembro; onCambio: () => void }) {
  const avisar = useToast();
  const [modo, setModo] = useState<Modo>(null);
  const [valor, setValor] = useState("");
  const [ver, setVer] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function abrir(nuevo: Modo) {
    setModo(modo === nuevo ? null : nuevo);
    setValor(nuevo === "correo" ? m.email : nuevo === "clave" ? claveAlAzar() : "");
    setVer(nuevo === "clave");
    setError(null);
    setLista(null);
    setEnlace(null);
    if (nuevo === "enlace" && modo !== "enlace") {
      empezar(async () => {
        const r = await enlaceClave(restauranteId, m.user_id, urlSitio());
        if ("error" in r) setError(r.error);
        else setEnlace(r.ok);
      });
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    empezar(async () => {
      const r =
        modo === "correo"
          ? await cambiarCorreo(restauranteId, m.user_id, valor)
          : await cambiarClave(restauranteId, m.user_id, valor);
      if ("error" in r) return setError(r.error);
      setModo(null);
      if (modo === "clave") {
        // Queda a la vista por si el navegador no deja copiar.
        await copiar(valor);
        setLista(valor);
        avisar("Contraseña cambiada y copiada");
      } else {
        avisar("Correo cambiado");
        onCambio();
      }
    });
  }

  const mensaje = enlace
    ? `Hola, te dejo el enlace para crear tu nueva contraseña de Mesitto (vale por 1 hora y se usa una sola vez): ${enlace}`
    : "";

  return (
    <li className="rounded-2xl bg-stone-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{m.email}</p>
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
          {ROL[m.rol]}
          {m.soy_yo ? " · tú" : ""}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-suave">
        {m.ultimo_ingreso ? `Último ingreso ${fecha(m.ultimo_ingreso)}` : "Nunca ha entrado"}
        {!m.confirmado && " · correo sin confirmar"}
        {m.otros_restaurantes > 0 && ` · tiene ${numero(m.otros_restaurantes)} restaurante(s) más`}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {(["correo", "clave", "enlace"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => abrir(k)}
            aria-pressed={modo === k}
            className={`font-medium hover:underline ${modo === k ? "text-tinta" : "text-marca"}`}
          >
            {k === "correo" ? "Cambiar correo" : k === "clave" ? "Poner contraseña" : "Enlace para que la elija"}
          </button>
        ))}
      </div>

      {(modo === "correo" || modo === "clave") && (
        <form onSubmit={guardar} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type={modo === "correo" ? "email" : ver ? "text" : "password"}
              required
              minLength={modo === "clave" ? 8 : undefined}
              autoComplete={modo === "clave" ? "new-password" : "off"}
              aria-label={modo === "correo" ? "Correo nuevo" : "Contraseña nueva"}
              className="campo min-w-0 flex-1 py-1.5 font-mono text-sm"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <button type="submit" className="boton shrink-0 py-1.5" disabled={pendiente}>
              {pendiente ? "…" : "Guardar"}
            </button>
          </div>
          {modo === "clave" && (
            <p className="text-xs text-suave">
              Te propongo una al azar (puedes cambiarla). Al guardar queda copiada para que se la mandes; su sesión abierta sigue
              activa.
            </p>
          )}
        </form>
      )}

      {modo === "enlace" && (
        <div className="mt-3 space-y-2 text-sm">
          {pendiente && <p className="text-suave">Generando enlace…</p>}
          {enlace && (
            <>
              <p className="text-xs text-suave">
                Vale por 1 hora y sirve una sola vez. Al abrirlo entra a su cuenta y elige su contraseña nueva.
              </p>
              <input readOnly value={enlace} className="campo py-1.5 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="boton-secundario py-1.5 text-xs"
                  onClick={async () => {
                    await copiar(enlace);
                    avisar("Enlace copiado");
                  }}
                >
                  Copiar
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Icono nombre="whatsapp" className="h-4 w-4" /> WhatsApp
                </a>
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Tu nueva contraseña de Mesitto")}&body=${encodeURIComponent(mensaje)}`}
                  className="inline-flex items-center rounded-xl border border-borde px-3 py-1.5 text-xs font-semibold hover:bg-stone-100"
                >
                  Correo
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {lista && (
        <div className="mt-2">
          <Aviso tipo="ok">
            Contraseña nueva: <span className="select-all font-mono font-semibold">{lista}</span>. Mándasela por un canal privado.
          </Aviso>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Aviso>{error}</Aviso>
        </div>
      )}
    </li>
  );
}

function Eliminar({ datos, onVolver, onCerrar }: { datos: DatosRestaurante; onVolver: () => void; onCerrar: () => void }) {
  const router = useRouter();
  const avisar = useToast();
  const [texto, setTexto] = useState("");
  const [cuentas, setCuentas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const coincide = texto.trim().toLowerCase() === datos.slug;
  // Cuentas que se borrarían: las que no son tuyas ni de otro restaurante.
  const borrables = datos.miembros.filter((m) => !m.superadmin && m.otros_restaurantes === 0);
  const t = datos.totales;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!coincide) return;
        setError(null);
        empezar(async () => {
          const r = await eliminarRestaurante(datos.id, texto, cuentas);
          if ("error" in r) return setError(r.error);
          avisar(r.ok.cuentas ? `${datos.nombre} eliminado, con ${r.ok.cuentas} cuenta(s)` : `${datos.nombre} eliminado`);
          onCerrar();
          router.refresh();
        });
      }}
    >
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
        <p className="font-semibold">
          Se borra para siempre {datos.nombre} (/{datos.slug}):
        </p>
        <ul className="mt-1 list-disc pl-5">
          <li>
            {numero(t.platos)} platos, {numero(t.pedidos)} pedidos y {numero(t.reservas)} reservas
          </li>
          <li>Mesas, salón, caja, clientes, promociones, opiniones y estadísticas</li>
          <li>{numero(t.fotos)} fotos guardadas</li>
          <li>Su lugar en referidos (si lo invitó otro local, a ese le baja la cuenta)</li>
        </ul>
        <p className="mt-2">Los QR impresos dejarán de funcionar. No se puede deshacer.</p>
      </div>

      {datos.miembros.length > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={cuentas} onChange={(e) => setCuentas(e.target.checked)} />
          <span>
            Borrar también las cuentas de su gente ({borrables.length ? borrables.map((m) => m.email).join(", ") : "ninguna"}).
            <span className="block text-xs text-suave">
              Nunca se borra tu cuenta ni la de alguien que tenga otro restaurante. Si no lo marcas, podrán entrar y crear uno
              nuevo.
            </span>
          </span>
        </label>
      )}

      <div>
        <label htmlFor="ed-confirmar" className="etiqueta-campo">
          Para confirmar, escribe <span className="font-mono font-semibold">{datos.slug}</span>
        </label>
        <input
          id="ed-confirmar"
          autoComplete="off"
          className="campo font-mono text-sm"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-3">
        <button type="button" onClick={onVolver} className="boton-secundario flex-1">
          Volver
        </button>
        <button
          type="submit"
          disabled={!coincide || pendiente}
          className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-40"
        >
          {pendiente ? "Eliminando…" : "Eliminar para siempre"}
        </button>
      </div>
    </form>
  );
}

// Sin letras que se confunden (l, 1, O, 0) para dictarla por teléfono sin errores.
function claveAlAzar() {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // Sin permiso al portapapeles: queda a la vista para copiarla a mano.
  }
}
