import { Anton, Caveat, Playfair_Display, Space_Mono } from "next/font/google";

// Tipografías de los diseños de la tarjeta de sellos. Sin precarga: el navegador baja solo la del diseño que se ve.
export const fuenteSerif = Playfair_Display({ subsets: ["latin"], weight: ["400", "700", "900"], style: ["normal", "italic"], display: "swap", preload: false });
export const fuenteMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
export const fuenteTiza = Caveat({ subsets: ["latin"], weight: ["500", "700"], display: "swap", preload: false });
export const fuentePop = Anton({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
