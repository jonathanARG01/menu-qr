"use client";

import { useEffect, useState } from "react";
import { urlSitio } from "@/lib/utils";

// Dirección del sitio para mostrar en pantalla: la del servidor al renderizar y la real del navegador al montar.
export function useUrlSitio() {
  const [url, setUrl] = useState(() => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""));
  useEffect(() => setUrl(urlSitio()), []);
  return url;
}
