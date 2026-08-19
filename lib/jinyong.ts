// 《江湖录》—— 金庸文风武侠 RPG 的共享数据与 DeepSeek 调用
// 复用 lib/deepseek.ts 的 singleCall / extractJson（同样的可靠性约束）：
//   1) 消息以 USER 收尾；2) 不用 response_format json_object；
//   3) 用"结构化正文契约"+ 服务端容错解析。

import { singleCall, extractJson, type DeepSeekOptions } from "./deepseek";
import type { ChatMessage } from "./types";

/* ================================================================
 * 开场身份（卑贱角色）
 * ================================================================ */

export type RoleKey =
  | "farmer"
  | "beggar"
  | "rogue"
  | "courtesan"
  | "scholar"
  | "watchman";

export interface RoleOption {
  key: RoleKey;
  label: string;
  emoji: string;
  desc: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { key: "farmer", label: "农民", emoji: "🌾", desc: "世代务农 · 困顿求存" },
  { key: "beggar", label: "乞丐", emoji: "🥣", desc: "破碗沿街 · 乞命四方" },
  { key: "rogue", label: "小流氓", emoji: "🔪", desc: "街头无赖 · 油滑狡黠" },
  { key: "courtesan", label: "妓女", emoji: "🌺", desc: "青楼卖笑 · 身不由己" },
  { key: "scholar", label: "落魄书生", emoji: "📜", desc: "科场失意 · 穷困潦倒" },
  { key: "watchman", label: "更夫", emoji: "🏮", desc: "夜夜打更 · 见证风月" },
];

export function isRoleKey(v: unknown): v is RoleKey {
  return ROLE_OPTIONS.some((r) => r.key === v);
}

export function roleLabel(key: RoleKey): string {
  return ROLE_OPTIONS.find((r) => r.key === key)?.label ?? "无名小卒";
}

export function roleEmoji(key: RoleKey): string {
  return ROLE_OPTIONS.find((r) => r.key === key)?.emoji ?? "🥀";
}

/* ================================================================
 * 测字命格
 * ================================================================ */

export interface Fortune {
  /** 玩家写下的那个字 */
  character: string;
  /** 命格名（4~8 字断语） */
  destiny: string;
  /** 判词（≤60 字） */
  reading: string;
}

/** 清洗命格名：去掉 【】、方括号、行首"命格："等多余前缀 */
function cleanDestiny(line: string): string {
  return line
    .replace(/^【[^】]*】\s*/g, "")
    .replace(/^[*\-•]?\s*/, "")
    .replace(/^(命格|命理|此命|八字)[:：]?\s*/g, "")
    .replace(/^「|」$/g, "")
    .trim();
}

/** 解析测字输出：优先当 JSON；否则按"第一行命格名 + 剩余为判词"解析 */
function parseFortuneContent(content: string): Fortune | null {
  // 1) JSON 形态
  try {
    const raw = extractJson(content);
    const obj = (raw ?? {}) as Record<string, unknown>;
    const destinyRaw =
      typeof obj.destiny === "string"
        ? obj.destiny
        : typeof obj.destiny_name === "string"
          ? obj.destiny_name
          : typeof obj.mingge === "string"
            ? obj.mingge
            : "";
    if (destinyRaw.trim()) {
      return {
        character: "",
        destiny: cleanDestiny(destinyRaw),
        reading:
          typeof obj.reading === "string" ? obj.reading.trim() : "",
      };
    }
  } catch {
    /* 不是 JSON，走行解析 */
  }

  // 2) 行解析：第一行是命格名，剩余为判词
  const lines = content
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const destiny = cleanDestiny(lines[0]);
  if (!destiny) return null;
  const reading = lines.slice(1).join("\n").trim();
  return { character: "", destiny, reading };
}

