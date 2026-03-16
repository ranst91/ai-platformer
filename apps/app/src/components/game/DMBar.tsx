"use client";

import { useEffect, useState, useRef } from "react";

interface DMBarProps {
  message: string;
}

export function DMBar({ message }: DMBarProps) {
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const currentMessage = useRef("");

  useEffect(() => {
    if (!message || message === currentMessage.current) return;
    currentMessage.current = message;
    setIsTyping(true);
    setDisplayText("");

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayText(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [message]);

  if (!message) return null;

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] bg-gray-900/90 backdrop-blur-sm border-b-2 border-purple-500/50 px-4 py-2 rounded-b-lg z-10">
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-purple-400 font-bold shrink-0">DUNGEON MASTER:</span>
        <span className="text-gray-200 italic">
          &quot;{displayText}&quot;
          {isTyping && <span className="animate-pulse">|</span>}
        </span>
      </div>
    </div>
  );
}
