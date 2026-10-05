import Link from "next/link";
import type { FloorLayout } from "@/layouts/types";
import { en } from "@/messages/en";

export type MapTile = { roomId: string; roomNumber: string; activeStudents: number; status: "pending" | "complete" | "vacant" };

const FILL = { complete: "#15803d", pending: "#dc2626", vacant: "#6b7280" } as const;
const LABEL = {
  complete: en.admin.check.statusComplete,
  pending: en.admin.check.statusPending,
  vacant: en.admin.check.statusVacant,
} as const;

export const studentsLabel = (n: number) => `${n} ${n === 1 ? en.admin.map.student : en.admin.map.students}`;

/** Non-text status mark so colour is never the only signal (colour-blind friendly). */
export function StatusIcon({ status, className }: { status: MapTile["status"]; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {status === "complete" && <path d="M5 12.5l4.5 4.5L19 7" />}
      {status === "pending" && <path d="M12 5v9M12 19v.5" />}
      {status === "vacant" && <path d="M6 12h12" />}
    </svg>
  );
}

/** 2D top-down floor plan drawn from layout DATA. Every room tile links to its checking screen. */
export default function FloorPlan({ layout, tiles }: { layout: FloorLayout; tiles: MapTile[] }) {
  const byNumber = new Map(tiles.map((t) => [t.roomNumber, t]));
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-300 bg-white p-2">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="block h-auto w-full min-w-[720px]" role="group" aria-label={`Floor ${layout.floor} plan`}>
        {layout.corridors.map((c, i) => (
          <g key={`c${i}`}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#efece4" />
            <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 7} textAnchor="middle" fontSize="20" fill="#a8a29e" letterSpacing="6">CORRIDOR</text>
          </g>
        ))}
        {layout.features.map((f, i) => (
          <g key={`f${i}`}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="#e7e5e4" />
            <text x={f.x + f.w / 2} y={f.y + f.h / 2 + 7} textAnchor="middle" fontSize="22" fill="#78716c">{f.label}</text>
          </g>
        ))}
        {layout.rooms.map((r) => {
          const t = byNumber.get(r.roomNumber);
          if (!t) return null;
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          return (
            <Link key={r.roomNumber} href={`/admin/rooms/${r.roomNumber}/check`} className="group" aria-label={`Room ${r.roomNumber}, ${studentsLabel(t.activeStudents)}, ${LABEL[t.status]}`}>
              <rect x={r.x + 3} y={r.y + 3} width={r.w - 6} height={r.h - 6} rx="6" fill={FILL[t.status]} className="transition-opacity group-hover:opacity-90 group-focus-visible:stroke-[#1e3a5f] group-focus-visible:[stroke-width:6]" />
              <g transform={`translate(${r.x + r.w - 46} ${r.y + 12}) scale(1.3)`} color="#ffffff"><StatusIcon status={t.status} /></g>
              <text x={cx} y={cy + 2} textAnchor="middle" fontSize="48" fontWeight="700" fill="#ffffff">{r.roomNumber}</text>
              <text x={cx} y={cy + 38} textAnchor="middle" fontSize="24" fill="#ffffff">{studentsLabel(t.activeStudents)}</text>
            </Link>
          );
        })}
        {layout.walls.map((w, i) => (
          <line key={`w${i}`} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#334155" strokeWidth="6" strokeLinecap="round" pointerEvents="none" />
        ))}
      </svg>
    </div>
  );
}

/** Plain tile grid, used for rooms that are not placed in the floor plan. */
export function RoomGrid({ tiles }: { tiles: MapTile[] }) {
  const bg = { complete: "bg-status-complete", pending: "bg-status-pending", vacant: "bg-status-vacant" } as const;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.roomId}>
          <Link href={`/admin/rooms/${t.roomNumber}/check`} className={`relative flex min-h-24 flex-col items-center justify-center rounded-xl p-3 text-white ${bg[t.status]}`} aria-label={`Room ${t.roomNumber}, ${studentsLabel(t.activeStudents)}, ${LABEL[t.status]}`}>
            <StatusIcon status={t.status} className="absolute right-2 top-2 h-5 w-5" />
            <span className="text-2xl font-bold">{t.roomNumber}</span>
            <span className="text-sm">{studentsLabel(t.activeStudents)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
