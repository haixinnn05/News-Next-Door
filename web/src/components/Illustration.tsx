/**
 * Illustrated scenes used in place of photographs. Proposal pages never show a photo that might be
 * mistaken for the real site — these are clearly illustrations, varied per proposal by a seed.
 */
import { useId } from "react";
import type { Category } from "../lib/types";

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SceneProps = { seed: string; className?: string; title?: string };

export function ProposalArt({ category, seed, className, title }: { category: Category } & SceneProps) {
  if (category === "parks_environment") return <ParkScene seed={seed} className={className} title={title} />;
  if (category === "transportation") return <TransitScene seed={seed} className={className} title={title} />;
  if (category === "land_use") return <BuildingScene seed={seed} className={className} title={title} />;
  return <CivicScene seed={seed} className={className} title={title} />;
}

function Sky({ id, warm = false }: { id: string; warm?: boolean }) {
  return (
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        {warm ? (
          <>
            <stop offset="0" stopColor="#9fc0dc" />
            <stop offset="0.6" stopColor="#dfe7ea" />
            <stop offset="1" stopColor="#f3e6d2" />
          </>
        ) : (
          <>
            <stop offset="0" stopColor="#8fb6d9" />
            <stop offset="0.65" stopColor="#cfe0ec" />
            <stop offset="1" stopColor="#ecefe9" />
          </>
        )}
      </linearGradient>
      <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b9cfdc" />
        <stop offset="1" stopColor="#56707f" />
      </linearGradient>
    </defs>
  );
}

function Clouds({ r }: { r: () => number }) {
  return (
    <g fill="#fff" opacity="0.75">
      {Array.from({ length: 3 }, (_, i) => {
        const x = 30 + r() * 340;
        const y = 18 + r() * 40;
        const s = 0.7 + r() * 0.7;
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx="0" cy="0" rx="26" ry="7" />
            <ellipse cx="-10" cy="-5" rx="12" ry="8" />
            <ellipse cx="8" cy="-7" rx="14" ry="9" />
          </g>
        );
      })}
    </g>
  );
}

function Tree({ x, y, s = 1, tone = 0 }: { x: number; y: number; s?: number; tone?: number }) {
  const greens = [
    ["#3f6b34", "#58874a", "#7aa865"],
    ["#35602d", "#4f7d40", "#6e9c58"],
    ["#476f38", "#628f4c", "#88b06f"],
  ][tone % 3];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-1.6" y="-4" width="3.2" height="22" fill="#5b4632" />
      <circle cx="0" cy="-14" r="15" fill={greens[0]} />
      <circle cx="-8" cy="-8" r="10" fill={greens[1]} />
      <circle cx="7" cy="-18" r="10" fill={greens[1]} />
      <circle cx="3" cy="-8" r="8" fill={greens[2]} opacity="0.8" />
    </g>
  );
}

function BackdropBuildings({ r, y = 150, tint = "#b8c2c6" }: { r: () => number; y?: number; tint?: string }) {
  const items = [];
  let x = -10;
  while (x < 410) {
    const w = 24 + r() * 34;
    const h = 40 + r() * 70;
    items.push(<rect key={x} x={x} y={y - h} width={w} height={h + 4} fill={tint} opacity={0.55 + r() * 0.3} />);
    x += w + 2;
  }
  return <g>{items}</g>;
}

function Car({ x, y, color, flip = false }: { x: number; y: number; color: string; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-18 0h36v-7l-6-2-5-6h-14l-6 6-5 2Z" fill={color} />
      <path d="M-8 -14h9l4 5h-17Z" fill="#cfe0ea" opacity="0.85" />
      <circle cx="-10" cy="1" r="3.4" fill="#222" />
      <circle cx="10" cy="1" r="3.4" fill="#222" />
    </g>
  );
}

