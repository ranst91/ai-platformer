"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, GameCanvasHandle } from "./GameCanvas";
import { GameEventCallback } from "@/lib/game/engine";
import { AgentGameState } from "@/lib/game/types";
import { HUD_STRIP1_H, HUD_STRIP2_H } from "@/lib/game/renderer";
import { CANVAS_WIDTH } from "@/lib/game/constants";

// ── Command button layout (mirrors renderer.ts logic) ────────────────────────
const CMD_BTN_H = 20;
const CMD_BTN_PAD_X = 10;
const CMD_BTN_GAP = 6;
const CMD_BTN_MAX = 4;
// Approximate char width for monospace bold 11px — used for hit-testing
const MONO_CHAR_W = 7.2;

function getCommandButtonHitRects(
  suggestions: Array<{ label: string; command: string }>
): Array<{ x: number; y: number; w: number; h: number; command: string; label: string }> {
  const items = suggestions.slice(0, CMD_BTN_MAX);
  if (items.length === 0) return [];

  const PAD = 8;
  const btnY = HUD_STRIP1_H + (HUD_STRIP2_H - CMD_BTN_H) / 2;

  // Approximate widths the same way renderer does
  // Width = keycap(14) + gap(4) + label text + padding(14)
  const widths = items.map((s) => 14 + 4 + s.label.length * MONO_CHAR_W + 14);
  const totalBtnW =
    widths.reduce((a, b) => a + b, 0) + CMD_BTN_GAP * (items.length - 1);

  let bx = CANVAS_WIDTH - PAD - totalBtnW;
  return items.map((s, i) => {
    const rect = { x: bx, y: btnY, w: widths[i], h: CMD_BTN_H, command: s.command, label: s.label };
    bx += widths[i] + CMD_BTN_GAP;
    return rect;
  });
}

export function GameWrapper() {
  const { agent } = useAgent();
  const gameRef = useRef<GameCanvasHandle>(null);
  const [gamePhase, setGamePhase] = useState<"menu" | "loading" | "playing" | "dead" | "game_over">("menu");

  const agentState = agent.state as AgentGameState | undefined;

  // --- Sync agent state → game engine ---
  useEffect(() => {
    if (agentState?.level_chunks?.length) {
      gameRef.current?.engine?.updateLevelChunks(agentState.level_chunks);
    }
  }, [agentState?.level_chunks]);

  useEffect(() => {
    if (agentState?.lives !== undefined) {
      gameRef.current?.engine?.setLives(agentState.lives);
    }
  }, [agentState?.lives]);

  // Sync difficulty to engine
  useEffect(() => {
    if (agentState?.difficulty !== undefined) {
      gameRef.current?.engine?.setDifficulty(agentState.difficulty);
    }
  }, [agentState?.difficulty]);

  // Sync DM message to engine
  useEffect(() => {
    if (agentState?.dm_message) {
      gameRef.current?.engine?.setDMMessage(agentState.dm_message);
    }
  }, [agentState?.dm_message]);

  // Sync suggestions to engine (shown as canvas command buttons in strip 2)
  useEffect(() => {
    gameRef.current?.engine?.setSuggestions(agentState?.suggestions || []);
  }, [agentState?.suggestions]);

  // --- Send messages to agent ---
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
    setGamePhase("loading");
    gameRef.current?.engine?.setLoading(true);
    sendToAgent(
      "Start a new game! Use reset_game with 6 chunks (chunk_index 0-5). " +
      "Set difficulty to 0.4, lives to 3. Design varied platform layouts — " +
      "mix heights, add gaps to jump over, make it interesting! " +
      "Welcome the player with a snarky dm_message and include suggestion buttons."
    );
  }, [sendToAgent]);

  // When AI chunks arrive during loading, start playing
  useEffect(() => {
    if (gamePhase === "loading" && agentState?.level_chunks?.length) {
      const engine = gameRef.current?.engine;
      if (engine) {
        engine.setLoading(false);
        engine.setDMMessage(agentState?.dm_message || "Let's go!");
        engine.startPlaying();
      }
      setGamePhase("playing");
    }
  }, [gamePhase, agentState?.level_chunks]);

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

  // --- Handle commands from canvas buttons ---
  const handleCommand = useCallback(
    (command: string, label?: string, buttonIndex?: number) => {
      // Visual feedback: flash the pressed button
      if (buttonIndex !== undefined) {
        gameRef.current?.engine?.pressButton(buttonIndex);
      }
      // DM timeline feedback
      const displayLabel = label || command;
      gameRef.current?.engine?.setDMMessage(displayLabel, "you");

      // Simple command — let the AI read its own state and decide what to change
      sendToAgent(
        `Player says: "${displayLabel}". ` +
        `Use get_game_state to check current difficulty and stats, then decide how to adjust. ` +
        `React with a snarky dm_message. Provide new suggestion buttons. Use append_chunks with 2 chunks.`
      );
    },
    [sendToAgent],
  );

  // --- Engine callbacks ---
  const callbacks: GameEventCallback = useMemo(
    () => ({
      onNeedChunks: requestChunks,
      onPlayerDied: handlePlayerDied,
    }),
    [requestChunks, handlePlayerDied],
  );

  // --- Keyboard shortcuts: 1-4 for commands, Enter for start ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Enter/Space starts the game from menu/game_over
      if ((e.key === "Enter") && (gamePhase === "menu" || gamePhase === "game_over")) {
        e.preventDefault();
        startGame();
        return;
      }
      // Keys 1-4 trigger command buttons during play
      if (gamePhase === "playing" && !agent.isRunning) {
        const suggestions = agentState?.suggestions || [];
        const idx = parseInt(e.key, 10) - 1; // "1" → 0, "2" → 1, etc.
        if (idx >= 0 && idx < suggestions.length) {
          handleCommand(suggestions[idx].command, suggestions[idx].label, idx);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gamePhase, startGame, agentState?.suggestions, agent.isRunning, handleCommand]);

  // --- Canvas click: detect START button + strip-2 command buttons ---
  const handleCanvasClick = useCallback(
    (cx: number, cy: number) => {
      // START / PLAY AGAIN button (menu + game_over)
      if (gamePhase === "menu" || gamePhase === "game_over") {
        const btnW = 180;
        const btnH = 36;
        const btnX = 400 - btnW / 2; // CANVAS_WIDTH/2
        // Menu button at cy+40=340, Game Over button at cy+60=360
        const btnY = gamePhase === "menu" ? 340 : 360;
        if (cx >= btnX && cx <= btnX + btnW && cy >= btnY && cy <= btnY + btnH) {
          startGame();
          return;
        }
      }

      // Strip-2 command buttons (playing + dead)
      if (gamePhase === "playing" || gamePhase === "dead") {
        if (agent.isRunning) return; // ignore while AI is busy
        const suggestions = agentState?.suggestions || [];
        const rects = getCommandButtonHitRects(suggestions);
        for (let ri = 0; ri < rects.length; ri++) {
          const rect = rects[ri];
          if (cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h) {
            handleCommand(rect.command, rect.label, ri);
            return;
          }
        }
      }
    },
    [gamePhase, startGame, agentState?.suggestions, agent.isRunning, handleCommand],
  );

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-950">
      <GameCanvas ref={gameRef} callbacks={callbacks} onCanvasClick={handleCanvasClick} />
    </div>
  );
}