/** 测字：根据玩家写的一个字判命格。空白/无命格时 nudge 重试，最终兜底。 */
export async function callFortune(
  messages: ChatMessage[],
  opts: DeepSeekOptions = {}
): Promise<Fortune> {
  const { maxTokens = 500 } = opts;
  const MAX_ATTEMPTS = 5;

  const nudge = (attempt: number): ChatMessage => ({
    role: "user",
    content:
      `⚠️【自动重试·第 ${attempt} 次】只输出两行：` +
      `第一行是命格名（4~8个字，江湖断语），` +
      `第二行是 60 字以内的判词。不要JSON，不要编号，不要多余文字。`,
  });

  let lastErr: unknown = null;
  let current: ChatMessage[] = messages;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const content = await singleCall(current, maxTokens);
    if (!content.trim()) {
      lastErr = new Error("模型返回内容为空");
      if (attempt < MAX_ATTEMPTS - 1) current = [...current, nudge(attempt + 1)];
      continue;
    }
    const parsed = parseFortuneContent(content);
    if (parsed && parsed.destiny) {
      return parsed;
    }
    lastErr = new Error("模型输出缺少命格名");
    if (attempt < MAX_ATTEMPTS - 1) current = [...current, nudge(attempt + 1)];
  }
  // 兜底：给一条天机难测的命格，保证玩家能继续
  return {
    character: "",
    destiny: "潜龙在渊",
    reading: "（先生掐指一算，只道你笔下一撇一捺里，藏着一番大造化。）",
  };
}

/* ================================================================
 * 战记总结：约 800 字金庸文风正文 + 一首七律
 * ================================================================ */

export interface Chronicle {
  /** 约 800 字战记正文 */
  chronicle: string;
  /** 卷末七言律诗（含诗题行则一并保留） */
  poem: string;
}

/** 从输出中切出正文与七律：优先 JSON；否则按【七律】等标记切分 */
function parseChronicleContent(content: string): Chronicle | null {
  // 1) JSON 形态
  try {
    const raw = extractJson(content);
    const obj = (raw ?? {}) as Record<string, unknown>;
    const chronicle =
      typeof obj.chronicle === "string"
        ? obj.chronicle
        : typeof obj.summary === "string"
          ? obj.summary
          : "";
    const poem =
      typeof obj.poem === "string"
        ? obj.poem
        : typeof obj.qilv === "string"
          ? obj.qilv
          : "";
    if (chronicle.trim()) {
      return { chronicle: chronicle.trim(), poem: poem.trim() };
    }
  } catch {
    /* 不是 JSON，走标记切分 */
  }

  // 2) 标记切分：正文在前，标记行（【七律】/【七言律诗】/七律：…）之后是诗
  const marker =
    /【七言律诗】|【七律】|七言律诗\s*[:：]|七律\s*[:：]|^七律$|^律诗$/m;
  const m = content.match(marker);
  if (m && m.index !== undefined) {
    const chronicle = content.slice(0, m.index).trim();
    const poem = content.slice(m.index + m[0].length).trim();
    return { chronicle, poem };
  }

  // 3) 兜底：整段当正文，无诗
  return { chronicle: content.trim(), poem: "" };
}

/** 生成战记：约 800 字金庸文风正文 + 一首七律。正文不足或七律缺失时 nudge 重试。 */
export async function callChronicle(
  messages: ChatMessage[],
  opts: DeepSeekOptions = {}
): Promise<Chronicle> {
  const { maxTokens = 3000 } = opts;
  const MAX_ATTEMPTS = 5;

  const nudge = (attempt: number): ChatMessage => ({
    role: "user",
    content:
      `⚠️【自动重试·第 ${attempt} 次】请先输出不少于 700 字的战记正文（金庸文风），` +
      `然后另起一行单独写【七律】，再另起一行输出全诗（八句、每句七字）。不要JSON，不要标题，不要多余文字。`,
  });

  let lastErr: unknown = null;
  let current: ChatMessage[] = messages;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const content = await singleCall(current, maxTokens);
    if (!content.trim()) {
      lastErr = new Error("模型返回内容为空");
      if (attempt < MAX_ATTEMPTS - 1) current = [...current, nudge(attempt + 1)];
      continue;
    }
    const parsed = parseChronicleContent(content);
    if (parsed && parsed.chronicle.length >= 400) {
      return parsed;
    }
    lastErr = new Error("模型输出的战记过短或缺失");
    if (attempt < MAX_ATTEMPTS - 1) current = [...current, nudge(attempt + 1)];
  }
  // 兜底：用最后一次内容，至少保住正文
  const last =
    parseChronicleContent(
      (await singleCall(current, maxTokens).catch(() => "")) || ""
    ) ?? { chronicle: "", poem: "" };
  return {
    chronicle: last.chronicle || "江湖风起，尽付笑谈。",
    poem: last.poem || "",
  };
}
