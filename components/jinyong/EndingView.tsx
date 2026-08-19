"use client";

import { useMemo, useState } from "react";
import Markdown from "@/components/Markdown";
import Typewriter from "@/components/Typewriter";

interface EndingViewProps {
  endingStory: string;
  chronicle: string;
  chronicleStatus: "idle" | "loading" | "done" | "error";
  poem: string;
  endingError: string;
  onRetry: () => void;
  onRestart: () => void;
}

/** 内联小加载块 */
function MiniLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-gold/25 bg-night-2/80 p-6 text-center backdrop-blur">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute inset-0 animate-neon-spin rounded-full border-2 border-transparent border-t-gold border-r-vermillion" />
        <div className="animate-neon-pulse text-xl">✒️</div>
      </div>
      <p className="text-sm text-gold">
        {label}
        <span className="animate-blink text-vermillion">▍</span>
      </p>
    </div>
  );
}

/** 章节小标题 */
function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold/80">
      {icon} {label}
    </p>
  );
}

export default function EndingView({
  endingStory,
  chronicle,
  chronicleStatus,
  poem,
  endingError,
  onRetry,
  onRestart,
}: EndingViewProps) {
  const [copied, setCopied] = useState(false);
  const [doneTyping, setDoneTyping] = useState(false);
  const [skipTyping, setSkipTyping] = useState(false);

  const chronicleReady = chronicleStatus === "done" && !!chronicle.trim();
  const poemLines = useMemo(() => {
    const rows: string[] = [];
    for (const raw of poem.split(/\n/)) {
      const line = raw.trim();
      if (!line) continue;
      // 七律常把一联两句写在同一行（以逗号/句号分隔），按标点拆成竖排八句
      const parts = line
        .split(/(?<=[，。；])\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1) rows.push(...parts);
      else rows.push(line);
    }
    return rows;
  }, [poem]);

  const buildShareText = () => {
    const lines = [
      "🏯《江湖录：卑贱子的逆命》我的最终结局",
      "",
    ];
    if (chronicleReady) {
      lines.push("📜 战记");
      lines.push(chronicle);
      lines.push("");
    }
    if (poemLines.length > 0) {
      lines.push("🎋 卷末七律");
      lines.push(poemLines.join("\n"));
    }
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "江湖录：卑贱子的逆命", text });
        return;
      } catch {
        /* 用户取消分享则回退到复制 */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* 终局标题 */}
      <div className="relative overflow-hidden rounded-2xl border border-vermillion/50 bg-gradient-to-b from-vermillion/15 to-transparent p-6 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_-20%,rgba(208,69,47,0.5),transparent_60%)]" />
        <p className="font-mono text-[11px] uppercase tracking-[0.5em] text-vermillion glow-red">
          Zhōng · 江湖终局
        </p>
        <h2 className="mt-2 text-3xl font-black text-gold glow-gold">
          这一身世，这一命格，终归江湖
        </h2>
        <div className="mt-3 text-xs text-ghost">10 / 10 回 · 乱世恩怨已了</div>
      </div>

      {/* 结局正文（打字机 + 点击跳过） */}
      <div
        onClick={() => setSkipTyping(true)}
        className="cursor-pointer rounded-2xl border border-white/10 bg-night-2/80 p-5 backdrop-blur"
      >
        <Typewriter
          text={endingStory}
          skip={skipTyping}
          speed={22}
          stepChars={endingStory.length > 260 ? 4 : endingStory.length > 130 ? 2 : 1}
          onDone={() => setDoneTyping(true)}
        >
          {(revealed) => (
            <>
              <Markdown variant="wuxia">{revealed}</Markdown>
              {!doneTyping && <span className="animate-blink text-vermillion">▍</span>}
            </>
          )}
        </Typewriter>
        {!doneTyping && (
          <p className="mt-2 text-right text-[10px] text-ghost/40">
            点击结局可跳过 ▸
          </p>
        )}
      </div>

      {/* 读完后：战记 + 七律 */}
      {doneTyping && (
        <>
          {/* 战记总结（金庸文风，约 800 字） */}
          <div className="flex flex-col gap-3">
            <SectionTitle icon="📜" label="江湖战记 · 金庸笔法" />
            {chronicleStatus === "loading" && (
              <MiniLoading label="说书人正在研墨，为你写这 800 字战记…" />
            )}
            {chronicleStatus === "error" && (
              <div className="rounded-xl border border-vermillion/40 bg-vermillion/10 p-4">
                <p className="text-sm text-parchment">{endingError || "战记生成失败"}</p>
                <button
                  onClick={onRetry}
                  className="option-btn mt-3 h-[46px] w-full rounded-xl border-2 border-gold/70 bg-gold/10 font-bold text-gold glow-gold"
                >
                  🔄 重新落笔战记
                </button>
              </div>
            )}
            {chronicleReady && (
              <div className="animate-float-up rounded-2xl border border-gold/25 bg-night-2/80 p-5 backdrop-blur">
                <Markdown variant="wuxia">{chronicle}</Markdown>
              </div>
            )}
          </div>

          {/* 卷末七律 */}
          {poemLines.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionTitle icon="🎋" label="卷末七律" />
              <div className="animate-float-up relative overflow-hidden rounded-2xl border-2 border-vermillion/40 bg-night-2/80 p-6 backdrop-blur glow-red">
                <div className="pointer-events-none absolute inset-0 opacity-15 [background:repeating-linear-gradient(to_bottom,transparent_0,transparent_30px,rgba(215,178,92,0.25)_30px,rgba(215,178,92,0.25)_31px)]" />
                <div className="relative flex flex-col items-center gap-2.5">
                  {poemLines.map((line, i) => (
                    <p
                      key={i}
                      className={`text-center text-base leading-relaxed tracking-wider ${
                        i === 0 && poemLines.length > 8
                          ? "font-bold text-vermillion glow-red"
                          : "text-parchment/90"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
                <p className="mt-5 text-center text-[10px] uppercase tracking-[0.4em] text-ghost/50">
                  —— 江湖一梦 · 尽付诗笺 ——
                </p>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="animate-float-up flex flex-col gap-3">
            <button
              onClick={handleShare}
              disabled={!chronicleReady}
              className="option-btn h-[52px] w-full rounded-xl border-2 border-gold/70 bg-gold/10 text-base font-bold text-gold glow-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "✅ 战记与诗已复制！" : "📜 抄录战记与七律，传阅江湖"}
            </button>
            <button
              onClick={onRestart}
              className="option-btn h-[52px] w-full rounded-xl border border-white/15 bg-night-3/60 text-base font-bold text-parchment"
            >
              ↺ 重新投胎，再入江湖
            </button>
          </div>
        </>
      )}
    </div>
  );
}
