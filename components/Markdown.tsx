"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  /** 变体：wuxia 使用墨/朱砂/鎏金的 .md-body--wuxia 样式（默认江湖主题） */
  variant?: "cyber" | "wuxia";
}

/** Markdown 渲染（样式见 globals.css 的 .md-body） */
export default function Markdown({ children, variant = "wuxia" }: MarkdownProps) {
  const cls = variant === "wuxia" ? "md-body md-body--wuxia" : "md-body";
  return (
    <div className={cls}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
