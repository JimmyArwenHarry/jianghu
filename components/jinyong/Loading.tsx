"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "算命先生的签筒正摇得哗哗作响…",
  "茶棚外，一串马蹄声由远及近…",
  "客栈小二又给桌上添了一壶热酒…",
  "有个人蹲在城墙上，正吹着一管旧箫…",
  "官道尽头尘土飞扬，似有一支镖队经过…",
  "灶膛里的柴火噼啪作响，火星溅上了油纸…",
  "檐角一只信鸽抖了抖翅膀，落下片羽毛…",
  "巷口的老人眯着眼，把一块碎银抛了又抛…",
];

export default function Loading() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % PHRASES.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      {/* 旋转光环（鎏金 + 朱砂） */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-neon-spin rounded-full border-2 border-transparent border-t-gold border-r-vermillion" />
        <div className="absolute inset-2 animate-neon-spin rounded-full border-2 border-transparent border-b-vermillion border-l-gold [animation-duration:1.1s] [animation-direction:reverse]" />
        <div className="absolute inset-0 animate-neon-pulse flex items-center justify-center text-4xl">
          ⚔️
        </div>
      </div>

      <p className="font-serif text-sm text-gold">
        <span>{PHRASES[idx]}</span>
        <span className="animate-blink text-vermillion">▍</span>
      </p>

      <p className="text-[11px] text-ghost/60">
        说书人正在砚台里研墨，为你推演这一回江湖…
      </p>
    </div>
  );
}
