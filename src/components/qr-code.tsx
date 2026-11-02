"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/** QR en SVG (se imprime nítido). Se arma sincrónico a partir de la matriz de módulos. */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { size: modules.size, path: d };
  }, [value]);

  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className={className} shapeRendering="crispEdges" role="img" aria-label="Código QR">
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