export function BuildingScene({ seed, className, title }: SceneProps) {
  const id = useId().replace(/:/g, "");
  const r = rng(seed);
  const brick = ["#9c4f38", "#8e4a36", "#a65d42", "#7f4535"][Math.floor(r() * 4)];
  const floors = 7 + Math.floor(r() * 2);
  const bx = 118;
  const bw = 176;
  const floorH = 15;
  const top = 196 - floors * floorH - 22;
  const cols = 9;
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? "Illustration of a mid-rise building"}>
      <Sky id={id} warm />
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <Clouds r={r} />
      <BackdropBuildings r={r} y={170} tint="#aab6bc" />
      {/* neighbour left: glass tower */}
      <rect x="20" y="52" width="70" height="150" fill={`url(#${id}-glass)`} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="20" y={58 + i * 12} width="70" height="1" fill="#fff" opacity="0.35" />
      ))}
      {/* neighbour right: low brick */}
      <rect x="300" y="120" width="90" height="82" fill="#b6866b" />
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 5 }, (_, c) => <rect key={`${row}-${c}`} x={308 + c * 16} y={128 + row * 17} width="9" height="11" fill="#3b4750" opacity="0.8" />),
      )}
      {/* main building */}
      <rect x={bx} y={top} width={bw} height={196 - top} fill={brick} />
      <rect x={bx + bw - 34} y={top} width="34" height={196 - top} fill={`url(#${id}-shade)`} />
      <rect x={bx - 3} y={top - 5} width={bw + 6} height="6" fill="#5f3326" />
      {Array.from({ length: floors }, (_, f) =>
        Array.from({ length: cols }, (_, c) => {
          const wx = bx + 8 + c * ((bw - 16) / cols);
          const wy = top + 8 + f * floorH;
          const lit = r() > 0.82;
          return (
            <g key={`${f}-${c}`}>
              <rect x={wx} y={wy} width={(bw - 16) / cols - 6} height={floorH - 5} fill={lit ? "#f2d9a0" : "#2e3a42"} />
              <rect x={wx} y={wy} width={(bw - 16) / cols - 6} height="2.2" fill="#e8e1d4" opacity="0.5" />
            </g>
          );
        }),
      )}
      {/* retail base */}
      <rect x={bx} y="176" width={bw} height="22" fill="#2f3438" />
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={bx + 6 + i * 34} y="180" width="28" height="16" fill="#a9c1cc" opacity="0.9" />
      ))}
      <rect x={bx} y="172" width={bw} height="5" fill="#1f5b45" />
      {/* street */}
      <rect x="0" y="198" width="400" height="10" fill="#c9c3b6" />
      <rect x="0" y="208" width="400" height="32" fill="#5b5f62" />
      <g fill="#e9e4d6" opacity="0.8">
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={i * 48 + 6} y="223" width="24" height="2.4" />
        ))}
      </g>
      <Tree x={100} y={192} s={0.9} tone={0} />
      <Tree x={312} y={192} s={0.85} tone={2} />
      {/* traffic light */}
      <g transform="translate(346 150)">
        <rect x="-1.2" y="0" width="2.4" height="50" fill="#3a3d3f" />
        <rect x="-5" y="-4" width="10" height="24" rx="2" fill="#2d3032" />
        <circle cx="0" cy="1" r="2.6" fill="#6e2a22" />
        <circle cx="0" cy="8" r="2.6" fill="#7a6a28" />
        <circle cx="0" cy="15" r="2.6" fill="#6ee07d" />
      </g>
      <Car x={70} y={220} color="#c9ccd0" />
      <Car x={250} y={234} color="#355f86" flip />
    </svg>
  );
}

