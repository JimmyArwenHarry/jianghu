// DeepSeek API 服务端调用封装（OpenAI 兼容接口）
// 仅供 Next.js Server Component / Route Handler 使用，绝不打进浏览器端。
//
// 可靠性要点（经过大量实测确认）：
// 1. deepseek-v4-flash 是推理模型，必须用 thinking: { type: "disabled" } 关闭思考，
//    否则 max_tokens 会被 reasoning_content 耗尽、content 为空。
// 2. 消息必须以 USER 消息收尾（system 收尾 100% 空白）。
// 3. 关键：不要使用 response_format: { type: "json_object" }。
//    实测该模式在长上下文下会让模型以 ~17%~100% 的概率输出"纯空白"（finish=stop、
//    几十到上百个空格 token），且随服务端波动剧烈，重试 nudge 也只能"再抛一次硬币"。
//    关闭它后模型从不空白，而是输出"剧情正文 + * 开头的选项列表"这样的结构化正文，
//    用下方的容错解析器即可稳定还原为 JSON 契约。

import type { ChatMessage } from "./types";

const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";

const MAX_ATTEMPTS = 5;

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "缺少 API Key：请在环境变量中配置 DEEPSEEK_API_KEY"
    );
  }
  return key;
}

function getModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
}

/* ================================================================
 * 容错解析器
 * ================================================================ */

/**
 * 容错 JSON 提取：DeepSeek 偶发会在 JSON 外包一层 markdown 围栏或前后有多余文字。
 */
export function extractJson(text: string): unknown {
  if (!text) throw new Error("模型返回内容为空");

  // 1) 直接解析
  try {
    return JSON.parse(text);
  } catch {
    /* 继续兜底 */
  }

  // 2) 去掉 ```json ... ``` 围栏
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* 继续兜底 */
  }

  // 3) 掐出第一个 { 到最后一个 } 之间的片段
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    const noTrailingComma = slice.replace(/,(\s*[}\]])/g, "$1");
    for (const candidate of [slice, noTrailingComma]) {
      try {
        return JSON.parse(candidate);
      } catch {
        /* 继续尝试 */
      }
    }
  }

  throw new Error("模型返回的不是合法 JSON：" + text.slice(0, 200));
}

/** 选项行前缀：* - •、1. 1、①（一）(1) 一、选项一 等 */
const OPTION_PREFIX_RE =
  /^(?:[*\-•]\s+|[①-⑳]\s*|[0-9一二三四五六七八九十]+[.、,，)）]\s*|[（(][0-9一二三四五六七八九十]+[)）]\s*|选项[一二三四五六七八九十A-Za-z][:：]?\s*)/;

/** 选项分隔标记：行首的【选项】/选项：/选项:（模型偶尔会先写"【选项】"再列选项） */
const OPTION_MARKER_RE = /^【?\s*选项\s*】?\s*[:：]?\s*/;

/** 清理正文尾部误粘的选项标记（如"……【选项】"） */
function cleanNarrative(s: string): string {
  return s.replace(/\s*【?\s*选项\s*】?\s*[:：]?\s*$/, "").trim();
}

/** 从结构化正文中提取选项行（兼容 *、-、•、1.、①、（一）、一、选项一 及 **加粗** 包裹） */
function extractOptionLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n/)) {
    let line = raw.trim();
    if (!line) continue;
    // 去掉行首的"【选项】/选项："标记（模型偶尔把它与第一个选项写在同一行）
    line = line.replace(OPTION_MARKER_RE, "").trim();
    // 去掉成对的加粗/斜体包裹（模型常把选项写成 **一、xxx** 或 * xxx *）
    const wrap = line.match(/^(\*{1,2}|_{1,2})([\s\S]+?)\1$/);
    if (wrap && wrap[2]) line = wrap[2].trim();
    if (!OPTION_PREFIX_RE.test(line)) continue;
    const cleaned = line.replace(OPTION_PREFIX_RE, "").trim();
    if (cleaned) out.push(cleaned);
  }
  return out;
}

/** 解析剧情输出：优先当 JSON；否则按"正文 + 选项列表"解析（导出以便单测） */
export function parseStoryContent(content: string): {
  narrative: string;
  options: string[];
} {
  // 1) JSON 形态（模型偶尔仍会输出 JSON）
  try {
    const raw = extractJson(content);
    const obj = (raw ?? {}) as Record<string, unknown>;
    const narrative = typeof obj.narrative === "string" ? obj.narrative : "";
    const options = Array.isArray(obj.options)
      ? obj.options.filter((o): o is string => typeof o === "string")
      : [];
    if (narrative.trim() && options.length >= 1) return { narrative, options };
  } catch {
    /* 不是 JSON，走正文解析 */
  }

  const lines = content.split(/\n/);

  // 2a) 模型若先写"【选项】"再列选项（甚至与第一个选项同一行），按标记切分——
  //     否则第一个选项会被误并入正文，只剩两个选项可点。
  const markerIdx = lines.findIndex((l) => OPTION_MARKER_RE.test(l.trim()));
  if (markerIdx !== -1) {
    const narrative = cleanNarrative(lines.slice(0, markerIdx).join("\n"));
    const optionsBlock = lines
      .slice(markerIdx)
      .join("\n")
      .replace(OPTION_MARKER_RE, "");
    const options = extractOptionLines(optionsBlock);
    if (narrative && options.length >= 1) return { narrative, options };
  }

  // 2b) 首条"像选项的行"之前是正文
  const firstBullet = lines.findIndex((l) => OPTION_PREFIX_RE.test(l.trim()));
  if (firstBullet !== -1) {
    const narrative = cleanNarrative(lines.slice(0, firstBullet).join("\n"));
    const options = extractOptionLines(content);
    return { narrative, options };
  }

  // 3) 整段当作剧情正文
  return { narrative: content.trim(), options: [] };
}

