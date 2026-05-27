"use client";

import { useEffect, useRef, useState } from "react";
import { useCloudStore } from "./useCloudStore";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatStore {
  messages: ChatMessage[];
  started_at: string;
  last_active: string;
}

const MAX_MESSAGES = 50;

export function useReflectionChat() {
  const { data, save, isLoading } = useCloudStore<ChatStore>("portfolio_reflection_chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    if (data && !synced.current) {
      setMessages(data.messages ?? []);
      synced.current = true;
    }
  }, [data]);

  function persist(updated: ChatMessage[]) {
    setMessages(updated);
    save({
      messages: updated,
      started_at: data?.started_at ?? new Date().toISOString(),
      last_active: new Date().toISOString(),
    });
  }

  function appendMessage(msg: ChatMessage) {
    const updated = [...messages, msg].slice(-MAX_MESSAGES);
    persist(updated);
    return updated;
  }

  function appendChunkToLast(chunk: string): ChatMessage[] {
    const updated = messages.map((m, i) =>
      i === messages.length - 1 && m.role === "assistant"
        ? { ...m, content: m.content + chunk }
        : m
    );
    setMessages(updated);
    return updated;
  }

  function finaliseLastMessage(updated: ChatMessage[]) {
    persist(updated);
  }

  function clearChat() {
    synced.current = false;
    persist([]);
  }

  return {
    messages,
    appendMessage,
    appendChunkToLast,
    finaliseLastMessage,
    clearChat,
    isLoading,
  };
}
