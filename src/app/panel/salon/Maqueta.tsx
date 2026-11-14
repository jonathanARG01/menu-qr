"use client";

// Vista "Maqueta": el piso del local como una maqueta 3D de verdad (WebGL con three.js), al estilo de las ilustraciones
// isométricas: base, piso de madera, paredes con corte hacia la cámara, mesas con sillas, barra, cocina, baños,
// terraza… Cada mesa se ilumina según su estado (anillo en el piso y haz de luz cuando necesita atención) y los avisos
// nuevos aparecen como tarjetas animadas. Se gira con el dedo o el mouse, se hace zoom con pellizco o rueda.
// Solo se usa para mirar y abrir mesas: para mover cosas se edita en la vista plana.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Avatar } from "@/components/Avatar";
import { ELEMENTOS, type Lado, type LadoSillas, type Piso, nombreMesa, sillasAutomaticas, tono } from "@/lib/salon";
import type { Mesa } from "@/lib/types";
import type { EstadoMesa, Seleccion } from "./Plano";

// ── Estado de una mesa → cómo se ve ────────────────────────────
type Visual = { color: string; nivel: 0 | 1 | 2; clave: string | null };

function visualDe(e?: EstadoMesa): Visual {
  if (e?.aviso === "cuenta") return { color: "#8b5cf6", nivel: 2, clave: "cuenta" };
  if (e?.aviso === "pago") return { color: "#10b981", nivel: 2, clave: "pago" };
  if (e?.aviso) return { color: "#0ea5e9", nivel: 2, clave: "mozo" };
  if (e?.pendiente) return { color: "#ef4444", nivel: 2, clave: "pendiente" };
  if (e?.listo) return { color: "#10b981", nivel: 2, clave: "listo" };
  if (e?.ocupada) return { color: "#f59e0b", nivel: 1, clave: null };
  return { color: "#6b7280", nivel: 0, clave: null };
}

const AVISOS: Record<string, { titulo: (m: string) => string; detalle: string; icono: string }> = {
  mozo: { titulo: (m) => `${m} llama al mesero`, detalle: "Desde la carta QR de la mesa", icono: "🙋" },
  cuenta: { titulo: (m) => `${m} pide la cuenta`, detalle: "Lleva la cuenta o cobra desde el panel", icono: "🧾" },
  pago: { titulo: (m) => `${m} pagó desde la carta`, detalle: "Revisa el pago y libera la mesa", icono: "✅" },
  pendiente: { titulo: (m) => `${m} hizo un pedido`, detalle: "Confírmalo para que llegue a cocina", icono: "🛎️" },
  listo: { titulo: (m) => `Pedido listo para ${m}`, detalle: "Retíralo en cocina o barra", icono: "🍽️" },
};

// ── Medidas (1 = una casilla del plano) ─────────────────────────
const ALTO_MESA = 0.74;
const ALTO_PARED = 2.1;
const MARGEN = 0.9;
const MADERA = "#b07a4a";

type Manija = {
  mesa: Mesa;
  centro: THREE.Vector3;
  grupo: THREE.Group;
  sillas: THREE.MeshStandardMaterial;
  tablero: THREE.MeshStandardMaterial;
  anillo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  onda: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  haz: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  fase: number;
  visual: Visual;
  marca: boolean;
  apagada: boolean;
};

type Etiqueta = { id: string; pos: THREE.Vector3; texto?: string };
type Pared = { mesh: THREE.Object3D; normal: THREE.Vector3 };

type Mundo = {
  grupo: THREE.Group;
  manijas: Map<string, Manija>;
  etiquetas: Etiqueta[];
  paredes: Pared[];
  tamano: { ancho: number; fondo: number };
  liberar: () => void;
};

// ── Texturas dibujadas en un canvas (sin archivos) ──────────────
function texturaCanvas(ancho: number, alto: number, dibujar: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  dibujar(canvas.getContext("2d")!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const texMadera = () =>
  texturaCanvas(256, 256, (c) => {
    // Cuatro tablas por casilla, con vetas suaves y juntas.
    const tonos = ["#c8925e", "#bd8754", "#c99a68", "#b98150"];
    for (let i = 0; i < 4; i++) {
      c.fillStyle = tonos[i];
      c.fillRect(0, i * 64, 256, 64);
      c.strokeStyle = "rgba(90,50,20,0.10)";
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        const y = i * 64 + 8 + k * 9;
        c.moveTo(0, y);
        c.bezierCurveTo(80, y + 3, 170, y - 3, 256, y + 1);
        c.stroke();
      }
      c.fillStyle = "rgba(60,30,10,0.35)";
      c.fillRect(0, i * 64 + 62, 256, 2);
      c.fillRect(((i * 97) % 200) + 30, i * 64, 2, 64);
    }
  });

const texBaldosa = (a: string, b: string) =>
  texturaCanvas(128, 128, (c) => {
    c.fillStyle = a;
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = b;
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    c.strokeStyle = "rgba(0,0,0,0.08)";
    c.strokeRect(0, 0, 64, 64);
    c.strokeRect(64, 64, 64, 64);
  });

const texRayas = (a: string, b: string) =>
  texturaCanvas(128, 16, (c) => {
    c.fillStyle = a;
    c.fillRect(0, 0, 128, 16);
    c.fillStyle = b;
    c.fillRect(0, 0, 64, 16);
  });

// Degradado vertical para el haz de luz: fuerte abajo, se apaga arriba.
const texHaz = () =>
  texturaCanvas(4, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#000");
    g.addColorStop(0.6, "#555");
    g.addColorStop(1, "#fff");
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 128);
  });

// Nombre del piso pintado en el borde de la base ("SALÓN", "TERRAZA"…).
const texNombre = (texto: string) =>
  texturaCanvas(1024, 128, (c) => {
    c.fillStyle = "rgba(0,0,0,0)";
    c.fillRect(0, 0, 1024, 128);
    c.font = "600 64px system-ui, sans-serif";
    c.fillStyle = "#9a7b4f";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const letras = texto.toUpperCase().split("").join(String.fromCharCode(8202));
    c.fillText(letras, 512, 66);
  });

