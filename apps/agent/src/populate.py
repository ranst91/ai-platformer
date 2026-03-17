"""
Deterministic chunk population — adds enemies, coins, and mystery blocks
to AI-generated platform layouts. The LLM designs the platform flow;
this module handles the mechanical placement that LLMs get wrong.
"""

import random
from typing import Literal


def populate_chunk(
    chunk: dict,
    difficulty: float,
) -> dict:
    """Take a chunk with platforms (from the LLM) and add enemies, coins, mystery blocks."""

    platforms = chunk.get("platforms", [])
    chunk_index = chunk.get("chunk_index", 0)

    # Seed random per chunk for consistency if re-called
    rng = random.Random(chunk_index * 1000 + int(difficulty * 100))

    # ── Sort platforms by x so we can reason about flow ──────────────────
    platforms = sorted(platforms, key=lambda p: p["x"])

    # ── Validate / clamp platform values ─────────────────────────────────
    for p in platforms:
        p["y"] = max(300, min(460, p.get("y", 420)))
        p["width"] = max(80, min(350, p.get("width", 150)))
        p["height"] = max(20, min(40, p.get("height", 30)))
        if p.get("type") not in ("normal", "moving", "crumbling", "bouncy", "icy"):
            p["type"] = "normal"

    # ── Ensure at least one wide platform per chunk ──────────────────────
    if not platforms or max(p["width"] for p in platforms) < 150:
        platforms.append({
            "x": rng.randint(100, 400),
            "y": 430,
            "width": 250,
            "height": 30,
            "type": "normal",
        })

    # ── Ensure at least one platform is reachable from ground level ─────
    # If all platforms are too high (above y=430), pull the lowest one down
    # so the player can always jump back up after falling.
    lowest_plat = max(platforms, key=lambda p: p["y"])  # highest y = lowest on screen
    if lowest_plat["y"] < 440:
        lowest_plat["y"] = 450

    # ── Add mystery blocks above the widest platform(s) ──────────────────
    mystery_blocks = []
    wide_platforms = sorted(platforms, key=lambda p: -p["width"])[:2]
    for wp in wide_platforms:
        if rng.random() < 0.7 + difficulty * 0.3:  # More likely at higher difficulty
            mystery_blocks.append({
                "x": wp["x"] + wp["width"] * rng.uniform(0.2, 0.6),
                "y": wp["y"] - rng.randint(70, 100),  # Above the platform
                "width": 55,
                "height": 30,
                "type": "mystery",
            })

    # ── Place enemies ON platforms ────────────────────────────────────────
    enemies: list[dict] = []
    enemy_count = max(2, int(2 + difficulty * 3))  # 2 at easy, 5 at hard

    # Eligible platforms for enemies (wide enough to walk on)
    enemy_platforms = [p for p in platforms if p["width"] >= 100]
    if not enemy_platforms:
        enemy_platforms = platforms[:2]

    for i in range(enemy_count):
        plat = enemy_platforms[i % len(enemy_platforms)]

        # Pick enemy type based on difficulty
        if difficulty < 0.3:
            etype: Literal["walker", "flyer", "shooter"] = "walker"
        elif difficulty < 0.6:
            etype = rng.choice(["walker", "walker", "flyer"])
        else:
            etype = rng.choice(["walker", "flyer", "flyer", "shooter"])

        if etype == "flyer":
            # Flyers bob in the air above the platform
            ex = plat["x"] + rng.uniform(0.2, 0.8) * plat["width"]
            ey = plat["y"] - rng.randint(50, 80)
        else:
            # Walkers and shooters sit on top of the platform
            ex = plat["x"] + rng.uniform(0.2, 0.8) * plat["width"]
            ey = plat["y"] - 30  # Enemy is ~30px tall

        enemies.append({"x": round(ex), "y": round(ey), "type": etype})

    # ── Validate enemy positions — remove any that aren't on a platform ──
    validated_enemies = []
    for enemy in enemies:
        if enemy["type"] == "flyer":
            # Flyers float, they're always valid
            validated_enemies.append(enemy)
        else:
            # Walkers/shooters must be on a platform surface
            on_platform = False
            for p in platforms:
                if (p["x"] <= enemy["x"] <= p["x"] + p["width"] and
                        abs(enemy["y"] - (p["y"] - 30)) < 10):
                    on_platform = True
                    break
            if on_platform:
                validated_enemies.append(enemy)
    enemies = validated_enemies if validated_enemies else enemies[:1]  # keep at least 1

    # ── Place coins directly above platforms ──────────────────────────────
    coins: list[dict] = []
    coin_count = max(4, int(6 - difficulty * 2))  # More coins at lower difficulty

    for i in range(coin_count):
        plat = platforms[i % len(platforms)]
        # Spread coins evenly across the platform
        spread = plat["width"] * 0.7
        start_x = plat["x"] + plat["width"] * 0.15
        cx = start_x + (i / max(1, coin_count - 1)) * spread if coin_count > 1 else plat["x"] + plat["width"] / 2
        cy = plat["y"] - 40  # Exactly 40px above platform surface

        coins.append({"x": round(cx), "y": round(cy)})

    # ── Also add coins above mystery blocks (hint to hit them) ───────────
    for mb in mystery_blocks:
        coins.append({
            "x": round(mb["x"] + mb["width"] / 2),
            "y": round(mb["y"] - 35),
        })

    # ── Assemble final chunk ─────────────────────────────────────────────
    return {
        "chunk_index": chunk_index,
        "platforms": platforms + mystery_blocks,
        "enemies": enemies,
        "coins": coins,
    }
