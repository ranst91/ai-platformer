"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, GameCanvasHandle } from "./GameCanvas";
import { HUD } from "./HUD";
import { DMBar } from "./DMBar";
import { CommandButtons } from "./CommandButtons";
import { GameEventCallback } from "@/lib/game/engine";
import { AgentGameState } from "@/lib/game/types";

export function GameWrapper() {
  const { agent } = useAgent();
  const gameRef = useRef<GameCanvasHandle>(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const [gamePhase, setGamePhase] = useState<"menu" | "loading" | "playing" | "dead" | "game_over">("menu");

  const agentState = agent.state as AgentGameState | undefined;

  // --- Sync agent state → game engine ---
  // When chunks arrive, push to engine. Start playing once first chunks arrive.
  useEffect(() => {
    if (agentState?.level_chunks?.length) {
      gameRef.current?.engine?.updateLevelChunks(agentState.level_chunks);
    }
  }, [agentState?.level_chunks]);

  useEffect(() => {
    if (agentState?.lives !== undefined) {
      gameRef.current?.engine?.setLives(agentState.lives);
      setLives(agentState.lives);
    }
  }, [agentState?.lives]);

  // --- Send messages to agent ---
  // Guard against "Thread already running" — if the agent is busy,
  // skip the call. The engine's requestingChunks flag self-corrects
  // on the next frame when the current run completes.
  const sendToAgent = useCallback(
    (message: string) => {
      if (agent.isRunning) return;
      agent.addMessage({
        role: "user",
        id: crypto.randomUUID(),
        content: message,
      });
      agent.runAgent();
    },
    [agent],
  );

  // --- Start game ---
  const startGame = useCallback(() => {
    // Start playing IMMEDIATELY with hardcoded starter chunks (in engine)
    gameRef.current?.engine?.startPlaying();
    setGamePhase("playing");
    // Ask the AI to generate more chunks in the background — they'll
    // arrive and extend the world while the player is already running
    sendToAgent(
      "Start a new game! Use append_chunks with 4 chunks (chunk_index 2-5). " +
      "Set difficulty to 0.4. Design varied platform layouts — " +
      "mix heights, add gaps to jump over, make it interesting! " +
      "Welcome the player with a snarky dm_message and include suggestion buttons."
    );
  }, [sendToAgent]);

  // --- Request more chunks ---
  const requestChunks = useCallback(
    (playerX: number) => {
      const existingChunks = agentState?.level_chunks || [];
      const maxIndex = existingChunks.length > 0
        ? Math.max(...existingChunks.map((c) => c.chunk_index))
        : -1;
      const nextIndex = maxIndex + 1;

      sendToAgent(
        `Player at x=${Math.round(playerX)}. Use append_chunks with 3 new chunks ` +
        `(chunk_index ${nextIndex}, ${nextIndex + 1}, ${nextIndex + 2}). ` +
        `Difficulty: ${agentState?.difficulty || 0.4}. Deaths: ${agentState?.deaths || 0}. ` +
        `Design interesting platform layouts with varied heights and gaps!`
      );
    },
    [agentState, sendToAgent],
  );

  // --- Handle player death ---
  const handlePlayerDied = useCallback(
    (deaths: number) => {
      setGamePhase("dead");

      setTimeout(() => {
        const engine = gameRef.current?.engine;
        if (engine) {
          const state = engine.getState();
          if (state.gamePhase === "dead") {
            engine.respawn();
            setGamePhase("playing");
          } else if (state.gamePhase === "game_over") {
            setGamePhase("game_over");
          }
        }
      }, 1500);

      sendToAgent(
        `Player died! Deaths: ${deaths}. React with a snarky dm_message. ` +
        `If deaths > 3, lower difficulty. Use append_chunks with 1 chunk to update state.`
      );
    },
    [sendToAgent],
  );

  // --- Handle commands from buttons ---
  const handleCommand = useCallback(
    (command: string) => {
      sendToAgent(
        `Player command: "${command}". React — adjust difficulty if needed, ` +
        `update dm_message, provide new suggestions. Use append_chunks with 2 chunks.`
      );
    },
    [sendToAgent],
  );

  // --- Score update ---
  const handleScoreUpdate = useCallback((newScore: number, newCoins: number) => {
    setScore(newScore);
    setCoins(newCoins);
  }, []);

  // --- Engine callbacks ---
  const callbacks: GameEventCallback = useMemo(
    () => ({
      onNeedChunks: requestChunks,
      onPlayerDied: handlePlayerDied,
      onScoreUpdate: handleScoreUpdate,
    }),
    [requestChunks, handlePlayerDied, handleScoreUpdate],
  );

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-950">
      <DMBar message={agentState?.dm_message || ""} />
      <GameCanvas ref={gameRef} callbacks={callbacks} />
      <HUD score={score} lives={lives} coins={coins} difficulty={agentState?.difficulty || 0} />

      {gamePhase === "playing" && (
        <CommandButtons
          suggestions={agentState?.suggestions || []}
          onCommand={handleCommand}
          disabled={agent.isRunning}
        />
      )}

      {(gamePhase === "menu" || gamePhase === "game_over") && (
        <button
          onClick={startGame}
          disabled={agent.isRunning}
          className="absolute bottom-20 px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg
                     font-mono text-lg text-white font-bold transition-all duration-200
                     active:scale-95 shadow-lg shadow-purple-500/30
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gamePhase === "menu" ? "START GAME" : "PLAY AGAIN"}
        </button>
      )}


      {agent.isRunning && gamePhase === "playing" && (
        <div className="absolute top-14 right-[calc(50%-390px)] px-2 py-1 bg-purple-600/60 rounded text-xs text-white font-mono animate-pulse">
          AI generating...
        </div>
      )}
    </div>
  );
}
