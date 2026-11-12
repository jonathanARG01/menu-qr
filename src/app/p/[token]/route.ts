import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANTILLA_PROSPECTOS } from "@/lib/prospectos/plantilla";
import {
  COOKIE_PROSPECTOS,
  claveCorrecta,
  rutaValida,
  sesionValida,
  valorSesion,
} from "@/lib/prospectos/acceso";

// Lista privada de prospectos de Jonathan: /p/<PROSPECTOS_RUTA>, protegida con PROSPECTOS_CLAVE.
// GET muestra la clave o la lista; POST entra, sale o guarda cambios (demo, correo, estado del contacto, notas).

export const dynamic = "force-dynamic";

const ESTADOS = ["Sin contactar", "Contactado", "Demo agendada", "Prueba activa", "Cliente", "No interesado", "Cerrado"];

const CABECERAS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

const html = (cuerpo: string, status = 200) =>
  new Response(cuerpo, { status, headers: { ...CABECERAS, "Content-Type": "text/html; charset=utf-8" } });

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { ...CABECERAS, "Content-Type": "application/json" } });

// Igual que cualquier dirección que no existe: no revela que aquí hay algo.
const noExiste = () =>
  html(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página no encontrada · Platovi</title></head><body style="margin:0;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;background:#fffbf5;color:#1c1f24"><div style="text-align:center;padding:24px"><h1 style="font-size:22px">Esta página no existe</h1><p><a href="/" style="color:#b8892b">Ir a platovi.cl</a></p></div></body></html>`,
    404,
  );

const E = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function pantallaClave(error = "") {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Acceso privado</title>
<style>
:root{--bg:#f6f5f2;--sf:#fff;--tx:#1c1f24;--mu:#6b7078;--bd:#e7e4de;--ac:#b8892b;--er:#9b2c22}
@media (prefers-color-scheme:dark){:root{--bg:#121316;--sf:#1a1c20;--tx:#e8e6e1;--mu:#9a9da4;--bd:#2b2e34;--ac:#d6a94a;--er:#f3a59c}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
form{width:100%;max-width:360px;background:var(--sf);border:1px solid var(--bd);border-radius:16px;padding:28px 24px}
small{color:var(--ac);font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:12px}h1{font-size:20px;margin:4px 0 18px}
input,button{font:inherit;width:100%;border-radius:10px;padding:11px 12px}input{border:1px solid var(--bd);background:var(--bg);color:var(--tx)}
button{margin-top:12px;border:0;background:var(--ac);color:#1c1306;font-weight:600;cursor:pointer}.er{color:var(--er);font-size:13.5px;margin:10px 0 0}
</style></head><body><form method="post"><small>Platovi</small><h1>Acceso privado</h1>
<input type="hidden" name="accion" value="entrar"><input type="password" name="clave" placeholder="Contraseña" autocomplete="current-password" autofocus required>
<button>Entrar</button>${error ? `<p class="er">${E(error)}</p>` : ""}</form></body></html>`;
}

// JSON dentro de <script>: sin "</script>" ni separadores de línea que rompan el JS.
const enScript = (v: unknown) =>
  JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

async function pantallaLista() {
  const db = createAdminClient();
  if (!db) return html("<p>Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.</p>", 500);
  // Supabase entrega como máximo 1000 filas por consulta (aunque se pida más): se leen por páginas.
  const filas: { nombre: string; orden: number; datos: unknown; estado_contacto: string; notas: string }[] = [];
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from("prospectos")
      .select("nombre, orden, datos, estado_contacto, notas")
      .order("orden")
      .order("nombre")
      .range(desde, desde + PAGINA - 1);
    if (error) return html(`<p>No se pudo leer la lista (${E(error.message)}). ¿Se ejecutó la migración 0036?</p>`, 500);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA || desde > 50000) break;
  }
  const { data: textos } = await db.from("prospectos_textos").select("clave, valor");
  const datos = filas.map((f) => ({ ...(f.datos as object), nombre: f.nombre, ec: f.estado_contacto, notas: f.notas }));
  const anexo = textos?.find((t) => t.clave === "anexo")?.valor ?? "";
  const pagina = PLANTILLA_PROSPECTOS.replace("__ESTADOS__", () => enScript(ESTADOS))
    .replace("__DATOS__", () => enScript(datos))
    .replace("__ANEXO__", () => anexo);
  return html(pagina);
}


