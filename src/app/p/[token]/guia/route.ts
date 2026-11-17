import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COOKIE_PROSPECTOS,
  claveCorrecta,
  rutaValida,
  sesionValida,
  valorSesion,
} from "@/lib/prospectos/acceso";

// Guía de venta privada: /p/<PROSPECTOS_RUTA>/guia, con la misma clave y sesión que la lista de prospectos.
// El contenido vive en Supabase (prospectos_textos, clave 'guia_venta'), no en el repo, que es público.
// Se carga con el SQL que genera scripts/guia-venta/generar.mjs desde la guía en Claude Docs.

export const dynamic = "force-dynamic";

const CABECERAS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

const html = (cuerpo: string, status = 200) =>
  new Response(cuerpo, { status, headers: { ...CABECERAS, "Content-Type": "text/html; charset=utf-8" } });

const noExiste = () =>
  html(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página no encontrada · Platovi</title></head><body style="margin:0;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;background:#fffbf5;color:#1c1f24"><div style="text-align:center;padding:24px"><h1 style="font-size:22px">Esta página no existe</h1><p><a href="/" style="color:#b8892b">Ir a platovi.cl</a></p></div></body></html>`,
    404,
  );

const TOKENS = `:root{--bg:#f6f5f2;--sf:#fff;--tx:#1c1f24;--mu:#6b7078;--bd:#e7e4de;--ac:#b8892b;--acs:#f6ecd6;--er:#9b2c22}
@media (prefers-color-scheme:dark){:root{--bg:#121316;--sf:#1a1c20;--tx:#e8e6e1;--mu:#9a9da4;--bd:#2b2e34;--ac:#d6a94a;--acs:#2a2316;--er:#f3a59c}}`;

function pantallaClave(error = "") {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Acceso privado</title>
<style>${TOKENS}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
form{width:100%;max-width:360px;background:var(--sf);border:1px solid var(--bd);border-radius:16px;padding:28px 24px}
small{color:var(--ac);font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:12px}h1{font-size:20px;margin:4px 0 18px}
input,button{font:inherit;width:100%;border-radius:10px;padding:11px 12px}input{border:1px solid var(--bd);background:var(--bg);color:var(--tx)}
button{margin-top:12px;border:0;background:var(--ac);color:#1c1306;font-weight:600;cursor:pointer}.er{color:var(--er);font-size:13.5px;margin:10px 0 0}
</style></head><body><form method="post"><small>Platovi</small><h1>Guía de venta</h1>
<input type="hidden" name="accion" value="entrar"><input type="password" name="clave" placeholder="Contraseña" autocomplete="current-password" autofocus required>
<button>Entrar</button>${error ? `<p class="er">${error}</p>` : ""}</form></body></html>`;
}

function pantallaGuia(token: string, contenido: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Guía de venta · Platovi</title>
<style>${TOKENS}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.barra{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 16px;background:var(--sf);border-bottom:1px solid var(--bd)}
.barra b{color:var(--ac);letter-spacing:.06em;text-transform:uppercase;font-size:13px}
.barra nav{display:flex;gap:8px}.barra a,.barra button{font:inherit;font-size:14px;color:var(--tx);text-decoration:none;border:1px solid var(--bd);background:var(--bg);border-radius:999px;padding:5px 12px;cursor:pointer}
main{max-width:820px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:30px;line-height:1.2;margin:8px 0 4px}h2{font-size:23px;margin:44px 0 10px;padding-top:12px;border-top:1px solid var(--bd);scroll-margin-top:64px}
h3{font-size:18px;margin:26px 0 8px;scroll-margin-top:64px}p,li{max-width:70ch}time{color:var(--mu)}
a{color:var(--ac)}strong{font-weight:650}
.indice{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:14px 18px;margin:24px 0}
.indice ol{list-style:none;padding:0;margin:8px 0 0;columns:2;column-gap:24px}.indice li{margin:3px 0;break-inside:avoid}
@media (max-width:600px){.indice ol{columns:1}h1{font-size:25px}}
.tabla{overflow-x:auto;margin:12px 0;border:1px solid var(--bd);border-radius:12px;background:var(--sf)}
table{border-collapse:collapse;width:100%;font-size:14.5px}th,td{text-align:left;vertical-align:top;padding:9px 12px;border-bottom:1px solid var(--bd)}
th{background:var(--acs);font-weight:650}tr:last-child td{border-bottom:0}td p,th p{margin:0}
blockquote{margin:12px 0;padding:12px 16px;border-left:4px solid var(--ac);background:var(--sf);border-radius:0 12px 12px 0}blockquote p{margin:0}
li p{margin:4px 0}li[data-checked]{list-style:none;margin-left:-22px}input[type=checkbox]{accent-color:var(--ac);width:17px;height:17px;vertical-align:-3px;margin-right:6px}
@media print{.barra{display:none}body{background:#fff;color:#000}}
</style></head><body>
<div class="barra"><b>Platovi</b><nav><a href="/p/${token}">Prospectos</a><button type="button" onclick="print()">Imprimir</button></nav></div>
<main>${contenido}</main>
<script>
(function(){var k="guia-venta:casillas",m={};try{m=JSON.parse(localStorage.getItem(k)||"{}")}catch(e){}
document.querySelectorAll('main input[type=checkbox]').forEach(function(c,i){c.checked=!!m[i];c.addEventListener('change',function(){m[i]=c.checked;try{localStorage.setItem(k,JSON.stringify(m))}catch(e){}})})})();
</script></body></html>`;
}

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!rutaValida(token)) return noExiste();
  const jar = await cookies();
  if (!sesionValida(jar.get(COOKIE_PROSPECTOS)?.value)) return html(pantallaClave());
  const db = createAdminClient();
  if (!db) return html("<p>Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.</p>", 500);
  const { data, error } = await db.from("prospectos_textos").select("valor").eq("clave", "guia_venta").maybeSingle();
  const contenido =
    data?.valor ||
    `<h1>Guía de venta</h1><p>${error ? "No se pudo leer la guía." : "Todavía no está cargada: ejecuta guia_venta.sql en Supabase."}</p>`;
  return html(pantallaGuia(token, contenido));
}

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!rutaValida(token)) return noExiste();
  const form = await req.formData().catch(() => null);
  if (String(form?.get("accion") ?? "") !== "entrar") return html(pantallaClave());
  if (!claveCorrecta(String(form?.get("clave") ?? ""))) {
    await new Promise((r) => setTimeout(r, 1500)); // frena a quien intente adivinar la clave
    return html(pantallaClave("Contraseña incorrecta."), 401);
  }
  const res = new NextResponse(null, { status: 303, headers: { ...CABECERAS, Location: `/p/${token}/guia` } });
  // Misma cookie y ruta que la lista: entrar aquí también abre la lista, y al revés.
  res.cookies.set(COOKIE_PROSPECTOS, valorSesion(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: `/p/${token}`,
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
