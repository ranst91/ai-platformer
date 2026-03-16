"use client";

import { Suggestion } from "@/lib/game/types";

interface CommandButtonsProps {
  suggestions: Suggestion[];
  onCommand: (command: string) => void;
  disabled: boolean;
}

export function CommandButtons({ suggestions, onCommand, disabled }: CommandButtonsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          onClick={() => onCommand(suggestion.command)}
          disabled={disabled}
          className="px-4 py-2 bg-gray-800/80 backdrop-blur-sm border border-gray-600 rounded-lg
                     font-mono text-sm text-white hover:bg-purple-600/80 hover:border-purple-400
                     transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                     active:scale-95 shadow-lg"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