// Aplica los campos editables de la ficha de un local sobre sus datos. Devuelve un código de error o null.
function aplicarFicha(datos: Record<string, unknown>, ficha: Record<string, unknown>, nombre: string): string | null {
  const txt = (k: string, max = 200) => (typeof ficha[k] === "string" ? (ficha[k] as string).trim().slice(0, max) : undefined);
  const url = (v: string) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);
  const tipo = txt("tipo", 120);
  if (tipo !== undefined) datos.tipo = tipo;
  const zona = txt("zona", 120);
  if (zona !== undefined) datos.zona = zona;
  const dir = txt("dir");
  if (dir !== undefined && dir !== datos.dir) {
    datos.dir = dir;
    const q = [nombre, dir, (datos.ciudad as string) || "Valparaíso", "Chile"].filter(Boolean).join(", ");
    datos.maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  const tel = txt("tel", 40);
  if (tel !== undefined) {
    if (tel && !/^[+\d][\d\s().-]{5,}$/.test(tel)) return "telefono";
    const digitos = tel.replace(/\D/g, "");
    datos.tel = tel;
    datos.telhref = tel ? (tel.startsWith("+") ? `+${digitos}` : digitos) : "";
    datos.wa = tel && ficha.whatsapp === true ? digitos : "";
  }
  const web = txt("web", 300);
  if (web !== undefined) {
    if (web && !/^(https?:\/\/)?[^\s.]+\.[^\s]+$/i.test(web)) return "web";
    datos.web = url(web);
  }
  // Redes: se reemplazan Instagram y Facebook; las demás se conservan.
  const red = (k: string, base: string) => {
    const v = txt(k, 200);
    if (v === undefined) return undefined;
    if (!v) return "";
    if (/^https?:\/\//i.test(v) || v.includes(".com")) return url(v);
    return base + v.replace(/^@/, "").replace(/\/$/, "");
  };
  const ig = red("instagram", "https://www.instagram.com/");
  const fb = red("facebook", "https://www.facebook.com/");
  if (ig !== undefined || fb !== undefined) {
    const soc = (Array.isArray(datos.soc) ? (datos.soc as [string, string][]) : []).filter(
      ([t]) => !(t === "Instagram" && ig !== undefined) && !(t === "Facebook" && fb !== undefined),
    );
    if (ig) soc.unshift(["Instagram", ig]);
    if (fb) soc.push(["Facebook", fb]);
    datos.soc = soc;
  }
  return null;
}

const REGIONES = ["Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana", "O’Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"];

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!rutaValida(token)) return noExiste();
  const jar = await cookies();
  if (!sesionValida(jar.get(COOKIE_PROSPECTOS)?.value)) return html(pantallaClave());
  return pantallaLista();
}

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!rutaValida(token)) return noExiste();
  const jar = await cookies();
  const cookieBase = { httpOnly: true, secure: true, sameSite: "strict" as const, path: `/p/${token}` };

  // Guardar cambios desde la lista (fetch con JSON).
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    if (!sesionValida(jar.get(COOKIE_PROSPECTOS)?.value)) return json({ error: "sesion" }, 401);
    const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre : "";
    const db = createAdminClient();
    if (!db) return json({ error: "servidor" }, 500);

    // Agregar un local nuevo a mano (botón "Agregar local").
    if (cuerpo?.accion === "crear") {
      const nuevo = nombre.trim().replace(/\s+/g, " ").slice(0, 120);
      const ciudad = typeof cuerpo.ciudad === "string" ? cuerpo.ciudad.trim().slice(0, 80) : "";
      const region = typeof cuerpo.region === "string" && REGIONES.includes(cuerpo.region) ? cuerpo.region : "";
      if (nuevo.length < 2) return json({ error: "nombre" }, 400);
      if (!ciudad || !region) return json({ error: "ciudad" }, 400);
      const { data: existe } = await db.from("prospectos").select("nombre").eq("nombre", nuevo).maybeSingle();
      if (existe) return json({ error: "existe" }, 409);
      const { data: ultimo } = await db.from("prospectos").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
      const datos: Record<string, unknown> = {
        prio: "1 · Alta", tipo: "", zona: "", dir: "", ciudad, region, tel: "", telhref: "", wa: "", correo: "", web: "",
        redes: "", sis: "No detectado", ev: "", pitch: "", fuente: "", estado: "", falta: "", demo: "",
        badge: "Sin sistema", bk: "none", soc: [], manual: true,
        maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([nuevo, ciudad, "Chile"].join(", "))}`,
      };
      const ficha = cuerpo.ficha && typeof cuerpo.ficha === "object" ? (cuerpo.ficha as Record<string, unknown>) : {};
      const err = aplicarFicha(datos, ficha, nuevo);
      if (err) return json({ error: err }, 400);
      if (typeof cuerpo.demo === "string" && /^https?:\/\/\S+$/.test(cuerpo.demo.trim())) datos.demo = cuerpo.demo.trim();
      if (typeof cuerpo.correo === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cuerpo.correo.trim())) datos.correo = cuerpo.correo.trim().toLowerCase();
      const estado = typeof cuerpo.estado === "string" && ESTADOS.includes(cuerpo.estado) ? cuerpo.estado : "Sin contactar";
      const notas = typeof cuerpo.notas === "string" ? cuerpo.notas.slice(0, 4000) : "";
      const orden = ((ultimo?.orden as number | undefined) ?? 0) + 1;
      const { error } = await db.from("prospectos").insert({ nombre: nuevo, orden, datos, estado_contacto: estado, notas });
      return error ? json({ error: error.message }, 500) : json({ ok: true, nombre: nuevo, orden, datos });
    }

    if (cuerpo?.accion !== "guardar" || !nombre) return json({ error: "datos" }, 400);
    const { data: fila } = await db.from("prospectos").select("datos").eq("nombre", nombre).maybeSingle();
    if (!fila) return json({ error: "no existe" }, 404);
    const cambios: Record<string, unknown> = { actualizado: new Date().toISOString() };
    if (typeof cuerpo.estado === "string" && ESTADOS.includes(cuerpo.estado)) cambios.estado_contacto = cuerpo.estado;
    if (typeof cuerpo.notas === "string") cambios.notas = cuerpo.notas.slice(0, 4000);
    const datos: Record<string, unknown> = { ...(fila.datos as object) };
    let cambiaDatos = false;
    if (typeof cuerpo.demo === "string") {
      const demo = cuerpo.demo.trim();
      if (demo && !/^https?:\/\/\S+$/.test(demo)) return json({ error: "link" }, 400);
      datos.demo = demo;
      cambiaDatos = true;
    }
    if (typeof cuerpo.correo === "string") {
      const correo = cuerpo.correo.trim().toLowerCase().slice(0, 200);
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return json({ error: "correo" }, 400);
      datos.correo = correo;
      cambiaDatos = true;
    }
    // Ficha completa desde el lápiz de la tarjeta: tipo, dirección, zona, teléfono, WhatsApp, web, redes.
    if (cuerpo.ficha && typeof cuerpo.ficha === "object") {
      const err = aplicarFicha(datos, cuerpo.ficha as Record<string, unknown>, nombre);
      if (err) return json({ error: err }, 400);
      cambiaDatos = true;
    }
    if (cambiaDatos) cambios.datos = datos;
    const { error } = await db.from("prospectos").update(cambios).eq("nombre", nombre);
    return error ? json({ error: error.message }, 500) : json({ ok: true, datos });
  }

  // Formularios: entrar o salir.
  const form = await req.formData().catch(() => null);
  const accion = String(form?.get("accion") ?? "");
  const volver = () => new NextResponse(null, { status: 303, headers: { ...CABECERAS, Location: `/p/${token}` } });
  if (accion === "salir") {
    const res = volver();
    res.cookies.set(COOKIE_PROSPECTOS, "", { ...cookieBase, maxAge: 0 });
    return res;
  }
  if (accion === "entrar") {
    if (!claveCorrecta(String(form?.get("clave") ?? ""))) {
      await new Promise((r) => setTimeout(r, 1500)); // frena a quien intente adivinar la clave
      return html(pantallaClave("Contraseña incorrecta."), 401);
    }
    const res = volver();
    res.cookies.set(COOKIE_PROSPECTOS, valorSesion(), { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
    return res;
  }
  return html(pantallaClave());
}
