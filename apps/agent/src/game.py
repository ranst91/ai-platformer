# apps/agent/src/game.py

from langchain.agents import AgentState as BaseAgentState
from langchain.tools import ToolRuntime, tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from typing import TypedDict, Literal

from src.populate import populate_chunk


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
    difficulty: float                    # 0.0–1.0, AI decides how to adjust
    enemies_per_chunk: int               # AI sets this, populate.py reads it
    platform_style: str                  # "wide_easy" | "mixed" | "narrow_hard" etc — AI's choice
    game_phase: Literal["menu", "playing", "dead", "game_over"]
    dm_message: str
    suggestions: list[Suggestion]
    score: int
    lives: int
    player_x: float
    deaths: int


@tool
def append_chunks(
    new_chunks: list[dict],
    difficulty: float,
    enemies_per_chunk: int,
    dm_message: str,
    suggestions: list[Suggestion],
    runtime: ToolRuntime,
) -> Command:
    """Append new level chunks to the existing game world.

    You only need to provide platforms in each chunk — enemies, coins, and
    mystery blocks are added automatically based on difficulty and enemies_per_chunk.

    Args:
        new_chunks: list of {chunk_index, platforms: [{x, y, width, height, type}]}
        difficulty: 0.0–1.0, your choice based on player's request
        enemies_per_chunk: how many enemies per chunk (2=easy, 4=medium, 7=hard) — YOUR decision
        dm_message: snarky reaction to player
        suggestions: 3-4 command buttons for player
    """
    existing = runtime.state.get("level_chunks", [])

    # Populate each chunk — enemies_per_chunk overrides the default scaling
    populated = [populate_chunk(chunk, difficulty, enemies_per_chunk) for chunk in new_chunks]

    return Command(
        update={
            "level_chunks": existing + populated,
            "difficulty": difficulty,
            "enemies_per_chunk": enemies_per_chunk,
            "game_phase": "playing",
            "dm_message": dm_message,
            "suggestions": suggestions,
            "messages": [
                ToolMessage(
                    content=f"Appended {len(populated)} chunks (total: {len(existing) + len(populated)})",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def reset_game(
    level_chunks: list[dict],
    difficulty: float,
    enemies_per_chunk: int,
    dm_message: str,
    suggestions: list[Suggestion],
    lives: int,
    runtime: ToolRuntime,
) -> Command:
    """Reset the game with a fresh set of level chunks.

    Use this ONLY when starting a new game or restarting after game over.
    You only need to provide platforms — enemies, coins, and mystery blocks
    are added automatically based on difficulty and enemies_per_chunk.
    """
    populated = [populate_chunk(chunk, difficulty, enemies_per_chunk) for chunk in level_chunks]

    return Command(
        update={
            "level_chunks": populated,
            "difficulty": difficulty,
            "enemies_per_chunk": enemies_per_chunk,
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
    """Get the current game state. Use this to observe your own settings before making changes.

    Returns difficulty, enemies_per_chunk, and player stats so you can make informed decisions
    about what to adjust when the player asks for harder/easier."""
    chunks = runtime.state.get("level_chunks", [])
    return {
        "total_chunks": len(chunks),
        "last_chunk_index": chunks[-1]["chunk_index"] if chunks else -1,
        "difficulty": runtime.state.get("difficulty", 0.4),
        "enemies_per_chunk": runtime.state.get("enemies_per_chunk", 3),
        "game_phase": runtime.state.get("game_phase", "menu"),
        "score": runtime.state.get("score", 0),
        "lives": runtime.state.get("lives", 3),
        "player_x": runtime.state.get("player_x", 0),
        "deaths": runtime.state.get("deaths", 0),
    }


game_tools = [append_chunks, reset_game, get_game_state]
