import path from "node:path";
import type { NextConfig } from "next";

// la plataforma vive en su propia carpeta del repositorio: esta es su raíz (Vercel → Root Directory = sellos).
const nextConfig: NextConfig = { outputFileTracingRoot: path.join(__dirname) };

export default nextConfig;
