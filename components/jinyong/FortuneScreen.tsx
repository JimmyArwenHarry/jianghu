"use client";

import { useState } from "react";
import { roleEmoji, roleLabel, type Fortune, type RoleKey } from "@/lib/jinyong";
import Loading from "./Loading";

interface FortuneScreenProps {
  role: RoleKey;
  onStart: (fortune: Fortune) => void;
  onBack: () => void;
}

type Status = "idle" | "loading" | "done" | "error";

export default function FortuneScreen({
  role,
  onStart,
  onBack,
}: FortuneScreenProps) {
  const [char, setChar] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Fortune | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async () => {
    const c = Array.from(char.trim()).join("");
    if (!c) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/jinyong/divination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: c, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
      }
      setResult({
        character: json.data?.character ?? c,
        destiny: json.data?.destiny || "潜龙在渊",
        reading: json.data?.reading || "",
      });
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "测字失败");
      setStatus("error");
    }
  };

  return (
    <div className="animate-float-up flex flex-col items-center gap-6 pt-10 text-center">
      {status === "done" && result ? (
        /* ---- 测字结果：命格 ---- */
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.4em] text-gold/80 glow-gold">
              Mìnggé
            </p>
            <h2 className="animate-glitch text-2xl font-black text-gold glow-gold">
              测字 · 断命
            </h2>
          </div>

          <div className="relative w-full overflow-hidden rounded-2xl border-2 border-gold/40 bg-night-2/80 p-6 backdrop-blur glow-gold">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_0%,rgba(215,178,92,0.5),transparent_60%)]" />
            <p className="text-xs text-ghost">
              你写下的「<span className="text-2xl font-black text-parchment">{result.character}</span>」，
              先生盯着那字看了半晌，忽然长叹一声：
            </p>
            <div className="my-4 text-6xl">{roleEmoji(role)}</div>
            <div className="font-serif text-2xl font-black tracking-widest text-vermillion glow-red">
              {result.destiny}
            </div>
            <p className="mt-4 text-sm leading-6 text-ghost">
              <span className="text-gold/80">判词：</span>
              {result.reading}
            </p>
            <p className="mt-4 text-[11px] text-ghost/50">
              —— 你以「{roleEmoji(role)}{roleLabel(role)}」之身，带着这条命格踏入江湖
            </p>
          </div>

          <button
            onClick={() => onStart(result)}
            className="option-btn h-[52px] w-full max-w-sm rounded-xl border-2 border-gold/70 bg-gold/10 text-lg font-bold tracking-widest text-gold glow-gold"
          >
            携「{result.destiny}」命格 · 踏入江湖 ▶
          </button>
          <div className="flex gap-4 text-xs text-ghost/70">
            <button
              onClick={() => {
                setStatus("idle");
                setResult(null);
                setChar("");
              }}
              className="hover:text-gold"
            >
              ↻ 重测一个字
            </button>
            <button onClick={onBack} className="hover:text-cyber">
              ← 重择身份
            </button>
          </div>
        </div>
      ) : (
        /* ---- 输入一个字 ---- */
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.4em] text-gold/80 glow-gold">
              Cè zì
            </p>
            <h2 className="animate-glitch text-2xl font-black text-gold glow-gold">
              卦摊测字
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-ghost">
              乱世街角，算命先生的卦摊支着一面褪了色的旗。
              你以<span className="text-gold">{roleEmoji(role)}{roleLabel(role)}</span>之身坐定，
              在纸上写下一个字。先生将按
              <strong className="text-gold">笔画、五行、字义与意境</strong>，
              判你一桩宿命——这命格，将随你走完整部江湖。
            </p>
          </div>

          <div className="flex w-full items-center justify-center">
            <input
              type="text"
              value={char}
              onChange={(e) =>
                setChar(Array.from(e.target.value).slice(0, 1).join(""))
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="字"
              aria-label="写下一个字"
              autoFocus
              className="h-[84px] w-[84px] rounded-2xl border-2 border-gold/25 bg-night-3/80 text-center text-5xl font-black text-gold outline-none backdrop-blur focus:border-gold/70 glow-gold"
            />
          </div>
          {char && Array.from(char).length !== 1 && (
            <p className="text-xs text-vermillion">请只写下一个字</p>
          )}

          {status === "error" && (
            <p className="max-w-xs text-sm leading-6 text-vermillion">{errorMsg}</p>
          )}

          <button
            onClick={submit}
            disabled={!char || status === "loading"}
            className={`option-btn h-[52px] w-full max-w-sm rounded-xl border-2 px-6 text-lg font-bold tracking-widest ${
              char && status !== "loading"
                ? "border-gold/70 bg-gold/10 text-gold glow-gold"
                : "cursor-not-allowed border-black/10 bg-black/5 text-ghost/50"
            }`}
          >
            {status === "loading" ? "先生正在断字…" : "落笔 · 求一卦 🖌"}
          </button>

          <button
            onClick={onBack}
            className="text-xs text-ghost/70 hover:text-cyber"
          >
            ← 重择身份
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="mt-2">
          <Loading />
        </div>
      )}
    </div>
  );
}
