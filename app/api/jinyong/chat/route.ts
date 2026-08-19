import { NextRequest, NextResponse } from "next/server";
import { buildJinYongPrompt } from "@/lib/jinyong-prompt";
import { callDeepSeek } from "@/lib/deepseek";
import {
  isRoleKey,
  roleEmoji,
  roleLabel,
  type RoleKey,
  isNovelKey,
  pickNovel,
  getNovelSetting,
} from "@/lib/jinyong";
import type { ChatMessage, StoryResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOTAL_TURNS = 10;

interface RequestBody {
  history?: ChatMessage[];
  /** 当前生成序号：1~10 为剧情回合，10 为结局结算 */
  turn?: number;
  /** 开局选择的身份（可选） */
  role?: unknown;
  /** 测字命格名（可选） */
  destiny?: unknown;
  /** 判词（可选） */
  reading?: unknown;
  /** 本局抽定的小说 key（开局由服务端抽取并下发，客户端原样回传） */
  novel?: unknown;
}

/** 本回定位：按人生阶段给出节奏/格局提示（前期快、中期立、后期清算） */
function turnPhaseNote(turn: number): string {
  if (turn === 1)
    return '\n【本回定位·开场即入戏】不要细写出身与测字（玩家已在卦摊见过测字一幕，一句带过即可）。直接把你按进一个具体的乱世变故里——一场劫掠、一桩恩怨、一次奇遇，让你当场就必须抉择。结尾要留下悬念与推力，让下一回自然接续。';
  if (turn <= 3)
    return '\n【本回定位·前期提速】主角仍是无名之辈，但命运的车轮已经开始转动。每回都要让时间推进（数月到数年），人物、恩怨、际遇持续向前，**不要在一处场景里反复磨蹭**。到第 3 回结束时，主角应当已经历一两桩足以改变命运的大事。';
  if (turn <= 7)
    return "\n【本回定位·中期】主角正在崛起。这一回写一个大节点——遇名师、得奇遇、结血仇、陷危机、立名声，武功、名声或恶名稳步上升。每回一个台阶，越往上走格局越大。";
  if (turn === 8)
    return "\n【本回定位·收束前奏】风云将起。主角的恩怨与地位已到总清算的前夜，仇家、盟友、旧事纷纷浮出水面，为下一回的最终大高潮蓄势。此回结尾要明显'山雨欲来'。";
  return '\n【本回定位·最终大高潮】主角已是大侠或大恶人，一切伏笔在此引爆：一场决战、一个阴谋的真相大白、一次决定其"侠"或"恶"的生死抉择。要把此前积累的恩怨、人物全部收拢到这一场中来。仍需给出 3 个选项。';
}

/** 普通剧情回合指令：正文 + * 选项列表（不要求 JSON，规避 json_object 空白问题） */
function storyInstruction(
  turn: number,
  role?: RoleKey,
  destiny?: string
): string {
  const roleNote =
    turn === 1 && role
      ? `\n（本局开局你是「${roleEmoji(role)}${roleLabel(role)}」${destiny ? `，曾在卦摊测得命格「${destiny}」` : ""}。测字场面玩家已见过，一句带过即可，**不要重述**。直接开写你当下所处的困境与即将砸到头上的变故，让命运从这里开始滚动。）`
      : "";
  const destinyNote = destiny
    ? `\n（本局你的命格是「${destiny}」，剧情要暗中呼应这条命格，让选择与际遇隐隐与它应和。）`
    : "";
  return (
    `【回合指令】第 ${turn} 回合（turn=${turn}）。` +
    `请先写 60-90 字剧情正文（承接上文，金庸笔法，半文半白、有画面感、点到即止，可以跨过数月至数年推进人生），` +
    `然后在最后单独列出 3 个选项，每个选项单独一行并以 * 开头。` +
    `本回选项必须善恶对立：至少一个"向善/侠义"选项（如救人济困、仗义执言）、一个"向恶/邪道"选项（如杀人越货、损人利己），` +
    `第三个可为中立或私利；不同选择的后果要截然不同、分道扬镳，不要殊途同归。` +
    `不要JSON，不要markdown标题，不要多余的说明文字。` +
    turnPhaseNote(turn) +
    roleNote +
    destinyNote
  );
}

/** 结局回合指令：只需结局正文，无选项 */
function endingInstruction(role?: RoleKey, destiny?: string): string {
  const roleNote = role
    ? `（这位玩家以「${roleEmoji(role)}${roleLabel(role)}」之身踏入江湖）`
    : "";
  const destinyNote = destiny
    ? `结局务必与玩家测得的命格「${destiny}」呼应并点题，有余韵、有留白。`
    : "结局要有余韵、有留白。";
  return (
    `【回合指令】第 ${TOTAL_TURNS} 回合（turn=${TOTAL_TURNS}），这是游戏结局，也是这位草民一生的终点。` +
    `请根据玩家过去所有选择，写一段 120-200 字的结局正文：为${roleNote}的一生作结——` +
    `先回顾玩家此前选择的善恶走向（行善积德还是为非作歹、亦或亦正亦邪），再写出与这一走向"截然不同"的终局：` +
    `侠义之人得侠名、受敬重；作恶之人众叛亲离、身败名裂，或侥幸成枭雄却夜夜难安；亦正亦邪者各有灰色归宿。` +
    `点明他最终成了大侠还是大恶人、或有怎样超乎寻常的归宿（功成身退、隐于市井、立身扬名、香消玉殒、看破红尘……），` +
    `并与前文关键事件、人生各阶段的节点呼应，站在"一生"的高度收束。` +
    `结尾要顺势收束、有尘埃落定之感，**不要戛然而止**：先写最终大事的余波，再以"多年后"或"晚年回望"的视角交代这一生的终局与归宿，读来有宿命昭彰、余音袅袅的味道。` +
    `${destinyNote}` +
    `直接输出结局正文即可，不要JSON，不要选项，不要标题。`
  );
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const turn = Number(body.turn) || 1;
  // 非法身份宽容处理：视为未选
  const role = isRoleKey(body.role) ? body.role : undefined;
  const destiny = typeof body.destiny === "string" && body.destiny.trim()
    ? body.destiny.trim().slice(0, 16)
    : undefined;
  const reading = typeof body.reading === "string" && body.reading.trim()
    ? body.reading.trim().slice(0, 120)
    : undefined;

  // 本局小说：开局由服务端随机抽定（天机），客户端回传后沿用；非法则重新抽一部
  const novelKey = isNovelKey(body.novel) ? body.novel : pickNovel().key;
  const novel = getNovelSetting(novelKey) ?? undefined;

  if (history.length === 0 && turn === 1) {
    return NextResponse.json({ error: "缺少对话历史" }, { status: 400 });
  }

  const isEnding = turn >= TOTAL_TURNS;

  // 构建消息：System + 历史 + 回合指令（必须以 USER 消息收尾，规避空白输出）
  const turnInstruction = isEnding
    ? endingInstruction(role, destiny)
    : storyInstruction(turn, role, destiny);
  const messages: ChatMessage[] = [
    { role: "system", content: buildJinYongPrompt(role, destiny, reading, novel) },
    ...history,
    { role: "user", content: turnInstruction },
  ];

  try {
    const { narrative, options } = await callDeepSeek(messages, {
      requireOptions: !isEnding,
    });
    const story: StoryResponse = {
      narrative: isEnding ? "" : narrative,
      options: isEnding ? [] : options,
      is_ending: isEnding,
      ending_story: isEnding ? narrative : "",
      achievements: [],
      novel: novelKey,
    };
    return NextResponse.json({ data: story });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
