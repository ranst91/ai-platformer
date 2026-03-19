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
  sandCloudLeft: HTMLImageElement;
  sandCloudMiddle: HTMLImageElement;
  sandCloudRight: HTMLImageElement;
  stoneCloudLeft: HTMLImageElement;
  stoneCloudMiddle: HTMLImageElement;
  stoneCloudRight: HTMLImageElement;
  snowCloudLeft: HTMLImageElement;
  snowCloudMiddle: HTMLImageElement;
  snowCloudRight: HTMLImageElement;
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
  // HUD
  hudHeart: HTMLImageElement;
  hudHeartEmpty: HTMLImageElement;
  hudHeartHalf: HTMLImageElement;
  hudCoin: HTMLImageElement;
  hudDigit0: HTMLImageElement;
  hudDigit1: HTMLImageElement;
  hudDigit2: HTMLImageElement;
  hudDigit3: HTMLImageElement;
  hudDigit4: HTMLImageElement;
  hudDigit5: HTMLImageElement;
  hudDigit6: HTMLImageElement;
  hudDigit7: HTMLImageElement;
  hudDigit8: HTMLImageElement;
  hudDigit9: HTMLImageElement;
  hudMultiply: HTMLImageElement;
  gemBlue: HTMLImageElement;
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
  const H = "/sprites/hud/";

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
    sandCloudLeft,
    sandCloudMiddle,
    sandCloudRight,
    stoneCloudLeft,
    stoneCloudMiddle,
    stoneCloudRight,
    snowCloudLeft,
    snowCloudMiddle,
    snowCloudRight,
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
    hudHeart,
    hudHeartEmpty,
    hudHeartHalf,
    hudCoin,
    hudDigit0,
    hudDigit1,
    hudDigit2,
    hudDigit3,
    hudDigit4,
    hudDigit5,
    hudDigit6,
    hudDigit7,
    hudDigit8,
    hudDigit9,
    hudMultiply,
    gemBlue,
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
    loadImage(`${T}terrain_sand_cloud_left.png`),
    loadImage(`${T}terrain_sand_cloud_middle.png`),
    loadImage(`${T}terrain_sand_cloud_right.png`),
    loadImage(`${T}terrain_stone_cloud_left.png`),
    loadImage(`${T}terrain_stone_cloud_middle.png`),
    loadImage(`${T}terrain_stone_cloud_right.png`),
    loadImage(`${T}terrain_snow_cloud_left.png`),
    loadImage(`${T}terrain_snow_cloud_middle.png`),
    loadImage(`${T}terrain_snow_cloud_right.png`),
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
    loadImage(`${H}hud_heart.png`),
    loadImage(`${H}hud_heart_empty.png`),
    loadImage(`${H}hud_heart_half.png`),
    loadImage(`${H}hud_coin.png`),
    loadImage(`${H}hud_character_0.png`),
    loadImage(`${H}hud_character_1.png`),
    loadImage(`${H}hud_character_2.png`),
    loadImage(`${H}hud_character_3.png`),
    loadImage(`${H}hud_character_4.png`),
    loadImage(`${H}hud_character_5.png`),
    loadImage(`${H}hud_character_6.png`),
    loadImage(`${H}hud_character_7.png`),
    loadImage(`${H}hud_character_8.png`),
    loadImage(`${H}hud_character_9.png`),
    loadImage(`${H}hud_character_multiply.png`),
    loadImage(`${T}gem_blue.png`),
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
    sandCloudLeft,
    sandCloudMiddle,
    sandCloudRight,
    stoneCloudLeft,
    stoneCloudMiddle,
    stoneCloudRight,
    snowCloudLeft,
    snowCloudMiddle,
    snowCloudRight,
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
    hudHeart,
    hudHeartEmpty,
    hudHeartHalf,
    hudCoin,
    hudDigit0,
    hudDigit1,
    hudDigit2,
    hudDigit3,
    hudDigit4,
    hudDigit5,
    hudDigit6,
    hudDigit7,
    hudDigit8,
    hudDigit9,
    hudMultiply,
    gemBlue,
  };
}
