// Inline OSM mini-map. No API key. Uses raw tile.openstreetmap.org tiles
// composited with absolute-positioned SVG pins. Screenshot-ready.
//
// Strategy:
//   - Compute a bounding box around PG + N closest landmarks (with padding).
//   - Pick a zoom level that fits the bbox in our chosen pixel size.
//   - Render a 3x3 grid of OSM tiles centered on the midpoint.
//   - Overlay SVG pins at projected (lon/lat → pixel) positions.
//
// Tiles: https://{a|b|c}.tile.openstreetmap.org/{z}/{x}/{y}.png  (free, attribution required)

import { useMemo } from "react";
import type { PG, NearbyLandmark } from "@/property-genius/data/types";
import { ExternalLink, Navigation } from "lucide-react";

interface Props {
  pg: PG;
  /** Pre-resolved nearby landmarks WITH coordinates (n,t,d,w,lat,lng). */
  pins: Array<NearbyLandmark & { lat: number; lng: number }>;
  height?: number;
}

const TILE = 256;
const MAP_W = 640;
const MAP_H = 280;

function lon2x(lon: number, z: number) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
function lat2y(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
}

function pickZoom(minLat: number, maxLat: number, minLng: number, maxLng: number) {
  // Find largest z where the bbox still fits in MAP_W × MAP_H pixels.
  for (let z = 18; z >= 2; z--) {
    const px = (lon2x(maxLng, z) - lon2x(minLng, z)) * TILE;
    const py = (lat2y(minLat, z) - lat2y(maxLat, z)) * TILE;
    if (px <= MAP_W - 80 && py <= MAP_H - 80) return z;
  }
  return 13;
}

export function MiniMap({ pg, pins, height = MAP_H }: Props) {
  const data = useMemo(() => {
    if (!pg.lat || !pg.lng) return null;

    const points = [
      { lat: pg.lat, lng: pg.lng, kind: "pg" as const, name: pg.name, w: 0 },
      ...pins.slice(0, 3).map((p) => ({ lat: p.lat, lng: p.lng, kind: "lm" as const, name: p.n, w: p.w })),
    ];

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const z = pickZoom(minLat, maxLat, minLng, maxLng);
    const cx = (minLng + maxLng) / 2;
    const cy = (minLat + maxLat) / 2;

    const centerXf = lon2x(cx, z);
    const centerYf = lat2y(cy, z);

    // Top-left pixel of the visible window in world-pixel space.
    const originPx = centerXf * TILE - MAP_W / 2;
    const originPy = centerYf * TILE - height / 2;

    // Tile range covering the window (with 1-tile margin for clean edges).
    const tileX0 = Math.floor(originPx / TILE) - 1;
    const tileY0 = Math.floor(originPy / TILE) - 1;
    const tileX1 = Math.floor((originPx + MAP_W) / TILE) + 1;
    const tileY1 = Math.floor((originPy + height) / TILE) + 1;

    const tiles: { x: number; y: number; left: number; top: number; src: string }[] = [];
    const maxIdx = Math.pow(2, z) - 1;
    for (let tx = tileX0; tx <= tileX1; tx++) {
      for (let ty = tileY0; ty <= tileY1; ty++) {
        if (ty < 0 || ty > maxIdx) continue;
        const wrappedX = ((tx % (maxIdx + 1)) + (maxIdx + 1)) % (maxIdx + 1);
        const sub = ["a", "b", "c"][(tx + ty) % 3];
        tiles.push({
          x: tx,
          y: ty,
          left: tx * TILE - originPx,
          top: ty * TILE - originPy,
          src: `https://${sub}.tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png`,
        });
      }
    }

    const project = (lat: number, lng: number) => ({
      x: lon2x(lng, z) * TILE - originPx,
      y: lat2y(lat, z) * TILE - originPy,
    });

    return { tiles, points, project, z };
  }, [pg, pins, height]);

  if (!data) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-card text-xs text-muted-foreground">
        No coordinates on record — map unavailable.
      </div>
    );
  }

  const osmLink = `https://www.openstreetmap.org/?mlat=${pg.lat}&mlon=${pg.lng}#map=15/${pg.lat}/${pg.lng}`;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-2 shadow-card">
      <div
        className="relative w-full overflow-hidden bg-[hsl(var(--surface-2))]"
        style={{ height }}
      >
        {/* Tile layer */}
        <div className="absolute inset-0">
          {data.tiles.map((t) => (
            <img
              key={`${t.x}-${t.y}`}
              src={t.src}
              alt=""
              loading="lazy"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              draggable={false}
              className="absolute select-none"
              style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
            />
          ))}
        </div>

        {/* Subtle dark veil for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />

        {/* Pin overlay */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${MAP_W} ${height}`} preserveAspectRatio="xMidYMid slice">
          {/* Connector lines from PG → each landmark */}
          {(() => {
            const pgPt = data.project(data.points[0].lat, data.points[0].lng);
            return data.points.slice(1).map((p, i) => {
              const lp = data.project(p.lat, p.lng);
              return (
                <line
                  key={`l-${i}`}
                  x1={pgPt.x} y1={pgPt.y} x2={lp.x} y2={lp.y}
                  stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.65}
                />
              );
            });
          })()}

          {data.points.map((p, i) => {
            const { x, y } = data.project(p.lat, p.lng);
            if (p.kind === "pg") {
              return (
                <g key={`pg-${i}`} transform={`translate(${x}, ${y})`}>
                  <circle r={16} fill="hsl(var(--primary))" opacity={0.18} />
                  <circle r={9} fill="hsl(var(--primary))" stroke="white" strokeWidth={2.5} />
                  <text y={-14} textAnchor="middle" fontSize={11} fontWeight={700} fill="white"
                        stroke="black" strokeWidth={3} paintOrder="stroke">
                    {p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name}
                  </text>
                </g>
              );
            }
            const color = p.w <= 5 ? "#34d399" : p.w <= 15 ? "#fbbf24" : "#fb923c";
            return (
              <g key={`lm-${i}`} transform={`translate(${x}, ${y})`}>
                <circle r={6} fill={color} stroke="white" strokeWidth={2} />
                <text y={18} textAnchor="middle" fontSize={10} fontWeight={600} fill="white"
                      stroke="black" strokeWidth={2.5} paintOrder="stroke">
                  {p.name.length > 18 ? p.name.slice(0, 17) + "…" : p.name} · {p.w <= 0 ? "<1m" : `${p.w}m`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Attribution + actions */}
        <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
          © OpenStreetMap
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-1 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Navigation className="h-3 w-3 text-primary" />
          <span><b className="text-foreground">{data.points.length - 1}</b> closest landmarks · zoom {data.z}</span>
        </div>
        <a
          href={osmLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] hover:border-primary/50"
        >
          <ExternalLink className="h-3 w-3" /> Open in OSM
        </a>
      </div>
    </div>
  );
}
