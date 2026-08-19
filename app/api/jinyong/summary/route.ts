import { NextRequest, NextResponse } from "next/server";
import { buildJinYongPrompt } from "@/lib/jinyong-prompt";
import { callChronicle } from "@/lib/jinyong";
import {
  isRoleKey,
  roleEmoji,
  roleLabel,
  type RoleKey,
  isNovelKey,
  getNovelSetting,
} from "@/lib/jinyong";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 战记指令：约 400 字说书人口气正文 + 一首七律（不要求 JSON，规避空白问题） */
function chronicleInstruction(
  role: RoleKey | undefined,
  destiny: string | undefined,
  reading: string | undefined,
  character: string | undefined
): string {
  const roleNote = role
    ? `这位「${roleEmoji(role)}${roleLabel(role)}」出身`
    : "这位出身卑微的乱世小人物";
  const destinyNote =
    destiny && reading
      ? `呼应玩家测字所得的一字「${character}」与命格「${destiny}」（先生判曰：${reading}），在结尾点题`
      : destiny
        ? `呼应玩家测得的命格「${destiny}」，在结尾点题`
        : "呼应玩家卑微的出身，在结尾点题";
  return `【总结指令】《江湖录》这部乱世武侠的故事已经落幕。请化身为茶馆里醒木一拍的说书先生，为这段草民的一生作一部约 400 字的战记（控制在 300~450 字，务必凝练，写紧、写短，删去铺陈）。
要求：
- 以"说书人"的口吻（"话说当年""这一去，便是十年""正是——"），半文半白，有节奏、有悬念、有余味；
- 回顾${roleNote}从卑微到终局的一生际遇：择其关键三四处，写尽恩怨情仇、成败生死，点到即止，不必事无巨细；
- 战记要与他所经历的朝代为底色（本局时代背景已告知于你），提及他遇过的豪杰、卷进的大事，但不要点破"这是某本书里的事"；
- 战记要如实写下这位草民一生的善恶走向——是侠名远播、恶贯满盈，还是亦正亦邪，终局报应与这一走向相称；
- ${destinyNote}；
- 正文写完之后，另起一行单独写【七律】三个字，再另起一行，为这部江湖作一首七言律诗：
  八句、每句七字、偶数句押平水韵、颔联与颈联须对仗；诗题可写可不写；全诗须回望全剧、点破宿命。
直接输出正文与诗即可，不要JSON，不要markdown标题，不要"总结如下"之类的多余前缀。`;
}

export async function POST(req: NextRequest) {
  let body: {
    history?: ChatMessage[];
    role?: unknown;
    destiny?: unknown;
    reading?: unknown;
    character?: unknown;
    novel?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  if (history.length === 0) {
    return NextResponse.json({ error: "缺少剧情历史" }, { status: 400 });
  }
  const role = isRoleKey(body.role) ? body.role : undefined;
  const destiny =
    typeof body.destiny === "string" && body.destiny.trim()
      ? body.destiny.trim().slice(0, 16)
      : undefined;
  const reading =
    typeof body.reading === "string" && body.reading.trim()
      ? body.reading.trim().slice(0, 120)
      : undefined;
  const character =
    typeof body.character === "string" && Array.from(body.character.trim()).length === 1
      ? Array.from(body.character.trim())[0]
      : undefined;
  // 本局小说：沿用 chat 阶段抽定并回传的 key（天机，仅服务端使用）
  const novel = isNovelKey(body.novel)
    ? getNovelSetting(body.novel) ?? undefined
    : undefined;

  // 必须以 USER 消息收尾（deepseek-v4-flash 在 thinking:disabled 下 system 收尾会返回空白）
  const messages: ChatMessage[] = [
    { role: "system", content: buildJinYongPrompt(role, destiny, reading, novel) },
    ...history,
    { role: "user", content: chronicleInstruction(role, destiny, reading, character) },
  ];

  try {
    const { chronicle, poem } = await callChronicle(messages);
    return NextResponse.json({ data: { chronicle, poem } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "总结生成失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
