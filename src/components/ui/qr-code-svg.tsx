import { useMemo } from "react";
import { qrcodegen } from "@/lib/qrcodegen";

interface QrCodeSvgProps {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  darkColor?: string;
  lightColor?: string;
  margin?: number;
  className?: string;
}

export function QrCodeSvg({
  value,
  size = 180,
  level = "M",
  darkColor = "#000000",
  lightColor = "#ffffff",
  margin = 2,
  className,
}: QrCodeSvgProps) {
  const qr = useMemo(() => {
    if (!value) return null;
    try {
      const eccMap = {
        L: qrcodegen.QrCode.Ecc.LOW,
        M: qrcodegen.QrCode.Ecc.MEDIUM,
        Q: qrcodegen.QrCode.Ecc.QUARTILE,
        H: qrcodegen.QrCode.Ecc.HIGH,
      };
      const ecc = eccMap[level] ?? qrcodegen.QrCode.Ecc.MEDIUM;
      return qrcodegen.QrCode.encodeText(value, ecc);
    } catch {
      return null;
    }
  }, [value, level]);

  if (!qr) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label="QR Code placeholder"
      />
    );
  }

  const moduleCount = qr.size;
  const viewBoxSize = moduleCount + margin * 2;

  let path = "";
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (qr.getModule(x, y)) {
        const mx = x + margin;
        const my = y + margin;
        path += `M${mx},${my}h1v1h-1Z `;
      }
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect
        width={viewBoxSize}
        height={viewBoxSize}
        fill={lightColor}
        rx={margin > 0 ? 1 : 0}
      />
      <path d={path.trim()} fill={darkColor} />
    </svg>
  );
}