export function ParkScene({ seed, className, title }: SceneProps) {
  const id = useId().replace(/:/g, "");
  const r = rng(seed);
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? "Illustration of a neighborhood park"}>
      <Sky id={id} />
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <Clouds r={r} />
      <BackdropBuildings r={r} y={140} tint="#b9bfb9" />
      <rect x="0" y="136" width="400" height="104" fill="#8fb36f" />
      <path d="M0 160 C 90 150, 200 175, 400 150 L400 240 L0 240Z" fill="#7aa35c" />
      <path d="M160 240 C 190 200, 230 180, 330 150 L350 152 C 260 185, 225 205, 205 240Z" fill="#e3d8c0" />
      {Array.from({ length: 11 }, (_, i) => (
        <Tree key={i} x={10 + i * 38 + r() * 14} y={146 + r() * 12} s={0.9 + r() * 0.5} tone={i} />
      ))}
      {/* play structure */}
      <g transform="translate(70 176)">
        <rect x="0" y="-26" width="4" height="30" fill="#c24b35" />
        <rect x="40" y="-26" width="4" height="30" fill="#c24b35" />
        <rect x="-2" y="-30" width="48" height="6" rx="2" fill="#e0a43a" />
        <path d="M44 -20 L70 4 L64 4 L42 -14Z" fill="#3d7fbf" />
        <rect x="14" y="-20" width="1.5" height="16" fill="#555" />
        <rect x="26" y="-20" width="1.5" height="16" fill="#555" />
        <rect x="12" y="-5" width="18" height="3" fill="#333" />
      </g>
      {/* benches & lamps */}
      {[250, 300].map((x) => (
        <g key={x} transform={`translate(${x} ${196 - (x - 250) * 0.3})`}>
          <rect x="0" y="0" width="26" height="3" fill="#6b4c32" />
          <rect x="0" y="-6" width="26" height="2.5" fill="#6b4c32" />
          <rect x="2" y="3" width="2" height="6" fill="#333" />
          <rect x="22" y="3" width="2" height="6" fill="#333" />
        </g>
      ))}
      <g fill="#2f3432">
        <rect x="236" y="150" width="2" height="46" />
        <circle cx="237" cy="149" r="4" fill="#f4e3b0" />
      </g>
      <g opacity="0.9">
        <circle cx="190" cy="214" r="3" fill="#2f2f2f" />
        <rect x="187" y="217" width="6" height="12" rx="2" fill="#d05d3d" />
        <circle cx="205" cy="206" r="2.5" fill="#2f2f2f" />
        <rect x="202.5" y="209" width="5" height="10" rx="2" fill="#3e6fb0" />
      </g>
    </svg>
  );
}

export function TransitScene({ seed, className, title }: SceneProps) {
  const id = useId().replace(/:/g, "");
  const r = rng(seed);
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? "Illustration of a street with an elevated train and a bus lane"}>
      <Sky id={id} warm />
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <Clouds r={r} />
      {/* storefront buildings */}
      {Array.from({ length: 7 }, (_, i) => {
        const x = i * 60 - 6;
        const h = 60 + r() * 60;
        const c = ["#a86a4c", "#c6a27d", "#8d5a45", "#b99379", "#7d6a5e"][i % 5];
        return (
          <g key={i}>
            <rect x={x} y={176 - h} width="58" height={h} fill={c} />
            {Array.from({ length: Math.floor(h / 22) }, (_, f) =>
              [0, 1, 2].map((k) => <rect key={`${f}-${k}`} x={x + 7 + k * 17} y={176 - h + 8 + f * 22} width="10" height="13" fill="#34414a" opacity="0.85" />),
            )}
            <rect x={x} y="160" width="58" height="16" fill="#2c3136" />
            <rect x={x + 4} y="156" width="50" height="5" fill={["#c8412f", "#2e6b4f", "#d29a2a", "#35609a"][i % 4]} />
          </g>
        );
      })}
      {/* elevated train structure */}
      <rect x="0" y="92" width="400" height="12" fill="#556068" />
      <rect x="0" y="104" width="400" height="3" fill="#3f484e" />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <rect x={20 + i * 72} y="107" width="7" height="94" fill="#4b555c" />
          <path d={`M${20 + i * 72} 110 l-14 12 h4 l10 -8Z`} fill="#4b555c" />
        </g>
      ))}
      <g transform="translate(40 66)">
        {[0, 1, 2].map((k) => (
          <g key={k} transform={`translate(${k * 104} 0)`}>
            <rect x="0" y="0" width="100" height="26" rx="4" fill="#c9ced2" />
            <rect x="0" y="18" width="100" height="3" fill="#8d2fa0" />
            {Array.from({ length: 6 }, (_, w) => (
              <rect key={w} x={6 + w * 16} y="5" width="11" height="9" rx="1.5" fill="#3a4852" />
            ))}
          </g>
        ))}
      </g>
      {/* road with red bus lane */}
      <rect x="0" y="176" width="400" height="8" fill="#c7c1b4" />
      <rect x="0" y="184" width="400" height="56" fill="#5d6164" />
      <rect x="0" y="186" width="400" height="20" fill="#a84737" />
      <text x="120" y="200" fontSize="9" fontWeight="800" fill="#f1e6d8" letterSpacing="2" fontFamily="Inter, sans-serif">BUS ONLY</text>
      <g fill="#ece6d7" opacity="0.8">
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={i * 48} y="222" width="26" height="2.4" />
        ))}
      </g>
      {/* bus */}
      <g transform="translate(222 158)">
        <rect x="0" y="0" width="120" height="40" rx="6" fill="#f3f4f4" />
        <rect x="0" y="26" width="120" height="6" fill="#1e5cb3" />
        {Array.from({ length: 6 }, (_, w) => (
          <rect key={w} x={8 + w * 18} y="6" width="14" height="15" rx="2" fill="#384650" />
        ))}
        <rect x="108" y="6" width="10" height="20" rx="2" fill="#384650" />
        <circle cx="24" cy="41" r="6" fill="#222" />
        <circle cx="96" cy="41" r="6" fill="#222" />
      </g>
      <Car x={70} y={230} color="#d6d0c4" />
    </svg>
  );
}

