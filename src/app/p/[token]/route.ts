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
// GET muestra la clave o la lista; POST entra, sale o guarda cambios (demo, estado del contacto, notas).

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
  const [{ data: filas, error }, { data: textos }] = await Promise.all([
    db.from("prospectos").select("nombre, orden, datos, estado_contacto, notas").order("orden").limit(5000),
    db.from("prospectos_textos").select("clave, valor"),
  ]);
  if (error) return html(`<p>No se pudo leer la lista (${E(error.message)}). ¿Se ejecutó la migración 0036?</p>`, 500);
  const datos = (filas ?? []).map((f) => ({ ...(f.datos as object), nombre: f.nombre, ec: f.estado_contacto, notas: f.notas }));
  const anexo = textos?.find((t) => t.clave === "anexo")?.valor ?? "";
  const pagina = PLANTILLA_PROSPECTOS.replace("__ESTADOS__", () => enScript(ESTADOS))
    .replace("__DATOS__", () => enScript(datos))
    .replace("__ANEXO__", () => anexo);
  return html(pagina);
}

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
    if (cuerpo?.accion !== "guardar" || !nombre) return json({ error: "datos" }, 400);
    const db = createAdminClient();
    if (!db) return json({ error: "servidor" }, 500);
    const { data: fila } = await db.from("prospectos").select("datos").eq("nombre", nombre).maybeSingle();
    if (!fila) return json({ error: "no existe" }, 404);
    const cambios: Record<string, unknown> = { actualizado: new Date().toISOString() };
    if (typeof cuerpo.estado === "string" && ESTADOS.includes(cuerpo.estado)) cambios.estado_contacto = cuerpo.estado;
    if (typeof cuerpo.notas === "string") cambios.notas = cuerpo.notas.slice(0, 4000);
    if (typeof cuerpo.demo === "string") {
      const demo = cuerpo.demo.trim();
      if (demo && !/^https?:\/\/\S+$/.test(demo)) return json({ error: "link" }, 400);
      cambios.datos = { ...(fila.datos as object), demo };
    }
    const { error } = await db.from("prospectos").update(cambios).eq("nombre", nombre);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
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
