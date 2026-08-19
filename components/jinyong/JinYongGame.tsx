"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, StoryResponse } from "@/lib/types";
import type { RoleKey, Fortune } from "@/lib/jinyong";
import Typewriter from "@/components/Typewriter";
import Markdown from "@/components/Markdown";
import TurnIndicator from "@/components/TurnIndicator";
import StartScreen from "./StartScreen";
import FortuneScreen from "./FortuneScreen";
import Loading from "./Loading";
import EndingView from "./EndingView";

const TOTAL_TURNS = 10;
const NUM_CHIPS = ["一", "二", "三", "四"];

const GAME_START: ChatMessage = {
  role: "user",
  content: "游戏开始：乱世如炉，众生如柴。我，一个无名小卒，动了踏入江湖的念头。",
};

/** 模型偶发 0 选项时，供"续行"安全网使用的兜底选择 */
const FALLBACK_CHOICE =
  "（情势陡变，我按自己的性子见机行事，先走一步看一步。）";

type Phase = "start" | "fortune" | "loading" | "story" | "ending" | "error";

export default function JinYongGame() {
  const [phase, setPhase] = useState<Phase>("start");
  const [history, setHistory] = useState<ChatMessage[]>([GAME_START]);
  const [role, setRole] = useState<RoleKey | null>(null);
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [turn, setTurn] = useState(1);
  const [story, setStory] = useState<StoryResponse | null>(null);
  const [lastChoice, setLastChoice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [doneTyping, setDoneTyping] = useState(false);
  const [skipTyping, setSkipTyping] = useState(false);

  // 结局流程：战记 + 七律
  const [chronicle, setChronicle] = useState("");
  const [chronicleStatus, setChronicleStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [poem, setPoem] = useState("");
  const [endingError, setEndingError] = useState("");

  // 本局抽定的原著小说 key（天机：仅用于回传后端，绝不渲染给玩家）
  const [novelKey, setNovelKey] = useState<string | null>(null);

  const pendingRef = useRef<{ history: ChatMessage[]; turn: number } | null>(null);
  const busyRef = useRef(false);
  const endingBusyRef = useRef(false);

  // ---- 结局流程：战记 + 七律 ----
  const beginEndingFlow = useCallback(
    async (fullHistory: ChatMessage[]) => {
      if (endingBusyRef.current) return;
      endingBusyRef.current = true;
      setChronicleStatus("loading");
      setEndingError("");
      try {
        const res = await fetch("/api/jinyong/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: fullHistory,
            role,
            destiny: fortune?.destiny,
            reading: fortune?.reading,
            character: fortune?.character,
            novel: novelKey,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.error) {
          throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
        }
        const sum = (json.data?.chronicle || "").trim();
        if (!sum) throw new Error("战记生成失败：模型未返回有效内容");
        setChronicle(sum);
        setPoem((json.data?.poem || "").trim());
        setChronicleStatus("done");
      } catch (e) {
        setEndingError(e instanceof Error ? e.message : "战记生成失败");
        setChronicleStatus("error");
      } finally {
        endingBusyRef.current = false;
      }
    },
    [role, fortune, novelKey]
  );

  const retryEndingFlow = () => {
    if (history.length > 0) {
      void beginEndingFlow(history);
    }
  };

  // ---- 剧情回合 ----
  const requestStory = useCallback(
    async (nextHistory: ChatMessage[], nextTurn: number) => {
      if (busyRef.current) return;
      busyRef.current = true;
      pendingRef.current = { history: nextHistory, turn: nextTurn };
      setPhase("loading");
      setErrorMsg("");
      setSkipTyping(false);
      try {
        const res = await fetch("/api/jinyong/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: nextHistory,
            turn: nextTurn,
            role,
            destiny: fortune?.destiny,
            reading: fortune?.reading,
            novel: novelKey,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.error) {
          throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
        }
        const s = json.data as StoryResponse;
        // 开局回合服务端抽定本局小说，回传 key 后由客户端存起（天机，不渲染）
        if (s.novel) setNovelKey(s.novel);
        setStory(s);
        setTurn(nextTurn);
        setDoneTyping(false);
        if (s.is_ending) {
          const fullHistory: ChatMessage[] = [
            ...nextHistory,
            { role: "assistant", content: s.ending_story },
          ];
          setHistory(fullHistory);
          setPhase("ending");
          void beginEndingFlow(fullHistory);
        } else {
          setHistory((h) => [
            ...h,
            { role: "assistant", content: s.narrative },
          ]);
          setPhase("story");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "网络连接异常";
        setErrorMsg(msg);
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [beginEndingFlow, role, fortune, novelKey]
  );

  // 择定身份后进入卦摊测字
  const startGame = (r: RoleKey) => {
    setRole(r);
    setFortune(null);
    setPhase("fortune");
  };

  // 测字完成：带着命格真正开局
  const startStory = (f: Fortune) => {
    setFortune(f);
    requestStory([GAME_START], 1);
  };

  const choose = useCallback(
    (option: string) => {
      if (busyRef.current || !story) return;
      const nextHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: option },
      ];
      // 立即把玩家的选择写进 history——此前只追加 assistant 剧情，
      // 导致第 3 回合起发给模型的对话缺了选择、变得错乱（user,assistant,assistant…），
      // 这是"第 4 回合选项消失、卡死"的根源之一。
      setHistory(nextHistory);
      setLastChoice(option);
      requestStory(nextHistory, turn + 1);
    },
    [history, story, turn, requestStory]
  );

  const retry = () => {
    if (pendingRef.current) {
      requestStory(pendingRef.current.history, pendingRef.current.turn);
    }
  };

  const restart = () => {
    setHistory([GAME_START]);
    setRole(null);
    setFortune(null);
    setTurn(1);
    setStory(null);
    setLastChoice("");
    setErrorMsg("");
    setDoneTyping(false);
    setSkipTyping(false);
    setChronicle("");
    setChronicleStatus("idle");
    setPoem("");
    setEndingError("");
    setNovelKey(null);
    setPhase("start");
  };

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-16 pt-5 sm:pt-8">
      {/* 顶部回合指示器 */}
      {phase !== "start" && phase !== "fortune" && (
        <header className="sticky top-0 z-30 -mx-4 mb-5 bg-night/80 px-4 py-3 backdrop-blur">
          <TurnIndicator
            turn={Math.min(turn, TOTAL_TURNS)}
            total={TOTAL_TURNS}
            title="江湖录"
          />
        </header>
      )}

      <main className="flex flex-1 flex-col">
        {phase === "start" && <StartScreen onStart={startGame} />}
        {phase === "fortune" && role && (
          <FortuneScreen
            role={role}
            onStart={startStory}
            onBack={() => {
              setRole(null);
              setFortune(null);
              setPhase("start");
            }}
          />
        )}
        {phase === "loading" && <Loading />}
        {phase === "error" && (
          <ErrorView msg={errorMsg} onRetry={retry} onRestart={restart} />
        )}
        {phase === "story" && story && (
          <StoryView
            story={story}
            turn={turn}
            role={role}
            doneTyping={doneTyping}
            skipTyping={skipTyping}
            lastChoice={lastChoice}
            onSkip={() => setSkipTyping(true)}
            onDone={() => setDoneTyping(true)}
            onChoose={choose}
          />
        )}
        {phase === "ending" && story && (
          <EndingView
            endingStory={story.ending_story}
            chronicle={chronicle}
            chronicleStatus={chronicleStatus}
            poem={poem}
            endingError={endingError}
            onRetry={retryEndingFlow}
            onRestart={restart}
          />
        )}
      </main>

      <footer className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ghost/40">
        ⚔️🏮🌾 · 江湖录 · AI 以金庸笔法，实时写就
      </footer>
    </div>
  );
}

/* ============ 剧情回合视图 ============ */
interface StoryViewProps {
  story: StoryResponse;
  turn: number;
  role: RoleKey | null;
  doneTyping: boolean;
  skipTyping: boolean;
  lastChoice: string;
  onSkip: () => void;
  onDone: () => void;
  onChoose: (option: string) => void;
}

function StoryView({
  story,
  turn,
  role,
  doneTyping,
  skipTyping,
  lastChoice,
  onSkip,
  onDone,
  onChoose,
}: StoryViewProps) {
  const isFinale = turn >= 9;
  return (
    <div className="animate-float-up flex flex-col gap-4">
      {/* 回目标签 */}
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-xs font-bold text-gold">
          {isFinale ? "⚡ 终章高潮" : `第 ${turn} 回`}
        </span>
        <span className="text-xs text-ghost/60">
          {role ? "江湖录 · 卑贱子的逆命" : "江湖录 · 刀光里求一口命"}
        </span>
      </div>

      {/* 剧情卡片（点击跳过打字机） */}
      <div
        onClick={onSkip}
        className="cursor-pointer rounded-2xl border border-black/10 bg-night-2/80 p-5 backdrop-blur"
      >
        <Typewriter
          key={story.narrative}
          text={story.narrative}
          skip={skipTyping}
          speed={28}
          stepChars={
            story.narrative.length > 180 ? 3 : story.narrative.length > 90 ? 2 : 1
          }
          onDone={onDone}
        >
          {(revealed) => (
            <>
              <Markdown variant="wuxia">{revealed}</Markdown>
              {!doneTyping && (
                <span className="animate-blink text-vermillion">▍</span>
              )}
            </>
          )}
        </Typewriter>
        {!doneTyping && (
          <p className="mt-2 text-right text-[10px] text-ghost/40">
            点击剧情可跳过 ▸
          </p>
        )}
      </div>

      {/* 上一选择回显 */}
      {lastChoice && (
        <div className="rounded-lg border border-black/5 bg-night-3/40 px-4 py-2 text-xs text-ghost">
          <span className="mr-1.5 font-bold text-gold">➤</span>
          <span className="mr-1 text-gold">你之所择：</span>
          {lastChoice}
        </div>
      )}

      {/* 选项按钮 */}
      <div className="flex flex-col gap-3">
        {story.options.map((opt, i) => (
          <button
            key={i}
            disabled={!doneTyping}
            onClick={() => onChoose(opt)}
            className="option-btn min-h-[48px] w-full rounded-xl border border-black/15 bg-night-3/70 px-4 py-3 text-left text-[15px] leading-6 text-parchment"
          >
            <span className="mr-2 font-mono text-gold">
              {NUM_CHIPS[i] ?? `(${i + 1})`}
            </span>
            {opt}
          </button>
        ))}
        {/* 安全网：非结局却一个选项都没有时，绝不卡死玩家 */}
        {!story.is_ending && story.options.length === 0 && (
          <button
            disabled={!doneTyping}
            onClick={() => onChoose(FALLBACK_CHOICE)}
            className="option-btn min-h-[48px] w-full rounded-xl border-2 border-vermillion/60 bg-vermillion/10 px-4 py-3 text-left text-[15px] leading-6 text-parchment"
          >
            <span className="mr-2 font-mono text-gold">☍</span>
            风云突变 · 且行且看，续走江湖 ▸
          </button>
        )}
        {!doneTyping && (
          <p className="animate-blink text-center text-xs text-ghost/60">
            这一回尚在书写，请稍候…
          </p>
        )}
      </div>
    </div>
  );
}

/* ============ 错误视图 ============ */
function ErrorView({
  msg,
  onRetry,
  onRestart,
}: {
  msg: string;
  onRetry: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="animate-float-up flex flex-col items-center gap-4 py-16 text-center">
      <div className="text-5xl">💥</div>
      <p className="text-lg font-bold text-parchment">江湖风急，消息隔断</p>
      <p className="max-w-xs text-sm leading-6 text-ghost">{msg}</p>
      <button
        onClick={onRetry}
        className="option-btn h-[50px] w-full max-w-xs rounded-xl border-2 border-gold/70 bg-gold/10 font-bold text-gold glow-gold"
      >
        🔄 快马传书，续上这一回
      </button>
      <button
        onClick={onRestart}
        className="h-[50px] w-full max-w-xs rounded-xl border border-black/15 text-sm text-ghost"
      >
        回到江湖门外
      </button>
    </div>
  );
}
