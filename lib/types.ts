// 全局共享类型定义

/** 成就：模型可能返回对象（推荐）或字符串（兼容旧格式） */
export interface Achievement {
  emoji?: string;
  title: string;
  desc?: string;
}

/** 大模型返回的剧情 JSON 契约 */
export interface StoryResponse {
  narrative: string;
  options: string[];
  is_ending: boolean;
  ending_story: string;
  achievements: Array<Achievement | string>;
}

/** 对话历史消息（传给 DeepSeek） */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
