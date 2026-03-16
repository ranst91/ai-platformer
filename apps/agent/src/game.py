# apps/agent/src/game.py

from langchain.agents import AgentState as BaseAgentState
from langchain.tools import ToolRuntime, tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from typing import TypedDict, Literal


class Platform(TypedDict):
    x: float
    y: float
    width: float
    height: float
    type: Literal["normal", "moving", "crumbling", "bouncy", "icy", "mystery"]


class Enemy(TypedDict):
    x: float
    y: float
    type: Literal["walker", "flyer", "shooter"]


class Coin(TypedDict):
    x: float
    y: float


class LevelChunk(TypedDict):
    chunk_index: int
    platforms: list[Platform]
    enemies: list[Enemy]
    coins: list[Coin]


class Suggestion(TypedDict):
    label: str
    command: str


class GameAgentState(BaseAgentState):
    level_chunks: list[LevelChunk]
    difficulty: float
    game_phase: Literal["menu", "playing", "dead", "game_over"]
    dm_message: str
    suggestions: list[Suggestion]
    score: int
    lives: int
    player_x: float
    deaths: int


@tool
def append_chunks(
    new_chunks: list[LevelChunk],
    difficulty: float,
    dm_message: str,
    suggestions: list[Suggestion],
    runtime: ToolRuntime,
) -> Command:
    """Append new level chunks to the existing game world.

    Use this for ongoing chunk generation. Only provide the NEW chunks —
    existing chunks are preserved automatically. This avoids re-sending
    the entire world on every generation call.
    """
    existing = runtime.state.get("level_chunks", [])
    return Command(
        update={
            "level_chunks": existing + new_chunks,
            "difficulty": difficulty,
            "game_phase": "playing",
            "dm_message": dm_message,
            "suggestions": suggestions,
            "messages": [
                ToolMessage(
                    content=f"Appended {len(new_chunks)} chunks (total: {len(existing) + len(new_chunks)})",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def reset_game(
    level_chunks: list[LevelChunk],
    difficulty: float,
    dm_message: str,
    suggestions: list[Suggestion],
    lives: int,
    runtime: ToolRuntime,
) -> Command:
    """Reset the game with a fresh set of level chunks.

    Use this ONLY when starting a new game or restarting after game over.
    Replaces ALL existing chunks.
    """
    return Command(
        update={
            "level_chunks": level_chunks,
            "difficulty": difficulty,
            "game_phase": "playing",
            "dm_message": dm_message,
            "suggestions": suggestions,
            "lives": lives,
            "deaths": 0,
            "score": 0,
            "player_x": 0,
            "messages": [
                ToolMessage(
                    content="Game reset",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def get_game_state(runtime: ToolRuntime):
    """Get the current game state including chunk count, player position, score, deaths."""
    chunks = runtime.state.get("level_chunks", [])
    return {
        "total_chunks": len(chunks),
        "last_chunk_index": chunks[-1]["chunk_index"] if chunks else -1,
        "difficulty": runtime.state.get("difficulty", 0.3),
        "game_phase": runtime.state.get("game_phase", "menu"),
        "score": runtime.state.get("score", 0),
        "lives": runtime.state.get("lives", 3),
        "player_x": runtime.state.get("player_x", 0),
        "deaths": runtime.state.get("deaths", 0),
    }


game_tools = [append_chunks, reset_game, get_game_state]