export function CivicScene({ seed, className, title }: SceneProps) {
  const id = useId().replace(/:/g, "");
  const r = rng(seed);
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? "Illustration of a civic building"}>
      <Sky id={id} />
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <Clouds r={r} />
      <BackdropBuildings r={r} y={150} />
      <rect x="110" y="96" width="180" height="104" fill="#d9cdb6" />
      <path d="M100 98 L200 58 L300 98Z" fill="#c8b999" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={124 + i * 28} y="104" width="10" height="90" fill="#efe7d6" />
      ))}
      <rect x="100" y="194" width="200" height="8" fill="#b6a88c" />
      <rect x="0" y="202" width="400" height="38" fill="#c9c3b6" />
      <Tree x={70} y={196} tone={1} />
      <Tree x={330} y={196} tone={2} />
    </svg>
  );
}

/** Home hero: Queens at golden hour with the Manhattan skyline behind and the elevated 7 train. */
export function HeroSkyline({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const r = rng("queens-cb2-hero");
  const far: { x: number; w: number; h: number; spire?: number }[] = [];
  let x = 0;
  while (x < 800) {
    const w = 14 + r() * 26;
    const h = 60 + r() * 120;
    far.push({ x, w, h, spire: r() > 0.9 ? 20 + r() * 30 : undefined });
    x += w + 1 + r() * 4;
  }
  const mid: { x: number; w: number; h: number; c: string }[] = [];
  x = 180;
  while (x < 820) {
    const w = 28 + r() * 36;
    const h = 90 + r() * 130;
    mid.push({ x, w, h, c: ["#6f7d86", "#7b8a91", "#5e6d76", "#8995a0"][Math.floor(r() * 4)] });
    x += w + 3 + r() * 8;
  }
  const rows: { x: number; w: number; h: number; c: string }[] = [];
  x = -10;
  while (x < 820) {
    const w = 34 + r() * 30;
    const h = 40 + r() * 46;
    rows.push({ x, w, h, c: ["#8a5a45", "#a06a4d", "#7a4e3d", "#b58463", "#946049"][Math.floor(r() * 5)] });
    x += w;
  }
  return (
    <svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Illustration of Queens neighborhoods at sunset with the Manhattan skyline">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7f9fbf" />
          <stop offset="0.35" stopColor="#d9b99b" />
          <stop offset="0.62" stopColor="#f2c48f" />
          <stop offset="1" stopColor="#f6dcb6" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.62" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff2cf" stopOpacity="1" />
          <stop offset="0.25" stopColor="#ffd796" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd796" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3cfa4" stopOpacity="0" />
          <stop offset="1" stopColor="#f3cfa4" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`${id}-street`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d4a47" />
          <stop offset="1" stopColor="#2f2d2b" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe0b0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffe0b0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="800" height="520" fill={`url(#${id}-sky)`} />
      <rect width="800" height="520" fill={`url(#${id}-sun)`} />
      {/* Manhattan, far */}
      <g fill="#8f95a8" opacity="0.75">
        {far.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={300 - b.h} width={b.w} height={b.h + 10} />
            {b.spire && <path d={`M${b.x + b.w / 2 - 3} ${300 - b.h} l3 -${b.spire} l3 ${b.spire}Z`} />}
          </g>
        ))}
        {/* Empire State-like and Chrysler-like landmarks */}
        <path d="M520 300 v-150 h8 v-20 h6 v-24 h3 v-30 h2 v30 h3 v24 h6 v20 h8 v150Z" />
        <path d="M430 300 v-160 h20 v160Z M434 140 q6 -30 6 -46 q0 16 6 46Z" />
      </g>
      <rect y="220" width="800" height="100" fill={`url(#${id}-haze)`} />
      {/* LIC towers, mid */}
      <g>
        {mid.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={350 - b.h} width={b.w} height={b.h} fill={b.c} />
            <rect x={b.x} y={350 - b.h} width={b.w * 0.45} height={b.h} fill={`url(#${id}-glass)`} />
            {Array.from({ length: Math.floor(b.h / 9) }, (_, k) => (
              <rect key={k} x={b.x} y={350 - b.h + 5 + k * 9} width={b.w} height="0.8" fill="#1f2a30" opacity="0.25" />
            ))}
          </g>
        ))}
      </g>
      {/* elevated 7 train viaduct */}
      <g>
        <rect x="0" y="352" width="800" height="12" fill="#3f403f" />
        <rect x="0" y="364" width="800" height="4" fill="#2b2c2b" />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={i * 96 + 20} y="368" width="8" height="70" fill="#353634" />
        ))}
        <g transform="translate(250 330)">
          {[0, 1, 2, 3].map((k) => (
            <g key={k} transform={`translate(${k * 92} 0)`}>
              <rect width="88" height="22" rx="4" fill="#c9c6bf" />
              <rect y="15" width="88" height="3" fill="#9b3fb5" />
              {Array.from({ length: 5 }, (_, w) => (
                <rect key={w} x={6 + w * 17} y="4" width="11" height="8" rx="1.5" fill="#f7d9a3" opacity="0.9" />
              ))}
            </g>
          ))}
        </g>
      </g>
      {/* rowhouses, foreground */}
      <g>
        {rows.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={450 - b.h} width={b.w} height={b.h} fill={b.c} />
            <rect x={b.x} y={450 - b.h} width={b.w} height="4" fill="#5a3a2c" />
            {Array.from({ length: Math.floor(b.h / 20) }, (_, f) =>
              [0, 1].map((k) => <rect key={`${f}-${k}`} x={b.x + 6 + k * (b.w / 2)} y={450 - b.h + 9 + f * 20} width={b.w / 2 - 12} height="11" fill={r() > 0.6 ? "#ffd48a" : "#3c3430"} opacity="0.9" />),
            )}
          </g>
        ))}
      </g>
      {/* trees */}
      {Array.from({ length: 10 }, (_, i) => {
        const tx = 20 + i * 84 + r() * 30;
        const s = 1.3 + r() * 0.6;
        return (
          <g key={i} transform={`translate(${tx} 452) scale(${s})`}>
            <rect x="-1.5" y="-10" width="3" height="14" fill="#3b2f25" />
            <circle cx="0" cy="-20" r="15" fill="#3d5a2f" />
            <circle cx="-9" cy="-14" r="10" fill="#4f7039" />
            <circle cx="8" cy="-24" r="10" fill="#5f7f42" />
            <circle cx="5" cy="-14" r="7" fill="#c9a45a" opacity="0.35" />
          </g>
        );
      })}
      {/* street */}
      <rect y="448" width="800" height="72" fill={`url(#${id}-street)`} />
      <rect y="448" width="800" height="6" fill="#8d857a" />
      <g fill="#e7d9bf" opacity="0.7">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 70 + 10} y="488" width="34" height="3" />
        ))}
      </g>
      <g>
        {Array.from({ length: 7 }, (_, i) => {
          const cx = 40 + i * 118 + r() * 30;
          const cy = i % 2 ? 505 : 472;
          return (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <path d="M-22 0h44v-9l-8-3-6-7h-18l-7 7-5 3Z" fill={["#d8d4cc", "#8c2f28", "#2d4a6b", "#e0c070", "#5d6b73"][i % 5]} />
              <circle cx="-12" cy="1" r="4" fill="#161616" />
              <circle cx="12" cy="1" r="4" fill="#161616" />
              <circle cx={i % 2 ? -22 : 22} cy="-5" r="2" fill={i % 2 ? "#ffefc4" : "#ff5a3c"} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
