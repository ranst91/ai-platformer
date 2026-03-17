// apps/app/src/lib/game/sprites.ts

export interface SpriteAtlas {
  loaded: boolean;
  // Characters
  playerIdle: HTMLImageElement;
  playerWalkA: HTMLImageElement;
  playerWalkB: HTMLImageElement;
  playerJump: HTMLImageElement;
  playerHit: HTMLImageElement;
  // Enemies
  ladybugWalkA: HTMLImageElement;
  ladybugWalkB: HTMLImageElement;
  flyA: HTMLImageElement;
  flyB: HTMLImageElement;
  frogIdle: HTMLImageElement;
  // Tiles
  grassTop: HTMLImageElement;
  grassTopLeft: HTMLImageElement;
  grassTopRight: HTMLImageElement;
  grassCenter: HTMLImageElement;
  grassLeft: HTMLImageElement;
  grassRight: HTMLImageElement;
  grassCloudLeft: HTMLImageElement;
  grassCloudMiddle: HTMLImageElement;
  grassCloudRight: HTMLImageElement;
  dirtTop: HTMLImageElement;
  dirtCenter: HTMLImageElement;
  coinGold: HTMLImageElement;
  coinGoldSide: HTMLImageElement;
  blockCoin: HTMLImageElement;
  blockCoinActive: HTMLImageElement;
  blockExclamation: HTMLImageElement;
  blockExclamationActive: HTMLImageElement;
  brickBrown: HTMLImageElement;
  spring: HTMLImageElement;
  springActive: HTMLImageElement;
  bush: HTMLImageElement;
  grassDecor: HTMLImageElement;
  blockSpikes: HTMLImageElement;
  heart: HTMLImageElement;
  heartEmpty: HTMLImageElement;
  // Backgrounds
  bgClouds: HTMLImageElement;
  bgHills: HTMLImageElement;
  bgSolidSky: HTMLImageElement;
  bgSolidGrass: HTMLImageElement;
  bgSolidDirt: HTMLImageElement;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

export async function loadSprites(): Promise<SpriteAtlas> {
  const C = "/sprites/characters/";
  const E = "/sprites/enemies/";
  const T = "/sprites/tiles/";
  const B = "/sprites/backgrounds/";

  const [
    playerIdle,
    playerWalkA,
    playerWalkB,
    playerJump,
    playerHit,
    ladybugWalkA,
    ladybugWalkB,
    flyA,
    flyB,
    frogIdle,
    grassTop,
    grassTopLeft,
    grassTopRight,
    grassCenter,
    grassLeft,
    grassRight,
    grassCloudLeft,
    grassCloudMiddle,
    grassCloudRight,
    dirtTop,
    dirtCenter,
    coinGold,
    coinGoldSide,
    blockCoin,
    blockCoinActive,
    blockExclamation,
    blockExclamationActive,
    brickBrown,
    spring,
    bush,
    grassDecor,
    blockSpikes,
    heart,
    bgClouds,
    bgHills,
    bgSolidSky,
    bgSolidGrass,
    bgSolidDirt,
  ] = await Promise.all([
    loadImage(`${C}character_green_idle.png`),
    loadImage(`${C}character_green_walk_a.png`),
    loadImage(`${C}character_green_walk_b.png`),
    loadImage(`${C}character_green_jump.png`),
    loadImage(`${C}character_green_hit.png`),
    loadImage(`${E}ladybug_walk_a.png`),
    loadImage(`${E}ladybug_walk_b.png`),
    loadImage(`${E}fly_a.png`),
    loadImage(`${E}fly_b.png`),
    loadImage(`${E}frog_idle.png`),
    loadImage(`${T}terrain_grass_block_top.png`),
    loadImage(`${T}terrain_grass_block_top_left.png`),
    loadImage(`${T}terrain_grass_block_top_right.png`),
    loadImage(`${T}terrain_grass_block_center.png`),
    loadImage(`${T}terrain_grass_block_left.png`),
    loadImage(`${T}terrain_grass_block_right.png`),
    loadImage(`${T}terrain_grass_cloud_left.png`),
    loadImage(`${T}terrain_grass_cloud_middle.png`),
    loadImage(`${T}terrain_grass_cloud_right.png`),
    loadImage(`${T}terrain_dirt_block_top.png`),
    loadImage(`${T}terrain_dirt_block_center.png`),
    loadImage(`${T}coin_gold.png`),
    loadImage(`${T}coin_gold_side.png`),
    loadImage(`${T}block_coin.png`),
    loadImage(`${T}block_coin_active.png`),
    loadImage(`${T}block_exclamation.png`),
    loadImage(`${T}block_exclamation_active.png`),
    loadImage(`${T}brick_brown.png`),
    loadImage(`${T}spring.png`),
    loadImage(`${T}bush.png`),
    loadImage(`${T}grass.png`),
    loadImage(`${T}block_spikes.png`),
    loadImage(`${T}heart.png`),
    loadImage(`${B}background_clouds.png`),
    loadImage(`${B}background_color_hills.png`),
    loadImage(`${B}background_solid_sky.png`),
    loadImage(`${B}background_solid_grass.png`),
    loadImage(`${B}background_solid_dirt.png`),
  ]);

  return {
    loaded: true,
    playerIdle,
    playerWalkA,
    playerWalkB,
    playerJump,
    playerHit,
    ladybugWalkA,
    ladybugWalkB,
    flyA,
    flyB,
    frogIdle,
    grassTop,
    grassTopLeft,
    grassTopRight,
    grassCenter,
    grassLeft,
    grassRight,
    grassCloudLeft,
    grassCloudMiddle,
    grassCloudRight,
    dirtTop,
    dirtCenter,
    coinGold,
    coinGoldSide,
    blockCoin,
    blockCoinActive,
    blockExclamation,
    blockExclamationActive,
    brickBrown,
    spring,
    // No separate spring_active sprite available — reuse spring
    springActive: spring,
    bush,
    grassDecor,
    blockSpikes,
    heart,
    // No heart_empty sprite available — reuse heart (dimmed in renderer)
    heartEmpty: heart,
    bgClouds,
    bgHills,
    bgSolidSky,
    bgSolidGrass,
    bgSolidDirt,
  };
}
