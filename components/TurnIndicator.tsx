"use client";

interface TurnIndicatorProps {
  turn: number; // 1..20
  total: number; // 20
  /** 左侧标题（默认江湖录） */
  title?: string;
}

export default function TurnIndicator({ turn, total, title = "江湖录" }: TurnIndicatorProps) {
  const pct = Math.max(0, Math.min(1, turn / total)) * 100;
  const isFinale = turn >= total;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ghost">
          {isFinale ? "⚡ 终章" : `▚ ${title}`}
        </span>
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            isFinale ? "glow-red text-vermillion" : "glow-gold text-gold"
          }`}
        >
          {isFinale ? `${total} / ${total}` : `${turn} / ${total}`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-3 ring-1 ring-white/10">
        <div
          className="progress-shimmer h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
