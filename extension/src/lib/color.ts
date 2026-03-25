export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function expandShortHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return hex;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = expandShortHex(hex);

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export function mixHex(base: string, target: string, amount: number): string {
  const baseRgb = hexToRgb(base);
  const targetRgb = hexToRgb(target);
  const clampedAmount = Math.max(0, Math.min(1, amount));

  const mixed = {
    r: clampChannel(baseRgb.r + (targetRgb.r - baseRgb.r) * clampedAmount),
    g: clampChannel(baseRgb.g + (targetRgb.g - baseRgb.g) * clampedAmount),
    b: clampChannel(baseRgb.b + (targetRgb.b - baseRgb.b) * clampedAmount),
  };

  return `#${mixed.r.toString(16).padStart(2, '0')}${mixed.g
    .toString(16)
    .padStart(2, '0')}${mixed.b.toString(16).padStart(2, '0')}`;
}

export function lightenHex(hex: string, amount: number): string {
  return mixHex(hex, '#ffffff', amount);
}
