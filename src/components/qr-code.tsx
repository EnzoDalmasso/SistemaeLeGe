"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

// Margen blanco de 4 módulos (lo que pide la norma): con menos, la cámara del celular muchas veces no lo detecta.
const QUIET = 4;

/** QR en SVG (se imprime nítido). Se arma sincrónico a partir de la matriz de módulos. */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const { size, path } = useMemo(() => {
    // Corrección "L": menos módulos y cuadros más grandes, más fácil de leer en pantalla o en el talón.
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "L" });
    let d = "";
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { size: modules.size, path: d };
  }, [value]);

  const full = size + QUIET * 2;
  return (
    <svg viewBox={`${-QUIET} ${-QUIET} ${full} ${full}`} className={className} shapeRendering="crispEdges" role="img" aria-label="Código QR">
      <rect x={-QUIET} y={-QUIET} width={full} height={full} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
