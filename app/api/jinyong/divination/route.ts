import { NextRequest, NextResponse } from "next/server";
import { buildJinYongPrompt } from "@/lib/jinyong-prompt";
import { callFortune } from "@/lib/jinyong";
import { isRoleKey, roleEmoji, roleLabel, type RoleKey } from "@/lib/jinyong";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** 测字指令：结构化正文契约（不要求 JSON，规避 json_object 空白问题） */
function fortuneInstruction(character: string, role?: RoleKey): string {
  const roleNote = role
    ? `玩家是一位「${roleEmoji(role)}${roleLabel(role)}」。`
    : "";
  return (
    `【测字指令】乱世街角，一位深藏不露的算命先生支起了卦摊。${roleNote}` +
    `玩家随手写下了一个字：「${character}」。` +
    `请像金庸笔下那种深藏不露的相士一样，结合这个字：①笔画数；②五行属性（按汉字五行推断）；③字义与意境。` +
    `再结合玩家卑微的身份，为ta判一桩命格——这个字里，藏着ta怎样的宿命` +
    `（如：潜龙在渊、乱世孤鸿、刀口舔血、桃花劫煞、枯木逢春……）。` +
    `输出格式：只输出两行，不要任何其他文字——\n` +
    `第一行：命格名（4~8个字，要像江湖术士的断语，掷地有声、有宿命感）；\n` +
    `第二行：60 字以内的判词（结合笔画/五行/字义与身份，解释为何是这条命格，要有古意，可带一点江湖人的风趣）。` +
    `判词只围绕你判定的这条命格展开，不要提到或比较其他命格。`
  );
}

export async function POST(req: NextRequest) {
  let body: { character?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  // 只接受"一个字"（含生僻字/emoji，按码点取长度）
  const chars = Array.from(String(body.character ?? "").trim());
  if (chars.length !== 1) {
    return NextResponse.json({ error: "请写下一个字" }, { status: 400 });
  }
  const character = chars[0];
  // 非法身份宽容处理：视为未选
  const role = isRoleKey(body.role) ? body.role : undefined;

  const messages: ChatMessage[] = [
    { role: "system", content: buildJinYongPrompt(role) },
    { role: "user", content: fortuneInstruction(character, role) },
  ];

  try {
    const { destiny, reading } = await callFortune(messages);
    return NextResponse.json({
      data: { character, role: role ?? null, destiny, reading },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "测字失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
