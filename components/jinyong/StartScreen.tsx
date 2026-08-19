"use client";

import { useState } from "react";
import { ROLE_OPTIONS, type RoleKey } from "@/lib/jinyong";

interface StartScreenProps {
  onStart: (role: RoleKey) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [selected, setSelected] = useState<RoleKey | null>(null);

  return (
    <div className="animate-float-up flex flex-col items-center gap-7 pt-10 text-center">
      {/* 标题 */}
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.5em] text-gold/80 glow-gold">
          Jiānghú Lù
        </p>
        <h1 className="animate-glitch text-4xl font-black leading-tight text-gold glow-gold">
          江湖录
        </h1>
        <p className="mt-1 text-xl font-bold text-parchment">卑贱子的逆命</p>
        <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-ghost">
          乱世如炉，众生如柴。你不过是田垄间的一个农人、
          破碗里的一个乞丐、青楼里的一缕香魂——命如浮萍，本不值一提。
          可那一夜，你在卦摊前写下一个字，算命先生的眼睛忽然亮了：
          <span className="text-gold">"此命，不孤。"</span>
        </p>
      </div>

      {/* 开局身份选择 */}
      <div className="w-full max-w-sm">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-vermillion/90">
          ✦ 择一身世 · 入此江湖 ✦
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((r) => {
            const active = selected === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelected(r.key)}
                aria-pressed={active}
                className={`h-[78px] rounded-xl border-2 px-2 py-2 backdrop-blur transition-colors ${
                  active
                    ? "border-gold bg-gold/15 glow-gold"
                    : "border-white/10 bg-night-2/80 hover:border-gold/40"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-xl leading-none">{r.emoji}</span>
                  <span
                    className={`text-sm font-bold ${active ? "text-gold" : "text-ice"}`}
                  >
                    {r.label}
                  </span>
                  {active && <span className="text-xs text-gold">✓</span>}
                </div>
                <div className="mt-1 text-[10px] leading-tight text-ghost/70">
                  {r.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={() => selected && onStart(selected)}
        disabled={!selected}
        className={`option-btn h-[52px] w-full max-w-sm rounded-xl border-2 px-6 text-lg font-bold tracking-widest transition-opacity ${
          selected
            ? "border-gold/70 bg-gold/10 text-gold glow-gold"
            : "cursor-not-allowed border-white/10 bg-white/5 text-ghost/50"
        }`}
      >
        {selected ? "以此时此身 · 踏入江湖 ▶" : "先择一身世"}
      </button>

      <p className="text-[11px] text-ghost/50">
        共 10 回 · 金庸笔法 · 结局由你的选择与命格决定
      </p>
    </div>
  );
}
