# AI Infinite Platformer - Design Document

## Overview

A side-scrolling platformer where the AI generates the world in real-time as the player runs. The AI acts as a "Dungeon Master" - creating levels, adapting difficulty, and responding to player commands. Built entirely on CopilotKit's headless mode with no chat interface. The AI IS the game engine.

**Target**: Viral demo showcasing CopilotKit's headless agent state pattern. Must look incredible in a 30-second video.

**Visual target**: New Super Mario Bros aesthetic - clean, colorful, polished 2D with modern lighting and smooth animations.

## Core Game Loop

1. Player starts on a small platform on the left
2. As the player moves right, the AI generates the next "chunk" of level (platforms, enemies, coins, hazards)
3. Camera scrolls to follow the player
4. AI observes player performance (deaths, coins, enemies defeated) and adapts difficulty
5. Player dies → AI generates a new level, no two runs alike
6. Score = distance + coins

## CopilotKit Integration

### Headless Mode

No chat UI anywhere. CopilotKit drives the game through:
- `useAgent()` hook reads `agent.state` to render the game world
- `agent.setState()` sends player actions (position, deaths, commands) back to the agent
- Suggestions hook provides dynamic game command buttons

### Agent State Schema

```python
class Platform(TypedDict):
    x: float
    y: float
    width: float
    type: Literal["normal", "moving", "crumbling", "bouncy", "icy"]

class Enemy(TypedDict):
    x: float
    y: float
    type: Literal["walker", "flyer", "shooter"]

class Coin(TypedDict):
    x: float
    y: float

class LevelChunk(TypedDict):
    platforms: list[Platform]
    enemies: list[Enemy]
    coins: list[Coin]
    chunk_x: float  # world x offset

class AgentState(TypedDict):
    level_chunks: list[LevelChunk]
    difficulty: float
    game_phase: Literal["menu", "playing", "dead", "game_over"]
    dm_message: str
    score: int
    lives: int
    player_x: float
    player_y: float
    deaths: int
```

### Agent Tools

- `generate_chunk()` - creates next level segment based on difficulty and player performance
- `adjust_difficulty()` - modifies difficulty in response to player performance or commands
- `respond_to_command()` - processes player button presses (harder/easier/surprise me)

### Dynamic Suggestion Buttons (via suggestions hook)

Styled as pixel-art game buttons. AI rotates them based on context:
- Dying a lot → "Easier", "More hearts", "Slow down"
- Cruising → "Harder", "Boss fight", "Surprise me"
- Contextual options that change as game state evolves

## Architecture Split

### Client-side (browser, 60fps)
- Canvas 2D rendering
- Physics and collision detection
- Input handling (keyboard: WASD/arrows)
- Camera tracking
- Particle effects and animations

### Agent-side (LangGraph, async)
- Level chunk generation
- Difficulty adaptation
- Dungeon Master personality and messages
- Command processing
- Generates chunks ahead of time so player never hits a loading wall

## Game Mechanics

### Player
- Run left/right, jump
- Squash & stretch animation, trail particles, landing burst
- Jump on enemies to defeat them (Mario-style)

### Platform Types
- **Normal** - solid, static
- **Moving** - horizontal or vertical movement
- **Crumbling** - disappears after standing on it briefly
- **Bouncy** - launches player high
- **Icy** - slippery movement

### Enemy Types
- **Walker** - paces back and forth on a platform
- **Flyer** - bobs up and down in the air
- **Shooter** - stationary, fires projectiles at intervals

### Collectibles
- **Coins** - scoring
- **Hearts** - extra life

## UI Layout

```
┌──────────────────────────────────────────┐
│ AI DUNGEON MASTER: "Welcome, mortal."    │  ← DM bar (typewriter text)
├──────────────────────────────────────────┤
│                                          │
│  [parallax background - sky, clouds,     │
│   mountains]                             │
│                                          │
│  [game world - platforms, enemies,       │
│   coins, player]                         │
│                                          │
├──────────────────────────────────────────┤
│ ❤️❤️❤️  Score: 1250   Difficulty: ██░░░  │  ← HUD
│ [Harder] [Surprise me] [More coins]      │  ← suggestion buttons
└──────────────────────────────────────────┘
```

## Dungeon Master Personality

Snarky, playful, reactive. Examples:
- Start: "Welcome, mortal. Let's see what you've got."
- Player dies: "That was embarrassing. Try again."
- "Easier" pressed: "...Fine. But I'm judging you."
- "Surprise me" pressed: "You asked for it."
- Player on a streak: "Impressive. Time to fix that."

## Build Strategy

### Phase 1: Game engine + CopilotKit integration
- Canvas renderer, physics, collision, camera
- Player movement and controls
- Agent state schema and tools
- Basic level chunk generation
- Suggestion buttons wired up

### Phase 2: Gameplay depth
- All platform types, enemy types, collectibles
- Difficulty adaptation
- Death/respawn flow
- Dungeon Master messages

### Phase 3: Visual polish
- New Super Mario Bros aesthetic
- Parallax backgrounds
- Particle effects, screen shake, juice
- Smooth animations and transitions
- Polished HUD and button styling

## Out of Scope
- Sound/music
- Mobile/touch controls
- Leaderboards or persistence
- Multiple characters
- Pause menu
- Tutorial (DM bar handles this narratively)
