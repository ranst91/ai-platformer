"use client";

interface HUDProps {
  score: number;
  lives: number;
  coins: number;
  difficulty: number;
}

export function HUD({ score, lives, coins, difficulty }: HUDProps) {
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[800px] flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm rounded-b-lg font-mono text-sm text-white">
      <div className="flex items-center gap-1">
        {Array.from({ length: lives }).map((_, i) => (
          <span key={i} className="text-red-500">&#9829;</span>
        ))}
        {Array.from({ length: Math.max(0, 3 - lives) }).map((_, i) => (
          <span key={i} className="text-gray-600">&#9829;</span>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-yellow-400">{coins} coins</span>
        <span className="font-bold">Score: {score}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Difficulty</span>
        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-full transition-all duration-500"
            style={{ width: `${difficulty * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
