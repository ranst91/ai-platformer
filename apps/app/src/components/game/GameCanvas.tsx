"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { GameEngine, GameEventCallback } from "@/lib/game/engine";
import { loadSprites } from "@/lib/game/sprites";

export interface GameCanvasHandle {
  engine: GameEngine | null;
}

interface GameCanvasProps {
  callbacks: GameEventCallback;
  onCanvasClick?: (canvasX: number, canvasY: number) => void;
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  function GameCanvas({ callbacks, onCanvasClick }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);

    useImperativeHandle(ref, () => ({
      get engine() {
        return engineRef.current;
      },
    }));

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new GameEngine(canvasRef.current);
      engine.setCallbacks(callbacks);
      engine.start();
      engineRef.current = engine;

      // Load sprites asynchronously and pass to engine once ready
      loadSprites()
        .then((sprites) => {
          engine.setSprites(sprites);
        })
        .catch((err) => {
          console.warn("Sprite loading failed, using procedural fallback:", err);
        });

      return () => {
        engine.stop();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.setCallbacks(callbacks);
    }, [callbacks]);

    return (
      <canvas
        ref={canvasRef}
        className="block mx-auto border-2 border-gray-700 rounded-lg shadow-2xl cursor-pointer"
        style={{ imageRendering: "pixelated" }}
        onClick={(e) => {
          if (!onCanvasClick || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const scaleX = canvasRef.current.width / rect.width;
          const scaleY = canvasRef.current.height / rect.height;
          const x = (e.clientX - rect.left) * scaleX;
          const y = (e.clientY - rect.top) * scaleY;
          onCanvasClick(x, y);
        }}
      />
    );
  },
);
