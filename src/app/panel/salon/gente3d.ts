// Gente de la vista "Maqueta": comensales sentados en las sillas de cada mesa (tantos como la cuenta diga), el
// mesero de pie junto a la mesa que lo llama y platos con copas cuando la mesa ya pidió. Personajes propios,
// armados con formas simples (cápsulas y esferas), en dos estilos: silueta negra o con ropa de colores.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type EstiloGente = "silueta" | "colores";
export type PrefGente = { comensales: boolean; estilo: EstiloGente; mesero: boolean; platos: boolean };
export const PREF_GENTE: PrefGente = { comensales: true, estilo: "colores", mesero: true, platos: true };
const CLAVE = "salon:maqueta:gente";

export function leerPrefGente(): PrefGente {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<PrefGente> | null;
    return { ...PREF_GENTE, ...(g ?? {}) };
  } catch {
    return PREF_GENTE;
  }
}
export function guardarPrefGente(p: PrefGente) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura hasta recargar.
  }
}

// Un lugar donde se puede sentar alguien, en coordenadas de la mesa. giro: hacia dónde mira la persona
// (giro 0 = mira hacia -Z). alcance: distancia hasta el punto del tablero donde va su plato.
export type Asiento = { x: number; z: number; giro: number; alto: number; alcance: number };

type Mat = (color: string, extra?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;

// ── Geometrías (una vez por maqueta, compartidas por todas las personas) ──
type Pieza = { g: THREE.BufferGeometry; p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] };
function juntar(piezas: Pieza[]) {
  const listas = piezas.map(({ g, p, r, s }) => {
    if (s) g.scale(...s);
    if (r) g.rotateX(r[0]).rotateY(r[1]).rotateZ(r[2]);
    if (p) g.translate(...p);
    return g.index ? g.toNonIndexed() : g;
  });
  const out = mergeGeometries(listas)!;
  listas.forEach((g) => g.dispose());
  return out;
}
const capsula = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);
const esfera = (r: number) => new THREE.SphereGeometry(r, 16, 12);
const casco = (r: number) => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);

export function geometriasGente() {
  // Sentado en una silla de asiento a 0,48 m, mirando hacia -Z (hacia la mesa), con los antebrazos en el tablero.
  const sentado = {
    ropa: juntar([
      { g: capsula(0.13, 0.24), s: [1.12, 1, 0.8], r: [-0.08, 0, 0], p: [0, 0.79, 0.05] },
      { g: capsula(0.048, 0.17), r: [1.0, 0, 0], p: [-0.175, 0.875, -0.11] },
      { g: capsula(0.048, 0.17), r: [1.0, 0, 0], p: [0.175, 0.875, -0.11] },
      { g: capsula(0.045, 0.12), r: [Math.PI / 2, 0, 0], p: [-0.165, 0.85, -0.3] },
      { g: capsula(0.045, 0.12), r: [Math.PI / 2, 0, 0], p: [0.165, 0.85, -0.3] },
    ]),
    piel: juntar([
      { g: esfera(0.11), p: [0, 1.12, 0.02] },
      { g: esfera(0.045), p: [-0.15, 0.855, -0.41] },
      { g: esfera(0.045), p: [0.15, 0.855, -0.41] },
    ]),
    pantalon: juntar([
      { g: capsula(0.062, 0.24), r: [Math.PI / 2, 0, 0], p: [-0.075, 0.53, -0.1] },
      { g: capsula(0.062, 0.24), r: [Math.PI / 2, 0, 0], p: [0.075, 0.53, -0.1] },
      { g: capsula(0.055, 0.34), p: [-0.075, 0.27, -0.24] },
      { g: capsula(0.055, 0.34), p: [0.075, 0.27, -0.24] },
    ]),
    pelo: juntar([{ g: casco(0.118), r: [0.35, 0, 0], p: [0, 1.125, 0.025] }]),
  };
  // De pie, mirando hacia -Z, con una libreta en la mano derecha.
  const parado = {
    ropa: juntar([
      { g: capsula(0.14, 0.3), s: [1.1, 1, 0.8], p: [0, 1.12, 0] },
      { g: capsula(0.05, 0.42), r: [0, 0, 0.08], p: [-0.2, 1.06, 0] },
      { g: capsula(0.05, 0.2), p: [0.2, 1.18, 0] },
      { g: capsula(0.045, 0.2), r: [Math.PI / 2, 0, 0], p: [0.2, 1.03, -0.14] },
    ]),
    piel: juntar([
      { g: esfera(0.12), p: [0, 1.52, 0] },
      { g: esfera(0.048), p: [-0.22, 0.8, 0] },
      { g: esfera(0.048), p: [0.2, 1.03, -0.29] },
    ]),
    pantalon: juntar([
      { g: capsula(0.065, 0.62), p: [-0.08, 0.4, 0] },
      { g: capsula(0.065, 0.62), p: [0.08, 0.4, 0] },
    ]),
    pelo: juntar([{ g: casco(0.128), r: [0.35, 0, 0], p: [0, 1.525, 0.005] }]),
    delantal: juntar([{ g: new THREE.BoxGeometry(0.34, 0.5, 0.02), p: [0, 0.78, -0.12] }]),
    libreta: juntar([{ g: new THREE.BoxGeometry(0.12, 0.015, 0.16), p: [0.15, 1.08, -0.3] }]),
  };
  const plato = juntar([{ g: new THREE.CylinderGeometry(0.1, 0.08, 0.018, 20), p: [0, 0.009, 0] }]);
  const comida = juntar([{ g: new THREE.SphereGeometry(0.055, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), s: [1, 0.6, 1], p: [0, 0.018, 0] }]);
  const copa = juntar([
    { g: new THREE.CylinderGeometry(0.04, 0.025, 0.07, 12), p: [0, 0.1, 0] },
    { g: new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), p: [0, 0.035, 0] },
    { g: new THREE.CylinderGeometry(0.03, 0.03, 0.005, 12), p: [0, 0.0025, 0] },
  ]);
  const geos = { sentado, parado, plato, comida, copa };
  const todas = [...Object.values(sentado), ...Object.values(parado), plato, comida, copa];
  return { ...geos, liberar: () => todas.forEach((g) => g.dispose()) };
}
export type GeoGente = ReturnType<typeof geometriasGente>;

