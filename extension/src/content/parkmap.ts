import { mulberry32, type ParkLayout, type ParkRegion, type Pt } from './parks';

export interface ParkTextures {
  canopy: ImageBitmap;
  lawn: ImageBitmap;
  water: ImageBitmap;
}

/** Cells per texel: how large each texture's detail reads on the ground. */
const TEXEL = { canopy: 0.0125, lawn: 0.02, water: 0.02 } as const;

const mirrored = new WeakMap<ImageBitmap, HTMLCanvasElement>();

/** A 2x2 mirrored copy tiles without seams, whatever the source edges look like. */
function seamless(image: ImageBitmap): HTMLCanvasElement {
  let tile = mirrored.get(image);
  if (tile) return tile;
  tile = document.createElement('canvas');
  tile.width = image.width * 2;
  tile.height = image.height * 2;
  const g = tile.getContext('2d')!;
  for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    g.save();
    g.translate(fx ? tile.width : 0, fy ? tile.height : 0);
    g.scale(fx ? -1 : 1, fy ? -1 : 1);
    g.drawImage(image, 0, 0);
    g.restore();
  }
  mirrored.set(image, tile);
  return tile;
}

function tracePolys(g: CanvasRenderingContext2D, polys: Pt[][], px: number) {
  g.beginPath();
  for (const poly of polys) {
    g.moveTo(poly[0].x * px, poly[0].y * px);
    for (const p of poly.slice(1)) g.lineTo(p.x * px, p.y * px);
    g.closePath();
  }
}

/** Paints the whole park top-down in grid space, `px` pixels to a cell. */
export function paintParkMap(layout: ParkLayout, textures: ParkTextures | null, px: number): HTMLCanvasElement {
  const map = document.createElement('canvas');
  map.width = Math.ceil(layout.width * px);
  map.height = Math.ceil(layout.height * px);
  const g = map.getContext('2d')!;
  const rng = mulberry32(5150);

  const fillWith = (kind: keyof typeof TEXEL, fallback: string) => {
    const image = textures?.[kind];
    if (!image) {
      g.fillStyle = fallback;
      return;
    }
    const pattern = g.createPattern(seamless(image), 'repeat')!;
    const k = (TEXEL[kind] * px);
    pattern.setTransform(new DOMMatrix().scale(k));
    g.fillStyle = pattern;
  };

  fillWith('canopy', '#5d8a35');
  g.filter = 'brightness(0.88) saturate(1.05)';
  g.fillRect(0, 0, map.width, map.height);
  g.filter = 'none';
  g.fillStyle = 'rgba(14, 50, 20, 0.42)';
  g.fillRect(0, 0, map.width, map.height);

  for (let i = 0; i < layout.width * layout.height * 2.2; i++) {
    const x = rng() * map.width;
    const y = rng() * map.height;
    const r = (0.35 + rng() * 0.8) * px;
    const warm = rng() < 0.08;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, warm ? 'rgba(255, 196, 90, 0.12)' : 'rgba(6, 30, 10, 0.34)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const shade = (region: ParkRegion, colour: string, width: number) => {
    g.save();
    tracePolys(g, region.polys, px);
    g.clip();
    g.strokeStyle = colour;
    g.lineWidth = width * px;
    g.lineJoin = 'round';
    g.stroke();
    g.restore();
  };

  for (const region of layout.regions.filter((r) => r.kind === 'lawn')) {
    fillWith('lawn', '#8aa84a');
    tracePolys(g, region.polys, px);
    g.fill();
    shade(region, 'rgba(20, 50, 15, 0.38)', 0.34);
  }

  const rock = layout.rock;
  const rockGrad = g.createRadialGradient(rock.x * px, rock.y * px, 0, rock.x * px, rock.y * px, rock.r * px);
  rockGrad.addColorStop(0, '#9b9486');
  rockGrad.addColorStop(0.75, '#7c7468');
  rockGrad.addColorStop(1, 'rgba(90, 80, 68, 0)');
  g.fillStyle = rockGrad;
  g.beginPath();
  g.arc(rock.x * px, rock.y * px, rock.r * px, 0, Math.PI * 2);
  g.fill();

  g.lineCap = g.lineJoin = 'round';
  for (const path of layout.paths) {
    g.beginPath();
    g.moveTo(path[0].x * px, path[0].y * px);
    for (const p of path.slice(1)) g.lineTo(p.x * px, p.y * px);
    g.strokeStyle = 'rgba(92, 70, 40, 0.55)';
    g.lineWidth = 0.12 * px;
    g.stroke();
    g.strokeStyle = '#dccba2';
    g.lineWidth = 0.075 * px;
    g.stroke();
  }

  for (const region of layout.regions.filter((r) => r.kind !== 'lawn')) {
    const reservoir = region.kind === 'reservoir';
    tracePolys(g, region.polys, px);
    g.lineJoin = 'round';
    g.strokeStyle = reservoir ? '#b2705a' : '#d4c39a';
    g.lineWidth = (reservoir ? 0.34 : 0.2) * px;
    g.stroke();

    fillWith('water', '#1f6178');
    tracePolys(g, region.polys, px);
    g.fill();
    if (reservoir) {
      g.fillStyle = 'rgba(6, 28, 48, 0.28)';
      g.fill();
    }
    shade(region, 'rgba(4, 36, 52, 0.45)', reservoir ? 0.3 : 0.24);

    if (reservoir) {
      tracePolys(g, region.polys, px);
      g.strokeStyle = 'rgba(30, 28, 30, 0.8)';
      g.lineWidth = 0.035 * px;
      g.stroke();
    }
  }

  g.fillStyle = 'rgba(4, 16, 6, 0.4)';
  for (const t of layout.trees) {
    g.beginPath();
    g.ellipse((t.x + 0.16) * px, (t.y + 0.04) * px, t.size * 0.3 * px, t.size * 0.17 * px, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = '#a49c8a';
  g.lineWidth = 0.07 * px;
  g.strokeRect(0.035 * px, 0.035 * px, map.width - 0.07 * px, map.height - 0.07 * px);
  g.strokeStyle = 'rgba(236, 228, 208, 0.7)';
  g.lineWidth = 0.02 * px;
  g.strokeRect(0.035 * px, 0.035 * px, map.width - 0.07 * px, map.height - 0.07 * px);

  return map;
}
