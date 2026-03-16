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
      if (gamePhase === "loading") {
        gameRef.current?.engine?.startPlaying();
        setGamePhase("playing");
      }
    }
  }, [agentState?.level_chunks]);

  useEffect(() => {
    if (agentState?.lives !== undefined) {
      gameRef.current?.engine?.setLives(agentState.lives);
      setLives(agentState.lives);
    }
  }, [agentState?.lives]);

  // --- Send messages to agent ---
  const sendToAgent = useCallback(
    (message: string) => {
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
    setGamePhase("loading");
    sendToAgent(
      "Start a new game! Use reset_game to generate 4 level chunks (chunk_index 0, 1, 2, 3). " +
      "Set difficulty to 0.3 (easy start). Set lives to 3. " +
      "Welcome the player with a fun dm_message. " +
      "Include 3-4 suggestion buttons for the player."
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
        `Player reached x=${Math.round(playerX)}. Use append_chunks to generate 2 more chunks ` +
        `(chunk_index ${nextIndex} and ${nextIndex + 1}). ` +
        `Current difficulty: ${agentState?.difficulty || 0.3}. Player deaths: ${agentState?.deaths || 0}. ` +
        `Adjust difficulty slightly based on performance. Update suggestions.`
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
        `Player died! Total deaths: ${deaths}. ` +
        `Use append_chunks to react — update dm_message, adjust difficulty if player is struggling. ` +
        `Keep existing chunks, no new chunks needed unless difficulty changed.`
      );
    },
    [sendToAgent],
  );

  // --- Handle commands from buttons ---
  const handleCommand = useCallback(
    (command: string) => {
      sendToAgent(
        `Player command: "${command}". ` +
        `Respond to this command — adjust difficulty, generate new chunks if appropriate, ` +
        `update dm_message with a reaction, and provide new suggestion buttons. ` +
        `Keep all existing chunks.`
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

      {gamePhase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80">
          <div className="text-center font-mono text-white">
            <div className="text-2xl font-bold mb-2 animate-pulse">Generating world...</div>
            <div className="text-sm text-gray-400">The Dungeon Master is preparing your fate</div>
          </div>
        </div>
      )}

      {agent.isRunning && gamePhase === "playing" && (
        <div className="absolute top-14 right-[calc(50%-390px)] px-2 py-1 bg-purple-600/60 rounded text-xs text-white font-mono animate-pulse">
          AI generating...
        </div>
      )}
    </div>
  );
}
