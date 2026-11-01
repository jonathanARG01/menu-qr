import { createSign } from "node:crypto";
import { emojiSello, type ProgramaSellos } from "./tipos";

// Google Wallet para Platovi Sellos: el botón "Guardar en Google Wallet" y la actualización de la tarjeta guardada
// cuando suma un sello o canjea un premio.
//
// Se activa con tres variables en Vercel (Google Pay & Wallet Console → cuenta de emisor + cuenta de servicio):
//   GOOGLE_WALLET_ISSUER_ID     número del emisor
//   GOOGLE_WALLET_CLIENT_EMAIL  correo de la cuenta de servicio (…@….iam.gserviceaccount.com)
//   GOOGLE_WALLET_PRIVATE_KEY   su clave privada (el texto "-----BEGIN PRIVATE KEY-----…", con \n o saltos de línea)
// Sin ellas el botón no aparece y nada se rompe.

const ISSUER = (process.env.GOOGLE_WALLET_ISSUER_ID ?? "").replace(/\D/g, "");
const EMAIL = (process.env.GOOGLE_WALLET_CLIENT_EMAIL ?? "").trim();
const CLAVE = (process.env.GOOGLE_WALLET_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
const API = "https://walletobjects.googleapis.com/walletobjects/v1";

export const googleWalletActivo = () => !!(ISSUER && EMAIL && CLAVE.includes("PRIVATE KEY"));

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

function firmar(payload: Record<string, unknown>) {
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify(payload));
  const firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(CLAVE);
  return `${cabecera}.${cuerpo}.${b64url(firma)}`;
}

const sinGuiones = (id: string) => id.replace(/-/g, "");
export const idClase = (restauranteId: string) => `${ISSUER}.platovi_${sinGuiones(restauranteId)}`;
export const idObjeto = (codigo: string) => `${ISSUER}.tarjeta_${codigo}`;

export type DatosWallet = {
  sitio: string;
  restaurante: { id: string; nombre: string; logo_url: string | null };
  programa: ProgramaSellos;
  tarjeta: { codigo: string; nombre: string; sellos: number; premios: number };
};

const texto = (es: string) => ({ defaultValue: { language: "es", value: es } });

function clase(d: DatosWallet) {
  const logo = d.restaurante.logo_url?.startsWith("https://") ? d.restaurante.logo_url : `${d.sitio}/app-panel/icono-512.png`;
  return {
    id: idClase(d.restaurante.id),
    issuerName: d.restaurante.nombre.slice(0, 40),
    programName: "Tarjeta de sellos",
    programLogo: { sourceUri: { uri: logo }, contentDescription: texto(d.restaurante.nombre) },
    hexBackgroundColor: d.programa.color,
    reviewStatus: "UNDER_REVIEW",
    countryCode: "CL",
  };
}

function lineaSellos(d: DatosWallet) {
  const e = emojiSello(d.programa.icono);
  return `${e.repeat(d.tarjeta.sellos)}${"○".repeat(Math.max(0, d.programa.meta - d.tarjeta.sellos))}`;
}

function objeto(d: DatosWallet) {
  const url = `${d.sitio}/s/${d.tarjeta.codigo}`;
  return {
    id: idObjeto(d.tarjeta.codigo),
    classId: idClase(d.restaurante.id),
    state: "ACTIVE",
    accountId: d.tarjeta.codigo,
    accountName: d.tarjeta.nombre,
    loyaltyPoints: { label: "Sellos", balance: { string: `${d.tarjeta.sellos}/${d.programa.meta}` } },
    secondaryLoyaltyPoints: { label: "Premios", balance: { int: d.tarjeta.premios } },
    barcode: { type: "QR_CODE", value: url, alternateText: d.tarjeta.codigo },
    hexBackgroundColor: d.programa.color,
    textModulesData: [
      { id: "sellos", header: "Tus sellos", body: lineaSellos(d) },
      { id: "premio", header: "Premio", body: d.programa.premio },
      ...(d.programa.condiciones ? [{ id: "condiciones", header: "Condiciones", body: d.programa.condiciones }] : []),
    ],
    linksModuleData: { uris: [{ id: "tarjeta", uri: url, description: "Ver mi tarjeta" }] },
  };
}

// Enlace "Guardar en Google Wallet": crea la clase del local y la tarjeta del cliente en el mismo paso.
export function enlaceGuardar(d: DatosWallet) {
  const jwt = firmar({
    iss: EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [d.sitio],
    payload: { loyaltyClasses: [clase(d)], loyaltyObjects: [objeto(d)] },
  });
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// Token de acceso de la cuenta de servicio (dura una hora; se reutiliza mientras viva el servidor).
let token: { valor: string; vence: number } | null = null;
async function acceso() {
  if (token && token.vence > Date.now() + 60000) return token.valor;
  const ahora = Math.floor(Date.now() / 1000);
  const afirmacion = firmar({
    iss: EMAIL,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: afirmacion }),
  });
  if (!r.ok) throw new Error(`Google Wallet: no se pudo autenticar (${r.status})`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { valor: j.access_token, vence: Date.now() + j.expires_in * 1000 };
  return token.valor;
}

// Actualiza la tarjeta guardada (si el cliente no la guardó, Google responde 404 y no pasa nada) y, si hay mensaje,
// lo muestra con aviso en el celular.
export async function actualizarEnWallet(d: DatosWallet, mensaje?: { titulo: string; cuerpo: string }) {
  if (!googleWalletActivo()) return false;
  const auth = { Authorization: `Bearer ${await acceso()}`, "Content-Type": "application/json" };
  const id = encodeURIComponent(idObjeto(d.tarjeta.codigo));
  const o = objeto(d);
  const r = await fetch(`${API}/loyaltyObject/${id}`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({
      loyaltyPoints: o.loyaltyPoints,
      secondaryLoyaltyPoints: o.secondaryLoyaltyPoints,
      textModulesData: o.textModulesData,
      hexBackgroundColor: o.hexBackgroundColor,
    }),
  });
  if (r.status === 404) return false;
  if (!r.ok) throw new Error(`Google Wallet: no se pudo actualizar (${r.status})`);
  if (mensaje) {
    await fetch(`${API}/loyaltyObject/${id}/addMessage`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        message: {
          id: `m${Date.now()}`,
          header: mensaje.titulo.slice(0, 60),
          body: mensaje.cuerpo.slice(0, 200),
          messageType: "TEXT_AND_NOTIFY",
        },
      }),
    }).catch(() => {});
  }
  return true;
}