// ── Muebles: geometrías armadas una vez y reutilizadas ──────────
function caja(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return g;
}
function cilindro(r1: number, r2: number, h: number, x = 0, y = 0, z = 0, seg = 16) {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg);
  g.translate(x, y + h / 2, z);
  return g;
}
const unir = (partes: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(partes.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  partes.forEach((p) => p.dispose());
  return g;
};

// El respaldo queda hacia +Z: se gira para que mire hacia afuera de la mesa.
function geometrias() {
  return {
    silla: unir([
      caja(0.4, 0.06, 0.38, 0, 0.42, 0),
      caja(0.4, 0.38, 0.05, 0, 0.48, 0.17),
      ...[
        [-0.17, -0.15],
        [0.17, -0.15],
        [-0.17, 0.15],
        [0.17, 0.15],
      ].map(([x, z]) => cilindro(0.02, 0.02, 0.42, x, 0, z, 6)),
    ]),
    taburete: unir([
      cilindro(0.18, 0.18, 0.06, 0, 0.62, 0),
      cilindro(0.03, 0.03, 0.62, 0, 0, 0, 8),
      cilindro(0.15, 0.15, 0.03, 0, 0, 0),
    ]),
    sillon: unir([
      caja(0.6, 0.22, 0.54, 0, 0.12, 0),
      caja(0.6, 0.5, 0.14, 0, 0.12, 0.22),
      caja(0.1, 0.32, 0.54, -0.3, 0.12, 0),
      caja(0.1, 0.32, 0.54, 0.3, 0.12, 0),
    ]),
    pataMesa: unir([cilindro(0.05, 0.05, ALTO_MESA, 0, 0, 0, 10), cilindro(0.26, 0.3, 0.04, 0, 0, 0, 20)]),
    anillo: (() => {
      const g = new THREE.RingGeometry(0.9, 1, 64);
      g.rotateX(-Math.PI / 2);
      return g;
    })(),
    haz: (() => {
      const g = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
      g.translate(0, 0.5, 0);
      return g;
    })(),
  };
}

const GIRO: Record<Lado, number> = { arriba: Math.PI, abajo: 0, izquierda: -Math.PI / 2, derecha: Math.PI / 2 };

// ── Arma el piso completo ───────────────────────────────────────
function construir(piso: Piso, mesas: Mesa[]): Mundo {
  const grupo = new THREE.Group();
  const liberables: { dispose: () => void }[] = [];
  const geo = geometrias();
  Object.values(geo).forEach((g) => liberables.push(g));
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const clave = color + JSON.stringify(extra);
    let m = mats.get(clave);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02, ...extra });
      mats.set(clave, m);
      liberables.push(m);
    }
    return m;
  };
  const malla = (g: THREE.BufferGeometry, m: THREE.Material, sombra = true) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = sombra;
    x.receiveShadow = true;
    return x;
  };
  const propia = (g: THREE.BufferGeometry) => {
    liberables.push(g);
    return g;
  };
  const textura = (t: THREE.Texture) => {
    liberables.push(t);
    return t;
  };

  const C = piso.columnas;
  const F = piso.filas;
  // Casilla (x, y) del plano → punto en la escena, con el centro del piso en el origen.
  const px = (x: number) => x - C / 2;
  const pz = (y: number) => y - F / 2;

  // Base blanca gruesa, como una maqueta.
  const anchoBase = C + MARGEN * 2;
  const fondoBase = F + MARGEN * 2;
  const base = malla(propia(caja(anchoBase, 0.55, fondoBase, 0, -0.56, 0)), mat("#e9e6e1", { roughness: 0.9 }), false);
  grupo.add(base);
  const canto = malla(propia(caja(anchoBase + 0.02, 0.08, fondoBase + 0.02, 0, -0.64, 0)), mat("#cfcac2"), false);
  grupo.add(canto);

  // Piso de madera (una tabla cada casilla).
  const madera = textura(texMadera());
  madera.wrapS = madera.wrapT = THREE.RepeatWrapping;
  madera.repeat.set(C, F);
  const suelo = new THREE.Mesh(
    propia(new THREE.PlaneGeometry(C, F)),
    new THREE.MeshStandardMaterial({ map: madera, roughness: 0.65 }),
  );
  liberables.push(suelo.material as THREE.Material);
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -0.005;
  suelo.receiveShadow = true;
  grupo.add(suelo);

  if (piso.fondo_url) {
    // Foto o plano real del local, encima del piso con su transparencia.
    const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: (piso.fondo_opacidad ?? 60) / 100, depthWrite: false });
    liberables.push(m);
    new THREE.TextureLoader().setCrossOrigin("anonymous").load(
      piso.fondo_url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        liberables.push(t);
        m.map = t;
        m.needsUpdate = true;
      },
      undefined,
      () => {},
    );
    const foto = new THREE.Mesh(propia(new THREE.PlaneGeometry(C, F)), m);
    foto.rotation.x = -Math.PI / 2;
    foto.position.y = 0.002;
    grupo.add(foto);
  }

  // Nombre del piso en el borde delantero de la base.
  const nombre = new THREE.Mesh(
    propia(new THREE.PlaneGeometry(Math.min(C, 12), Math.min(C, 12) / 8)),
    new THREE.MeshBasicMaterial({ map: textura(texNombre(piso.nombre || "Salón")), transparent: true, depthWrite: false }),
  );
  liberables.push(nombre.material as THREE.Material);
  nombre.rotation.x = -Math.PI / 2;
  nombre.position.set(0, -0.004, F / 2 + MARGEN / 2);
  grupo.add(nombre);

  // Paredes del contorno: las que quedan hacia la cámara se bajan (corte de maqueta) para ver adentro.
  const paredes: Pared[] = [];
  const colorPared = mat("#f1ebe2", { roughness: 0.9 });
  const tapa = mat("#ffffff");
  const grosor = 0.18;
  const contorno: [number, number, number, number, THREE.Vector3][] = [
    [C + grosor * 2, grosor, 0, -F / 2 - grosor / 2, new THREE.Vector3(0, 0, -1)],
    [C + grosor * 2, grosor, 0, F / 2 + grosor / 2, new THREE.Vector3(0, 0, 1)],
    [grosor, F, -C / 2 - grosor / 2, 0, new THREE.Vector3(-1, 0, 0)],
    [grosor, F, C / 2 + grosor / 2, 0, new THREE.Vector3(1, 0, 0)],
  ];
  for (const [w, d, x, z, normal] of contorno) {
    const g = new THREE.Group();
    const muro = malla(propia(caja(w, 1, d)), colorPared);
    const borde = malla(propia(caja(w + 0.01, 0.05, d + 0.01)), tapa, false);
    g.add(muro, borde);
    g.position.set(x, 0, z);
    g.userData = { muro, borde };
    grupo.add(g);
    paredes.push({ mesh: g, normal });
  }

  const etiquetas: Etiqueta[] = [];

  // ── Elementos del plano ──
  const ordenados = [...piso.elementos].sort((a, b) => Number(!!ELEMENTOS[b.tipo]?.suelo) - Number(!!ELEMENTOS[a.tipo]?.suelo));
  for (const el of ordenados) {
    const g = new THREE.Group();
    const w = el.ancho;
    const d = el.alto;
    g.position.set(px(el.x + w / 2), 0, pz(el.y + d / 2));
    const color = el.color ?? ELEMENTOS[el.tipo]?.color;
    let altoTexto = 0.3;
    const losa = (c: string | THREE.Material, h = 0.03, inset = 0) =>
      malla(propia(caja(w - inset, h, d - inset)), typeof c === "string" ? mat(c) : c, false);

    switch (el.tipo) {
      case "pasillo": {
        const t = textura(texRayas("#d9d2c7", "#cfc7bb"));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(w, 1);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
        liberables.push(m);
        g.add(losa(m, 0.02));
        break;
      }
      case "pared": {
        g.add(malla(propia(caja(w, ALTO_PARED, d)), mat(color ?? "#f1ebe2", { roughness: 0.9 })));
        g.add(malla(propia(caja(w + 0.01, 0.05, d + 0.01, 0, ALTO_PARED, 0)), tapa, false));
        altoTexto = ALTO_PARED + 0.2;
        break;
      }
      case "barra": {
        const c = color ?? "#7a4a2a";
        g.add(malla(propia(caja(w - 0.1, 1.0, d - 0.2)), mat(c)));
        g.add(malla(propia(caja(w, 0.07, d, 0, 1.0, 0)), mat(tono(c, -0.35), { roughness: 0.4 })));
        // Botellas y vasos sobre la barra.
        const botellas = Math.max(2, Math.floor(w * 1.2));
        const colores = ["#14532d", "#7c2d12", "#1e3a8a", "#a16207"];
        for (let i = 0; i < botellas; i++) {
          const b = malla(
            propia(cilindro(0.06, 0.06, 0.3, -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, botellas - 1), 1.07, -d / 4, 8)),
            mat(colores[i % colores.length], { roughness: 0.3, transparent: true, opacity: 0.9 }),
          );
          g.add(b);
        }
        altoTexto = 1.5;
        break;
      }
      case "bano": {
        const t = textura(texBaldosa("#dbe7ee", "#c3d5df"));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(w, d);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
        liberables.push(m);
        g.add(losa(m, 0.02));
        // Tabique bajo alrededor, con puerta.
        const tab = mat(color ?? "#7fb3c9");
        g.add(malla(propia(caja(w, 1.4, 0.1, 0, 0, -d / 2 + 0.05)), tab));
        g.add(malla(propia(caja(0.1, 1.4, d, -w / 2 + 0.05, 0, 0)), tab));
        g.add(malla(propia(caja(0.1, 1.4, d, w / 2 - 0.05, 0, 0)), tab));
        g.add(malla(propia(caja(w * 0.55, 1.4, 0.1, -w * 0.225, 0, d / 2 - 0.05)), tab));
        g.add(malla(propia(caja(0.45, 0.4, 0.55, 0, 0, -d / 2 + 0.4)), mat("#ffffff", { roughness: 0.3 })));
        g.add(malla(propia(caja(0.7, 0.12, 0.4, w / 2 - 0.55, 0.75, -d / 2 + 0.3)), mat("#ffffff", { roughness: 0.3 })));
        altoTexto = 1.7;
        break;
      }
      case "cocina": {
        const t = textura(texBaldosa("#e5e7eb", "#d1d5db"));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(w, d);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
        liberables.push(m);
        g.add(losa(m, 0.02));
        const acero = mat("#c7cdd3", { metalness: 0.5, roughness: 0.35 });
        // Mesón al fondo con cocina, campana y estantes; isla al centro con ingredientes.
        g.add(malla(propia(caja(w - 0.2, 0.9, 0.6, 0, 0, -d / 2 + 0.4)), acero));
        g.add(malla(propia(caja(1.2, 0.04, 0.5, -w / 4, 0.9, -d / 2 + 0.4)), mat("#1f2937")));
        for (let i = 0; i < 4; i++)
          g.add(
            malla(
              propia(cilindro(0.1, 0.1, 0.03, -w / 4 - 0.3 + (i % 2) * 0.6, 0.94, -d / 2 + 0.28 + Math.floor(i / 2) * 0.25, 12)),
              mat("#ef4444", { emissive: "#ef4444", emissiveIntensity: 0.6 }),
            ),
          );
        g.add(malla(propia(caja(1.0, 0.35, 0.5, -w / 4, 1.7, -d / 2 + 0.35)), acero));
        if (d >= 3) {
          g.add(malla(propia(caja(Math.min(w - 1.2, 2.4), 0.9, 0.8, 0, 0, 0.3)), acero));
          const ingred = ["#f97316", "#22c55e", "#eab308", "#dc2626"];
          ingred.forEach((c, i) =>
            g.add(malla(propia(caja(0.28, 0.12, 0.28, -0.6 + i * 0.4, 0.9, 0.3)), mat(c, { roughness: 0.6 }))),
          );
        }
        if (w >= 3) g.add(malla(propia(caja(0.7, 1.8, 0.6, w / 2 - 0.5, 0, -d / 2 + 0.4)), mat("#e5e7eb", { metalness: 0.3 })));
        altoTexto = 2.2;
        break;
      }
      case "entrada": {
        g.add(losa(color ?? "#2f6b4f", 0.03));
        const marco = mat("#3f3f46");
        const largo = Math.max(w, d);
        const horizontal = w >= d;
        const off = largo / 2 - 0.08;
        for (const s of [-1, 1])
          g.add(malla(propia(caja(0.14, 2.0, 0.14, horizontal ? s * off : 0, 0, horizontal ? 0 : s * off)), marco));
        g.add(malla(propia(caja(horizontal ? largo : 0.14, 0.14, horizontal ? 0.14 : largo, 0, 2.0, 0)), marco));
        // Alfombra de bienvenida.
        g.add(
          malla(
            propia(caja(horizontal ? largo * 0.6 : 0.8, 0.02, horizontal ? 0.8 : largo * 0.6, 0, 0.03, 0)),
            mat("#9a3412"),
            false,
          ),
        );
        altoTexto = 2.4;
        break;
      }
      case "escalera": {
        const pasos = 7;
        const horizontal = w >= d;
        const largo = horizontal ? w : d;
        for (let i = 0; i < pasos; i++) {
          const l = largo / pasos;
          const h = 0.25 * (i + 1);
          const pos = -largo / 2 + l * (i + 0.5);
          g.add(
            malla(
              propia(caja(horizontal ? l : w, h, horizontal ? d : l, horizontal ? pos : 0, 0, horizontal ? 0 : pos)),
              mat(i % 2 ? "#d6d0c7" : "#e7e1d8"),
            ),
          );
        }
        altoTexto = 2.1;
        break;
      }
      case "caja": {
        const c = color ?? "#6d4c33";
        g.add(malla(propia(caja(w - 0.1, 1.0, d - 0.2)), mat(c)));
        g.add(malla(propia(caja(w, 0.06, d, 0, 1.0, 0)), mat("#f5f5f4")));
        const pantalla = malla(
          propia(caja(0.5, 0.35, 0.04, 0, 1.06, 0)),
          mat("#111827", { emissive: "#60a5fa", emissiveIntensity: 0.4 }),
        );
        pantalla.rotation.x = -0.25;
        g.add(pantalla);
        altoTexto = 1.7;
        break;
      }
      case "planta": {
        g.add(malla(propia(cilindro(0.22, 0.16, 0.35)), mat("#c2410c")));
        const hoja = new THREE.Mesh(
          propia(new THREE.IcosahedronGeometry(0.38, 1)),
          mat(color ?? "#3f9d3f", { flatShading: true }),
        );
        hoja.position.y = 0.72;
        hoja.castShadow = true;
        g.add(hoja);
        altoTexto = 0;
        break;
      }
      case "macetero": {
        g.add(malla(propia(caja(w - 0.1, 0.45, d - 0.15)), mat("#8b5a3c")));
        const n = Math.max(1, Math.round(w));
        for (let i = 0; i < n; i++) {
          const b = new THREE.Mesh(
            propia(new THREE.IcosahedronGeometry(0.32, 1)),
            mat(color ?? "#4d9e3a", { flatShading: true }),
          );
          b.position.set(-w / 2 + (i + 0.5) * (w / n), 0.68, 0);
          b.castShadow = true;
          g.add(b);
        }
        altoTexto = 0;
        break;
      }
      case "farol": {
        g.add(malla(propia(cilindro(0.04, 0.05, 2.2, 0, 0, 0, 8)), mat("#27272a")));
        const luz = new THREE.Mesh(
          propia(new THREE.SphereGeometry(0.16, 16, 12)),
          new THREE.MeshStandardMaterial({ color: color ?? "#fde68a", emissive: color ?? "#fde68a", emissiveIntensity: 1.6 }),
        );
        liberables.push(luz.material as THREE.Material);
        luz.position.y = 2.3;
        g.add(luz);
        altoTexto = 0;
        break;
      }
      case "palmera": {
        const tronco = malla(propia(cilindro(0.09, 0.14, 2.6, 0, 0, 0, 8)), mat("#8b6a43"));
        g.add(tronco);
        const hojas = mat(color ?? "#3f8f2a", { side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const h = malla(propia(caja(0.28, 0.03, 1.2, 0, 0, 0.6)), hojas);
          h.position.y = 2.6;
          h.rotation.set(0.45, (i / 7) * Math.PI * 2, 0, "YXZ");
          g.add(h);
        }
        altoTexto = 0;
        break;
      }
      case "sombrilla": {
        const r = Math.min(w, d) / 2;
        g.add(malla(propia(cilindro(0.04, 0.04, 2.1, 0, 0, 0, 8)), mat("#e5e7eb")));
        const tela = new THREE.Mesh(
          propia(new THREE.ConeGeometry(r, 0.45, 8, 1, true)),
          new THREE.MeshStandardMaterial({
            color: color ?? "#0e7490",
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            flatShading: true,
          }),
        );
        liberables.push(tela.material as THREE.Material);
        tela.position.y = 2.2;
        tela.castShadow = true;
        g.add(tela);
        altoTexto = 0;
        break;
      }
      case "choza": {
        const r = Math.min(w, d) / 2;
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          g.add(malla(propia(cilindro(0.06, 0.06, 2.0, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8, 6)), mat("#7c5a32")));
        }
        const techo = new THREE.Mesh(
          propia(new THREE.ConeGeometry(r * 1.1, 0.9, 12, 1, true)),
          new THREE.MeshStandardMaterial({
            color: color ?? "#c69a5a",
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            flatShading: true,
          }),
        );
        liberables.push(techo.material as THREE.Material);
        techo.position.y = 2.4;
        techo.castShadow = true;
        g.add(techo);
        altoTexto = 3;
        break;
      }
      case "toldo": {
        const t = textura(texRayas(color ?? "#b91c1c", "#fff7ed"));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(w / 1.5, 1);
        const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, opacity: 0.35, roughness: 0.9 });
        liberables.push(m);
        g.add(losa(m, 0.012));
        // Postes en las esquinas y un faldón con rayas al frente.
        for (const sx of [-1, 1])
          for (const sz of [-1, 1])
            g.add(malla(propia(cilindro(0.04, 0.04, 2.0, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 6)), mat("#3f3f46")));
        const m2 = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide });
        liberables.push(m2);
        g.add(malla(propia(caja(w, 0.3, 0.04, 0, 1.75, d / 2 - 0.1)), m2));
        altoTexto = 0.3;
        break;
      }
      case "vereda": {
        const t = textura(texBaldosa("#b9b3ab", "#aaa39a"));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(w / 2, d / 2);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
        liberables.push(m);
        g.add(losa(m, 0.04));
        break;
      }
      case "calle": {
        g.add(losa("#3f3f46", 0.03));
        const n = Math.max(1, Math.floor(Math.max(w, d) / 1.5));
        const horizontal = w >= d;
        for (let i = 0; i < n; i++) {
          const p = -Math.max(w, d) / 2 + (i + 0.5) * (Math.max(w, d) / n);
          g.add(
            malla(
              propia(caja(horizontal ? 0.6 : 0.08, 0.005, horizontal ? 0.08 : 0.6, horizontal ? p : 0, 0.03, horizontal ? 0 : p)),
              mat("#facc15"),
              false,
            ),
          );
        }
        break;
      }
      case "arena":
        g.add(losa(color ?? "#e8cf9c", 0.04));
        break;
      case "deck": {
        const t = textura(texMadera());
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(w, d);
        const m = new THREE.MeshStandardMaterial({ map: t, color: color ?? "#a0683c", roughness: 0.7 });
        liberables.push(m);
        g.add(losa(m, 0.06));
        break;
      }
      case "mar": {
        const m = new THREE.MeshStandardMaterial({
          color: color ?? "#38bdf8",
          roughness: 0.15,
          metalness: 0.1,
          transparent: true,
          opacity: 0.85,
        });
        liberables.push(m);
        g.add(losa(m, 0.02));
        break;
      }
      default:
        g.add(malla(propia(caja(w, 0.6, d)), mat(color ?? "#a8a29e")));
    }

    if (el.asientos && el.asientos.n > 0) {
      const lado = el.asientos.lado;
      const horizontal = lado === "arriba" || lado === "abajo";
      const largo = horizontal ? w : d;
      const geom = el.asientos.tipo === "taburete" ? geo.taburete : geo.silla;
      const m = mat("#c9894b");
      for (let i = 0; i < el.asientos.n; i++) {
        const t = -largo / 2 + (i + 0.5) * (largo / el.asientos.n);
        const s = malla(geom, m);
        const sep = 0.35;
        s.position.set(
          horizontal ? t : lado === "izquierda" ? -w / 2 - sep : w / 2 + sep,
          0,
          horizontal ? (lado === "arriba" ? -d / 2 - sep : d / 2 + sep) : t,
        );
        s.rotation.y = GIRO[lado];
        if (el.asientos.tipo === "silla") s.scale.y = 1.5;
        g.add(s);
      }
    }

    grupo.add(g);
    const sinTexto =
      ["planta", "farol", "palmera", "sombrilla", "macetero"].includes(el.tipo) || (el.tipo === "pared" && !el.texto);
    if (!sinTexto)
      etiquetas.push({
        id: `el:${el.id}`,
        pos: new THREE.Vector3(g.position.x, altoTexto, g.position.z),
        texto: el.texto || ELEMENTOS[el.tipo]?.texto,
      });
  }

  // ── Mesas ──
  const manijas = new Map<string, Manija>();
  const alphaHaz = textura(texHaz());
  for (const m of mesas) {
    if (m.piso_id !== piso.id) continue;
    const w = m.ancho ?? 2;
    const d = m.alto ?? 2;
    const g = new THREE.Group();
    g.position.set(px((m.x ?? 0) + w / 2), 0, pz((m.y ?? 0) + d / 2));
    g.userData.mesaId = m.id;

    const tablero = new THREE.MeshStandardMaterial({ color: m.color ?? MADERA, roughness: 0.55 });
    const sillas = new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.6 });
    liberables.push(tablero, sillas);
    const redonda = m.forma === "redonda";
    const tw = Math.max(0.7, w - 0.75);
    const td = Math.max(0.7, d - 0.75);
    const radio = Math.max(0.4, Math.min(w, d) / 2 - 0.38);

    if (redonda) {
      g.add(malla(propia(cilindro(radio, radio, 0.06, 0, ALTO_MESA, 0, 36)), tablero));
      g.add(malla(geo.pataMesa, mat("#3f3f46")));
    } else {
      g.add(malla(propia(caja(tw, 0.06, td, 0, ALTO_MESA, 0)), tablero));
      const patas = mat("#3f3f46");
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          g.add(malla(propia(cilindro(0.03, 0.03, ALTO_MESA, sx * (tw / 2 - 0.08), 0, sz * (td / 2 - 0.08), 6)), patas));
    }
    // Detalle sobre la mesa: un florero chico.
    g.add(malla(propia(cilindro(0.04, 0.05, 0.14, 0, ALTO_MESA + 0.06, 0, 8)), mat("#e5e7eb", { roughness: 0.3 })));

    const conf = m.sillas && Object.keys(m.sillas).length ? m.sillas : sillasAutomaticas(m.forma, m.capacidad ?? 4, w, d);
    const pon = (geom: THREE.BufferGeometry, x: number, z: number, giro: number) => {
      const s = malla(geom, sillas);
      s.position.set(x, 0, z);
      s.rotation.y = giro;
      g.add(s);
    };
    if (redonda) {
      const todas: LadoSillas = conf.alrededor ?? { tipo: "silla", n: Object.values(conf).reduce((t, l) => t + (l?.n ?? 0), 0) };
      const n = Math.min(todas.n, 24);
      const geom = todas.tipo === "taburete" ? geo.taburete : todas.tipo === "sillon" ? geo.sillon : geo.silla;
      const r = radio + (todas.tipo === "sillon" ? 0.42 : 0.28);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pon(geom, Math.cos(a) * r, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)));
      }
    } else {
      for (const lado of ["arriba", "abajo", "izquierda", "derecha"] as Lado[]) {
        const c = conf[lado];
        if (!c?.n) continue;
        const horizontal = lado === "arriba" || lado === "abajo";
        const largo = horizontal ? tw : td;
        const sep = c.tipo === "sillon" || c.tipo === "banca" ? 0.42 : 0.28;
        const fijo = horizontal
          ? lado === "arriba"
            ? -td / 2 - sep
            : td / 2 + sep
          : lado === "izquierda"
            ? -tw / 2 - sep
            : tw / 2 + sep;
        if (c.tipo === "banca" || c.tipo === "sillon") {
          // Banca o sillón corrido: ocupa todo el lado.
          const l = largo * 0.95;
          const geom = propia(
            c.tipo === "sillon"
              ? unir([caja(l, 0.24, 0.55, 0, 0.12, 0), caja(l, 0.55, 0.15, 0, 0.12, 0.22)])
              : unir([caja(l, 0.07, 0.4, 0, 0.42, 0), caja(l, 0.42, 0.08, 0, 0, -0.12), caja(l, 0.42, 0.08, 0, 0, 0.12)]),
          );
          pon(geom, horizontal ? 0 : fijo, horizontal ? fijo : 0, GIRO[lado]);
        } else {
          const geom = c.tipo === "taburete" ? geo.taburete : geo.silla;
          const n = Math.min(c.n, 24);
          for (let i = 0; i < n; i++) {
            const t = -largo / 2 + (i + 0.5) * (largo / n);
            pon(geom, horizontal ? t : fijo, horizontal ? fijo : t, GIRO[lado]);
          }
        }
      }
    }

    // Anillo en el piso (estado), onda que se expande (aviso) y haz de luz (necesita atención).
    const anillo = new THREE.Mesh(
      geo.anillo,
      new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0, depthWrite: false }),
    );
    const onda = new THREE.Mesh(
      geo.anillo,
      new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0, depthWrite: false }),
    );
    const escala = redonda ? [radio + 0.75, radio + 0.75] : [tw / 2 + 0.7, td / 2 + 0.7];
    for (const a of [anillo, onda]) {
      a.position.y = 0.02;
      a.scale.set(escala[0], 1, escala[1]);
      a.renderOrder = 2;
      g.add(a);
      liberables.push(a.material);
    }
    onda.userData.base = escala;
    const haz = new THREE.Mesh(
      geo.haz,
      new THREE.MeshBasicMaterial({
        color: "#fff",
        transparent: true,
        opacity: 0,
        alphaMap: alphaHaz,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const rh = redonda ? radio * 0.8 : Math.min(tw, td) / 2;
    haz.scale.set(rh, 4.5, rh);
    haz.position.y = ALTO_MESA;
    haz.visible = false;
    haz.renderOrder = 3;
    g.add(haz);
    liberables.push(haz.material);

    grupo.add(g);
    manijas.set(m.id, {
      mesa: m,
      centro: new THREE.Vector3(g.position.x, ALTO_MESA + 0.5, g.position.z),
      grupo: g,
      sillas,
      tablero,
      anillo,
      onda,
      haz,
      fase: Math.random(),
      visual: { color: "#6b7280", nivel: 0, clave: null },
      marca: false,
      apagada: false,
    });
    etiquetas.push({ id: m.id, pos: new THREE.Vector3(g.position.x, ALTO_MESA + 0.55, g.position.z) });
  }

  return {
    grupo,
    manijas,
    etiquetas,
    paredes,
    tamano: { ancho: C, fondo: F },
    liberar: () => liberables.forEach((l) => l.dispose()),
  };
}

// Minutos abiertos, corto: "40′", "3 h 5′", "9 d".
function tiempo(min?: number) {
  const m = Math.max(0, Math.round(min ?? 0));
  if (m < 60) return `${m}′`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}′` : ""}`;
  return `${Math.floor(m / 1440)} d`;
}