// ── Colores ──
const PIELES = ["#f1c7a5", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#a1665e"];
const ROPAS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#14b8a6", "#f8fafc", "#84cc16", "#be123c"];
const PANTALONES = ["#1e3a8a", "#374151", "#3f2d20", "#1f2937", "#64748b", "#78350f", "#334155"];
const PELOS = ["#1c1917", "#4a2c17", "#a16207", "#d6d3d1", "#7c2d12", "#111827", "#57534e"];
const COMIDAS = ["#f59e0b", "#dc2626", "#16a34a", "#b45309", "#fde68a", "#ea580c"];
const SILUETA = "#15171c";

// Número estable a partir de un texto: cada mesa tiene siempre la misma gente.
function semilla(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const elegir = <T,>(lista: T[], azar: () => number) => lista[Math.floor(azar() * lista.length)];

function malla(g: THREE.BufferGeometry, m: THREE.Material) {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
}

// Persona sentada en un asiento.
export function sentar(geo: GeoGente, mat: Mat, a: Asiento, estilo: EstiloGente, clave: string) {
  const g = new THREE.Group();
  const azar = semilla(clave);
  const negro = mat(SILUETA, { roughness: 0.85 });
  const col = (lista: string[]) => (estilo === "silueta" ? negro : mat(elegir(lista, azar)));
  g.add(malla(geo.sentado.ropa, col(ROPAS)), malla(geo.sentado.piel, col(PIELES)), malla(geo.sentado.pantalon, col(PANTALONES)));
  // Algunos sin pelo visible (pelado o gorro del mismo color de la ropa), para variar.
  if (estilo === "colores" && azar() > 0.12) g.add(malla(geo.sentado.pelo, col(PELOS)));
  g.position.set(a.x, a.alto, a.z);
  g.rotation.y = a.giro;
  // Un poquito de variación de tamaño.
  const s = 0.94 + azar() * 0.12;
  g.scale.set(s, s, s);
  return g;
}

// Plato con comida y una copa frente al asiento, sobre el tablero.
export function servir(geo: GeoGente, mat: Mat, a: Asiento, altoTablero: number, clave: string) {
  const g = new THREE.Group();
  const azar = semilla(clave + ":plato");
  const dx = -Math.sin(a.giro);
  const dz = -Math.cos(a.giro);
  const x = a.x + dx * a.alcance;
  const z = a.z + dz * a.alcance;
  const plato = malla(geo.plato, mat("#ffffff", { roughness: 0.3 }));
  plato.position.set(x, altoTablero, z);
  const comida = malla(geo.comida, mat(elegir(COMIDAS, azar), { roughness: 0.6 }));
  comida.position.set(x, altoTablero, z);
  // La copa a la derecha del plato (vista desde la persona) y un poco más adentro.
  const copa = malla(geo.copa, mat("#dbeafe", { roughness: 0.05, transparent: true, opacity: 0.6 }));
  copa.position.set(x + Math.cos(a.giro) * 0.15 + dx * 0.07, altoTablero, z - Math.sin(a.giro) * 0.15 + dz * 0.07);
  g.add(plato, comida, copa);
  return g;
}

// Mesero de pie, mirando a la mesa. El delantal toma el color del mesero que la atiende, si tiene.
export function mesero(geo: GeoGente, mat: Mat, estilo: EstiloGente, colorDelantal?: string | null) {
  const g = new THREE.Group();
  const negro = mat(SILUETA, { roughness: 0.85 });
  const c = (color: string) => (estilo === "silueta" ? negro : mat(color));
  g.add(
    malla(geo.parado.ropa, c("#f8fafc")),
    malla(geo.parado.piel, c("#e0ac69")),
    malla(geo.parado.pantalon, c("#1f2937")),
    malla(geo.parado.delantal, c(colorDelantal || "#7c2d12")),
    // La libreta queda blanca también en silueta, para reconocer al mesero.
    malla(geo.parado.libreta, mat("#ffffff", { roughness: 0.5 })),
  );
  if (estilo === "colores") g.add(malla(geo.parado.pelo, mat("#1c1917")));
  return g;
}

// Elige k de n asientos repartidos (no todos juntos en un lado).
export function repartir<T>(lista: T[], k: number) {
  const n = lista.length;
  if (k >= n) return lista;
  return Array.from({ length: k }, (_, i) => lista[Math.floor(((i + 0.5) * n) / k)]);
}
