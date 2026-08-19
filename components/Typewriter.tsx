"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface TypewriterProps {
  /** 要逐字显示的完整文本 */
  text: string;
  /** 跳过：置为 true 时立即显示全文 */
  skip?: boolean;
  /** 每个字符间隔（毫秒） */
  speed?: number;
  /** 每次渲染推进的字数（长文本自动加大） */
  stepChars?: number;
  /** 渲染函数：接收当前已揭示的文本 */
  children: (revealed: string) => ReactNode;
  onDone?: () => void;
}

export default function Typewriter({
  text,
  skip = false,
  speed = 24,
  stepChars = 1,
  children,
  onDone,
}: TypewriterProps) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  // 文本变化时重置
  useEffect(() => {
    setCount(0);
    doneRef.current = false;
  }, [text]);

  // skip 时直接跳到结尾
  useEffect(() => {
    if (skip) setCount(text.length);
  }, [skip, text]);

  // 打字推进
  useEffect(() => {
    if (count >= text.length || skip) return;
    const id = setInterval(
      () => setCount((c) => Math.min(c + stepChars, text.length)),
      speed
    );
    return () => clearInterval(id);
  }, [count, text, speed, stepChars, skip]);

  // 完成回调（只触发一次）
  useEffect(() => {
    if (count >= text.length && text.length > 0) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    } else {
      doneRef.current = false;
    }
  }, [count, text, onDone]);

  return <>{children(text.slice(0, count))}</>;
}