// ── Componente ─────────────────────────────────────────────────
type Toast = { id: number; mesaId: string; clave: string; mesa: string };

export default function Maqueta({
  piso,
  mesas,
  estados,
  seleccion,
  onAbrirMesa,
  formato,
  alto,
  onSinSoporte,
}: {
  piso: Piso;
  mesas: Mesa[];
  estados: Map<string, EstadoMesa>;
  seleccion: Seleccion;
  onAbrirMesa: (id: string) => void;
  formato: (n: number) => string;
  alto?: string;
  onSinSoporte?: () => void;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const etiquetasDom = useRef(new Map<string, HTMLElement>());
  const motor = useRef<{
    renderer: THREE.WebGLRenderer;
    escena: THREE.Scene;
    camara: THREE.OrthographicCamera;
    controles: OrbitControls;
    sol: THREE.DirectionalLight;
    mundo: Mundo | null;
    sucio: boolean;
    giro: { desde: number; hasta: number; inicio: number } | null;
    encuadrar: () => void;
    pisoId: string | null;
  } | null>(null);
  const abrir = useRef(onAbrirMesa);
  abrir.current = onAbrirMesa;
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ayuda, setAyuda] = useState(true);
  const anteriores = useRef<Map<string, string | null> | null>(null);

  // Clave de lo que cambia la forma del piso (no el estado de las mesas): si no cambia, no se rearma la escena.
  const enPiso = useMemo(() => mesas.filter((m) => m.piso_id === piso.id), [mesas, piso.id]);
  const forma = useMemo(
    () =>
      JSON.stringify([
        piso.id,
        piso.nombre,
        piso.columnas,
        piso.filas,
        piso.elementos,
        piso.fondo_url,
        piso.fondo_opacidad,
        enPiso.map((m) => [m.id, m.numero, m.x, m.y, m.ancho, m.alto, m.forma, m.capacidad, m.color, m.sillas]),
      ]),
    [piso, enPiso],
  );

  // Arranque del motor (una vez).
  useEffect(() => {
    const cont = marco.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
    } catch {
      onSinSoporte?.();
      return;
    }
    const tactil = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tactil ? 1.75 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";
    cont.prepend(renderer.domElement);

    const escena = new THREE.Scene();
    escena.add(new THREE.HemisphereLight("#fffaf0", "#b9a68f", 1.4));
    const sol = new THREE.DirectionalLight("#fff1dc", 2.4);
    sol.castShadow = true;
    sol.shadow.mapSize.set(tactil ? 1024 : 2048, tactil ? 1024 : 2048);
    sol.shadow.bias = -0.0004;
    sol.shadow.radius = 3;
    sol.shadow.normalBias = 0.02;
    escena.add(sol, sol.target);

    const camara = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.12;
    controles.minPolarAngle = 0.25;
    controles.maxPolarAngle = 1.2;
    controles.minZoom = 0.6;
    controles.maxZoom = 5;
    controles.screenSpacePanning = true;
    controles.zoomToCursor = true;

    const m = {
      renderer,
      escena,
      camara,
      controles,
      sol,
      mundo: null as Mundo | null,
      sucio: true,
      giro: null as { desde: number; hasta: number; inicio: number } | null,
      encuadrar: () => {},
      pisoId: null as string | null,
    };

    // Encaja todo el piso en el recuadro según el ángulo actual.
    m.encuadrar = () => {
      const { clientWidth: W, clientHeight: H } = cont;
      if (!W || !H || !m.mundo) return;
      const { ancho, fondo } = m.mundo.tamano;
      camara.updateMatrixWorld();
      let ex = 0;
      let ey = 0;
      const p = new THREE.Vector3();
      for (const x of [-ancho / 2 - MARGEN, ancho / 2 + MARGEN])
        for (const z of [-fondo / 2 - MARGEN, fondo / 2 + MARGEN])
          for (const y of [-0.6, ALTO_PARED]) {
            p.set(x, y, z).applyMatrix4(camara.matrixWorldInverse);
            ex = Math.max(ex, Math.abs(p.x));
            ey = Math.max(ey, Math.abs(p.y));
          }
      const aspecto = W / H;
      const medio = Math.max(ey, ex / aspecto) * 1.06;
      camara.left = -medio * aspecto;
      camara.right = medio * aspecto;
      camara.top = medio;
      camara.bottom = -medio;
      camara.updateProjectionMatrix();
      m.sucio = true;
    };

    const ajustar = () => {
      const { clientWidth: W, clientHeight: H } = cont;
      if (!W || !H) return;
      renderer.setSize(W, H, false);
      renderer.domElement.style.width = `${W}px`;
      renderer.domElement.style.height = `${H}px`;
      m.encuadrar();
    };
    const obs = new ResizeObserver(ajustar);
    obs.observe(cont);

    controles.addEventListener("change", () => {
      // El centro no se escapa del piso al arrastrar con dos dedos.
      if (m.mundo) {
        const { ancho, fondo } = m.mundo.tamano;
        controles.target.x = THREE.MathUtils.clamp(controles.target.x, -ancho / 2, ancho / 2);
        controles.target.z = THREE.MathUtils.clamp(controles.target.z, -fondo / 2, fondo / 2);
        controles.target.y = 0;
      }
      m.sucio = true;
    });
    controles.addEventListener("start", () => setAyuda(false));

    // Tocar una mesa (sin arrastrar) abre su ficha.
    const ray = new THREE.Raycaster();
    let toque: { x: number; y: number } | null = null;
    const bajar = (e: PointerEvent) => (toque = { x: e.clientX, y: e.clientY });
    const subir = (e: PointerEvent) => {
      if (!toque || !m.mundo) return;
      const movio = Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 6;
      toque = null;
      if (movio) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
        camara,
      );
      const grupos = [...m.mundo.manijas.values()].map((h) => h.grupo);
      for (const hit of ray.intersectObjects(grupos, true)) {
        if (hit.object === m.mundo.manijas.get(hit.object.parent?.userData.mesaId)?.haz) continue;
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.mesaId) o = o.parent;
        if (o) {
          abrir.current(o.userData.mesaId);
          return;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", bajar);
    renderer.domElement.addEventListener("pointerup", subir);

    // Bucle: anima solo si hay algo que animar o la cámara se movió.
    const v = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    let cuadro = 0;
    const animar = () => {
      cuadro = requestAnimationFrame(animar);
      const t = performance.now() / 1000;
      if (m.giro) {
        const k = Math.min(1, (performance.now() - m.giro.inicio) / 500);
        const suave = 1 - Math.pow(1 - k, 3);
        const off = camara.position.clone().sub(controles.target);
        const esf = new THREE.Spherical().setFromVector3(off);
        esf.theta = m.giro.desde + (m.giro.hasta - m.giro.desde) * suave;
        camara.position.copy(controles.target).add(new THREE.Vector3().setFromSpherical(esf));
        camara.lookAt(controles.target);
        if (k >= 1) m.giro = null;
        m.sucio = true;
      }
      controles.update();
      const mundo = m.mundo;
      let animado = false;
      if (mundo) {
        for (const h of mundo.manijas.values()) {
          const { nivel } = h.visual;
          if (nivel === 0 && !h.marca) {
            h.anillo.material.opacity = 0;
            h.onda.material.opacity = 0;
            h.haz.visible = false;
            continue;
          }
          animado = animado || nivel === 2 || h.marca;
          const pulso = (Math.sin(t * 4 + h.fase * 6) + 1) / 2;
          h.anillo.material.opacity = (nivel === 2 || h.marca ? 0.55 + 0.4 * pulso : 0.75) * (h.apagada ? 0.3 : 1);
          if (nivel === 2 || h.marca) {
            const f = (t * 0.7 + h.fase) % 1;
            const [bx, bz] = h.onda.userData.base as number[];
            h.onda.scale.set(bx * (1 + f * 0.9), 1, bz * (1 + f * 0.9));
            h.onda.material.opacity = (1 - f) * 0.8 * (h.apagada ? 0.3 : 1);
          } else h.onda.material.opacity = 0;
          h.haz.visible = nivel === 2 && !h.apagada;
          if (h.haz.visible) h.haz.material.opacity = 0.45 + 0.35 * pulso;
        }
        // Corte de maqueta: las paredes del lado de la cámara quedan bajitas.
        camara.getWorldDirection(camDir);
        for (const p of mundo.paredes) {
          const hacia = p.normal.dot(camDir) < -0.15 ? 0 : 1;
          const { muro, borde } = p.mesh.userData as { muro: THREE.Mesh; borde: THREE.Mesh };
          const objetivo = hacia ? ALTO_PARED : 0.3;
          const actual = muro.scale.y;
          if (Math.abs(actual - objetivo) > 0.01) {
            muro.scale.y = actual + (objetivo - actual) * 0.2;
            borde.position.y = muro.scale.y;
            animado = true;
          } else if (actual !== objetivo) {
            muro.scale.y = objetivo;
            borde.position.y = objetivo;
          }
        }
      }
      if (!animado && !m.sucio) return;
      m.sucio = false;
      renderer.render(escena, camara);
      // Etiquetas HTML sobre cada mesa: siguen la cámara.
      if (mundo) {
        const W = cont.clientWidth;
        const H = cont.clientHeight;
        // Tamaño de las etiquetas según cuántos píxeles mide una casilla: de lejos (o en el celular) se achican y
        // muestran solo el número, para que no se tapen entre ellas.
        const ppc = (H / (camara.top - camara.bottom)) * camara.zoom;
        const escala = THREE.MathUtils.clamp(ppc / 42, 0.6, 1.25);
        const compacto = ppc < 34 ? "1" : "0";
        if (cont.dataset.compacto !== compacto) cont.dataset.compacto = compacto;
        for (const e of mundo.etiquetas) {
          const dom = etiquetasDom.current.get(e.id);
          if (!dom) continue;
          v.copy(e.pos).project(camara);
          const fuera = v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1;
          dom.style.visibility = fuera ? "hidden" : "visible";
          dom.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -100%) scale(${escala})`;
        }
      }
    };
    animar();

    motor.current = m;
    ajustar();
    return () => {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      controles.dispose();
      renderer.domElement.removeEventListener("pointerdown", bajar);
      renderer.domElement.removeEventListener("pointerup", subir);
      m.mundo?.liberar();
      renderer.dispose();
      renderer.domElement.remove();
      motor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rearma la escena cuando cambia el piso (mesas movidas, elementos, otro piso).
  useEffect(() => {
    const m = motor.current;
    if (!m) return;
    const nuevo = construir(piso, mesas);
    if (m.mundo) {
      m.escena.remove(m.mundo.grupo);
      m.mundo.liberar();
    }
    m.mundo = nuevo;
    m.escena.add(nuevo.grupo);
    const { ancho, fondo } = nuevo.tamano;
    const lado = Math.max(ancho, fondo);
    m.sol.position.set(ancho * 0.35, lado * 1.2 + 6, fondo * 0.6);
    const sc = m.sol.shadow.camera;
    sc.left = sc.bottom = -lado * 0.8 - 2;
    sc.right = sc.top = lado * 0.8 + 2;
    sc.far = lado * 4 + 30;
    sc.updateProjectionMatrix();
    // Al cambiar de piso, vuelve a la vista inicial; si solo cambió una mesa, deja la cámara donde estaba.
    if (m.pisoId !== piso.id) {
      m.pisoId = piso.id;
      vistaInicial(m, lado);
    }
    m.encuadrar();
    setEtiquetas(nuevo.etiquetas);
    m.sucio = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forma]);

  // Estado de cada mesa: colores, luces y avisos nuevos.
  useEffect(() => {
    const m = motor.current;
    if (!m?.mundo) return;
    const marcada = seleccion?.tipo === "mesa" ? seleccion.id : null;
    const nuevos: Toast[] = [];
    const vistas = new Map<string, string | null>();
    for (const [id, h] of m.mundo.manijas) {
      const est = estados.get(id);
      const vis = visualDe(est);
      h.visual = vis;
      h.marca = id === marcada || !!est?.destacada;
      h.apagada = !!est?.apagada;
      const colorAnillo = h.marca && vis.nivel === 0 ? (est?.destacada ? "#38bdf8" : "#ffffff") : vis.color;
      h.anillo.material.color.set(colorAnillo);
      h.onda.material.color.set(colorAnillo);
      h.haz.material.color.set(vis.color);
      h.sillas.color.set(vis.nivel === 0 ? "#78716c" : vis.color);
      h.tablero.emissive.set(vis.nivel === 0 ? "#000000" : vis.color);
      h.tablero.emissiveIntensity = vis.nivel === 2 ? 0.25 : vis.nivel === 1 ? 0.08 : 0;
      h.tablero.opacity = h.apagada ? 0.35 : 1;
      h.tablero.transparent = h.apagada;
      vistas.set(id, vis.clave);
      const antes = anteriores.current?.get(id);
      if (anteriores.current && vis.clave && antes !== vis.clave)
        nuevos.push({ id: Date.now() + Math.random(), mesaId: id, clave: vis.clave, mesa: nombreMesa(h.mesa.numero) });
    }
    anteriores.current = vistas;
    m.sucio = true;
    if (nuevos.length) setToasts((t) => [...nuevos, ...t].slice(0, 3));
  }, [estados, seleccion, forma]);

  // Cada aviso se va solo a los 8 segundos.
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((l) => l.slice(0, -1)), 8000);
    return () => clearTimeout(t);
  }, [toasts]);

  const girar = (sentido: 1 | -1) => {
    const m = motor.current;
    if (!m) return;
    const esf = new THREE.Spherical().setFromVector3(m.camara.position.clone().sub(m.controles.target));
    const desde = m.giro ? m.giro.hasta : esf.theta;
    m.giro = { desde: esf.theta, hasta: desde + (sentido * Math.PI) / 2, inicio: performance.now() };
    setAyuda(false);
  };
  const zoom = (f: number) => {
    const m = motor.current;
    if (!m) return;
    m.camara.zoom = THREE.MathUtils.clamp(m.camara.zoom * f, m.controles.minZoom, m.controles.maxZoom);
    m.camara.updateProjectionMatrix();
    m.sucio = true;
  };
  const centrar = () => {
    const m = motor.current;
    if (!m?.mundo) return;
    vistaInicial(m, Math.max(m.mundo.tamano.ancho, m.mundo.tamano.fondo));
    m.encuadrar();
  };

  return (
    <div
      ref={marco}
      // tema-fijo: con el tema oscuro del panel, las etiquetas y botones blancos no se invierten.
      className="tema-fijo relative w-full overflow-hidden rounded-2xl border border-slate-700"
      style={{
        height: `calc(${alto ?? "100vh - 16rem"})`,
        minHeight: 380,
        background: "radial-gradient(ellipse at 50% 40%, #4b5563 0%, #2b313b 55%, #1d2128 100%)",
      }}
    >
      {/* Etiquetas sobre las mesas y los elementos (se mueven con la cámara). */}
      <div className="pointer-events-none absolute inset-0">
        {etiquetas.map((e) => {
          if (e.id.startsWith("el:"))
            return (
              <span
                key={e.id}
                ref={(n) => {
                  if (n) etiquetasDom.current.set(e.id, n);
                  else etiquetasDom.current.delete(e.id);
                }}
                className="maqueta-el absolute left-0 top-0 origin-bottom whitespace-nowrap rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-700 shadow"
                style={{ visibility: "hidden" }}
              >
                {e.texto}
              </span>
            );
          const mesa = enPiso.find((x) => x.id === e.id);
          if (!mesa) return null;
          const est = estados.get(e.id);
          const vis = visualDe(est);
          return (
            <button
              key={e.id}
              type="button"
              ref={(n) => {
                if (n) etiquetasDom.current.set(e.id, n);
                else etiquetasDom.current.delete(e.id);
              }}
              onClick={() => onAbrirMesa(e.id)}
              className={`pointer-events-auto absolute left-0 top-0 origin-bottom transition-opacity ${est?.apagada ? "opacity-35" : ""}`}
              style={{ visibility: "hidden" }}
              aria-label={`${nombreMesa(mesa.numero)}${est?.ocupada ? ", ocupada" : ", libre"}`}
            >
              <span
                className="relative flex flex-col items-center rounded-xl border-2 bg-white/95 px-2 py-0.5 leading-tight text-stone-900 shadow-lg"
                style={{ borderColor: vis.nivel ? vis.color : "#d6d3d1" }}
              >
                <span className="text-base font-extrabold" style={{ color: "#1c1917" }}>
                  {mesa.numero}
                </span>
                {est?.unida ? (
                  <span className="maqueta-sub text-[9px] font-semibold text-stone-500">unida</span>
                ) : est?.ocupada ? (
                  <span className="maqueta-sub text-[9px] tabular-nums text-stone-600" suppressHydrationWarning>
                    {est.comensales}/{mesa.capacidad ?? 4} · {tiempo(est.minutos)}
                    {est.total ? ` · ${formato(est.total)}` : ""}
                  </span>
                ) : null}
                {vis.clave && (
                  <span
                    className={`absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow ${
                      vis.clave === "pago" || vis.clave === "listo" ? "" : "animate-pulse"
                    }`}
                    style={{ background: vis.color }}
                  >
                    {vis.clave === "cuenta" || vis.clave === "pago"
                      ? "$"
                      : vis.clave === "mozo"
                        ? "!"
                        : vis.clave === "pendiente"
                          ? "●"
                          : "✓"}
                  </span>
                )}
                {est?.grupo && (
                  <span className="absolute -left-2 -top-2 rounded-full bg-marca px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow">
                    {est.grupo}
                  </span>
                )}
                {est?.mesero && (
                  <span className={`absolute -bottom-2 -left-2 ${est.ocupada ? "" : "opacity-60"}`}>
                    <Avatar persona={est.mesero} className="h-4 w-4 text-[7px] shadow" />
                  </span>
                )}
              </span>
              <span className="mx-auto block h-2 w-0.5 bg-white/80" aria-hidden />
            </button>
          );
        })}
      </div>

      {/* Controles de la cámara. */}
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[
          { t: "⟲", f: () => girar(-1), a: "Girar a la izquierda" },
          { t: "⟳", f: () => girar(1), a: "Girar a la derecha" },
          { t: "+", f: () => zoom(1.3), a: "Acercar" },
          { t: "−", f: () => zoom(1 / 1.3), a: "Alejar" },
          { t: "⌂", f: centrar, a: "Volver a la vista inicial" },
        ].map((b) => (
          <button
            key={b.a}
            type="button"
            onClick={b.f}
            title={b.a}
            aria-label={b.a}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg font-bold shadow-md ring-1 ring-black/10"
            style={{ color: "#1c1917", background: "#ffffff" }}
          >
            {b.t}
          </button>
        ))}
      </div>

      {ayuda && (
        <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white">
          <span className="sm:hidden">Arrastra para girar · pellizca para acercar</span>
          <span className="hidden sm:inline">Arrastra para girar · usa la rueda para acercar · toca una mesa para abrirla</span>
        </p>
      )}

      {/* Avisos nuevos, con animación de entrada. */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col items-center gap-2">
        {toasts.map((t) => {
          const a = AVISOS[t.clave];
          if (!a) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onAbrirMesa(t.mesaId);
                setToasts((l) => l.filter((x) => x.id !== t.id));
              }}
              className="maqueta-aviso pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/90 px-3 py-2 text-left text-white shadow-2xl backdrop-blur"
              style={{ borderLeft: `4px solid ${visualDe(estados.get(t.mesaId)).color}` }}
            >
              <span className="text-2xl" aria-hidden>
                {a.icono}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.titulo(t.mesa)}</span>
                <span className="block truncate text-xs text-stone-400">{a.detalle}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-stone-400">Ahora</span>
            </button>
          );
        })}
      </div>
      <style>{`
        .maqueta-aviso { animation: maqueta-entra .45s cubic-bezier(.2,.9,.3,1.3); }
        @keyframes maqueta-entra { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        [data-compacto="1"] .maqueta-sub { display: none; }
        [data-compacto="1"] .maqueta-el { opacity: .75; }
        @media (prefers-reduced-motion: reduce) { .maqueta-aviso { animation: none; } }
      `}</style>
    </div>
  );
}

// Vista isométrica de entrada: en diagonal, desde adelante a la derecha.
function vistaInicial(
  m: { camara: THREE.OrthographicCamera; controles: OrbitControls; sucio: boolean; giro: unknown; mundo: Mundo | null },
  lado: number,
) {
  m.giro = null;
  m.controles.target.set(0, 0, 0);
  // En una pantalla vertical (celular) el lado largo del piso queda hacia el fondo y se mira más desde arriba,
  // así el local llena la pantalla.
  const el = m.controles.domElement as HTMLElement | null;
  const vertical = !!el && el.clientHeight > el.clientWidth * 1.1;
  const t = m.mundo?.tamano;
  const girar = vertical && !!t && t.ancho > t.fondo;
  const esf = new THREE.Spherical(lado * 2 + 20, vertical ? 0.8 : 0.95, Math.PI / 5 + (girar ? Math.PI / 2 : 0));
  m.camara.position.setFromSpherical(esf);
  m.camara.zoom = 1;
  m.camara.lookAt(0, 0, 0);
  m.camara.updateProjectionMatrix();
  m.controles.update();
  m.sucio = true;
}