/* ================================================================
 * 单次调用
 * ================================================================ */

/** 单次调用，返回原始 content 字符串（不使用 response_format，规避空白输出） */
export async function singleCall(
  messages: ChatMessage[],
  maxTokens = 1500
): Promise<string> {
  const body = {
    model: getModel(),
    temperature: 1.05,
    max_tokens: maxTokens,
    thinking: { type: "disabled" },
    stream: false,
    messages,
  };
  let res: Response;
  try {
    res = await fetch(DEEPSEEK_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/timeout|abort/i.test(msg)) {
      throw new Error("请求超时：大模型迟迟未响应，请重试");
    }
    throw new Error("无法连接 DeepSeek API，请检查网络");
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message || detail;
    } catch {
      /* 保留原文 */
    }
    const status = res.status;
    if (status === 401) {
      throw new Error(
        "API Key 无效或已过期，请检查 DEEPSEEK_API_KEY"
      );
    }
    if (status === 429) {
      throw new Error("请求过于频繁（触发限流），请稍候再试");
    }
    if (status === 402) {
      throw new Error("DeepSeek 账户余额不足，请充值后重试");
    }
    throw new Error(`DeepSeek API 错误(${status})：${detail}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("DeepSeek 返回了无法解析的响应");
  }
  return data.choices?.[0]?.message?.content ?? "";
}

/* ================================================================
 * 剧情回合
 * ================================================================ */

export interface DeepSeekOptions {
  temperature?: number;
  maxTokens?: number;
}

/** 剧情回合：返回 { narrative, options }。空白/无选项时追加 nudge 提示重试。 */
export async function callDeepSeek(
  messages: ChatMessage[],
  opts: DeepSeekOptions & { requireOptions?: boolean } = {}
): Promise<{ narrative: string; options: string[] }> {
  const { maxTokens = 1500, requireOptions = true } = opts;

  /** 重试提示：引导模型回到"正文 + * 选项列表"结构 */
  const nudge = (attempt: number): ChatMessage => ({
    role: "user",
    content:
      `⚠️【自动重试·第 ${attempt} 次】你上一条回复不完整（缺少剧情正文或选项）。` +
      `请先写 60-90 字剧情正文，然后空一行，用 * 开头逐行列出 3 个选项。` +
      `不要JSON，不要markdown标题。`,
  });

  let lastErr: unknown = null;
  let current: ChatMessage[] = messages;
  let lastNarrative = "";
  let lastOptions: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const content = await singleCall(current, maxTokens);
    if (!content.trim()) {
      lastErr = new Error("模型返回内容为空");
      if (attempt < MAX_ATTEMPTS - 1) current = [...current, nudge(attempt + 1)];
      continue;
    }
    const { narrative, options } = parseStoryContent(content);
    // 记住最近一次有效正文，供兜底使用
    if (narrative.trim()) {
      lastNarrative = narrative;
      lastOptions = options;
    }
    if (narrative.trim() && (options.length >= 2 || !requireOptions)) {
      return { narrative, options };
    }
    lastErr = new Error("模型输出缺少剧情或选项");
    if (attempt < MAX_ATTEMPTS - 1) current = [...current, nudge(attempt + 1)];
  }

  // 兜底：正文已到手但选项始终不足时，单独补一次"只输出选项"（不重复正文）
  if (requireOptions && lastNarrative) {
    const recoveryMsg: ChatMessage = {
      role: "user",
      content:
        `【补全选项】你刚才的剧情正文可用，现在只需要列选项：` +
        `另起一行、以 * 开头逐行列出 3 个选项。不要重复正文，不要JSON，不要其他文字。`,
    };
    const recov = await singleCall([...current, recoveryMsg], 800).catch(() => "");
    const parsed = parseStoryContent(recov || "");
    if (parsed.options.length > 0) {
      return { narrative: lastNarrative, options: parsed.options.slice(0, 4) };
    }
    // 补选仍无果，但本轮已解析出少量选项 → 保底返回
    if (lastOptions.length > 0) {
      return { narrative: lastNarrative, options: lastOptions.slice(0, 4) };
    }
  }

  // 最坏情况：保底返回正文（客户端另有"续行"安全网，玩家不会卡死）
  if (lastNarrative) {
    console.warn("[deepseek] 选项始终解析不出，返回仅正文（客户端将走安全网）", {
      len: lastNarrative.length,
    });
    return { narrative: lastNarrative, options: lastOptions.slice(0, 4) };
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("剧情生成失败，请稍后重试");
}
