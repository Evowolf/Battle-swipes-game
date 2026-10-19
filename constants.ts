
import { Element, CardType, Card, Rarity } from './types';

export const ASSETS = {
  ARROW: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Arrow.png",
  BACKDROP: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Back%20drop.jpeg",
  CIRCLE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Circle%20Hitbox.png",
  COMPUTER_HP_BAR: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Computer%20HP%20bar.png",
  COMPUTER_HP_HOLDER: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Computer%20Hp%20Holder.png",
  PLAYER_HP_BAR: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Health%20bar.png",
  PLAYER_HP_HOLDER: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Health%20bar%20holder.png",
  VS_LOGO: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/VS%20icon.png",
  YOU_WIN: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/You%20Win%20Icon.png",
  YOU_LOSE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/You%20Lose%20Icon.png",
  TITLE_BG: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Battle%20swipes%20background%20wow.png",
  TITLE_LOGO: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Battle%20swipes%20Title%20screen%20top%20layer.png",
  CARD_TEMPLATE: "/card-backing-trimmed.png",
  CARD_TEMPLATE_ORIGINAL: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Card%20backing.jpeg",
  BTN_ENTER_ARENA: "/buttons/btn_enter_arena.png",
  BTN_CLASHING_TOURNAMENT: "/buttons/btn_clashing_tournament.png",
  BTN_OPTIONS: "/buttons/btn_options.png",
  PURCHASING_RUNES: "/purchasing-runes.png",
  CURRENCY_RUNE: "/currency-rune.png",
};

export const ELEMENTAL_BACKDROPS = {
  EARTH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20back%20drop.png",
  FIRE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20back%20drop.png",
  WIND: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/wind%20backdrop.png",
  ICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/ice%20backdrop.png",
};

export const ELEMENTAL_BALLS = {
  FIRE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/56647cce9c161d03218ddc97536b0511432472eb/Fire%20elemental%20ball.png",
  ICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/56647cce9c161d03218ddc97536b0511432472eb/Ice%20elemental%20ball.png",
  EARTH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/56647cce9c161d03218ddc97536b0511432472eb/Rock%20elemental%20ball.png",
  WIND: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/56647cce9c161d03218ddc97536b0511432472eb/Wind%20elemental%20ball.png",
};

export const ELEMENT_ICONS = {
  FIRE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Icon.png",
  ICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20Icon.png",
  WIND: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20Icon.png",
  EARTH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20Icon.png",
};

export const VFX = {
  FIRE_SLASH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Flame%20slash.png",
  ICE_SLASH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20slash.png",
  WIND_SLASH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/wind%20slash.png",
  EARTH_SLASH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20slash.png",
  FIRE_BURST: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Flame%20burst.png",
  ICE_BURST: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/ice%20burst.png",
  WIND_BURST: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20burst.png",
  EARTH_BURST: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/earth%20burst.png",
  TIE_CLASH_EFFECT: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Tie%20clash%20effect.png",
};

export const SOUNDS = {
  EARTH_SLICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Eaarth%20slice.mp3",
  EARTH_EXPLOSION: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20explosion.mp3",
  FIRE_SLICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Slice.mp3",
  FIRE_EXPLOSION: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20explosion.mp3",
  ICE_SLICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20slice.mp3",
  ICE_EXPLOSION: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20explosion.mp3",
  WIND_SLICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20slice.mp3",
  WIND_EXPLOSION: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20explosion.mp3",
  CARD_SWIPE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Card%20swiping%20sound.mp3",
  SWIPE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Card%20swiping%20sound.mp3",
  SHIELD_BLOCK: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20explosion.mp3",
  TIE_CLASH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Tie%20clash.mp3",
  GAME_WIN: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Win%20noise.mp3",
  GAME_LOSE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/loseing%20sound.mp3",
  BATTLE_MUSIC: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Battle%20music.mp3",
  CARD_SPAWN: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/175c96ef3de76faa0c24f7d5fb8cb1373dfa175d/Card%20spawning%20noise.mp3",
  MENU_POP: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/175c96ef3de76faa0c24f7d5fb8cb1373dfa175d/Menu%20pop%20noise.mp3",
  CHIME: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/175c96ef3de76faa0c24f7d5fb8cb1373dfa175d/Short%20chime.mp3",
  VS_CLASH_EXPLOSION: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/175c96ef3de76faa0c24f7d5fb8cb1373dfa175d/Vs%20clash%20explosion.mp3",
  WOOSHING: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wooshing.mp3",
  CARD_DRAW: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/33a2f5dbe1988ee270abfbf2b8acc537b371f57c/Card%20drawing%20sound.mp3",
  CARD_SHUFFLE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/33a2f5dbe1988ee270abfbf2b8acc537b371f57c/Card%20shuffling.mp3",
};

export const CARD_IMAGES = {
  FIRE_AXE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Axe%20card(1)%20-%20Copy.png",
  FIRE_HERO: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Hero.png",
  FIRE_SHIELD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Shield%20card(1).png",
  FIRE_SWORD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Sword%20card(1).png",
  ICE_AXE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20Axe%20card(1)%20-%20Copy.png",
  ICE_HERO: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20Hero.png",
  ICE_SHIELD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20Shield%20card(1).png",
  ICE_SWORD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20Sword%20card(1).png",
  WIND_AXE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20Axe%20card(1).png",
  WIND_HERO: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20Hero.png",
  WIND_SHIELD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20Shield%20card(1).png",
  WIND_SWORD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20Sword%20card(1).png",
  EARTH_AXE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20Axe%20card(1)%20-%20Copy.png",
  EARTH_HERO: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20Hero.png",
  EARTH_SHIELD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20Shield%20card(1).png",
  EARTH_SWORD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20Sword%20card(1).png",
};

export const INITIAL_DECK: Card[] = [
  { id: 'f1', name: 'Inferno Axe', element: Element.FIRE, type: CardType.AXE, attack: 15, defense: 2, image: CARD_IMAGES.FIRE_AXE, description: 'Sears through defenses.', rarity: Rarity.UNCOMMON },
  { id: 'f2', name: 'Flame Knight', element: Element.FIRE, type: CardType.HERO, attack: 12, defense: 8, image: CARD_IMAGES.FIRE_HERO, description: 'Champion of the Forge.', rarity: Rarity.RARE },
  { id: 'f3', name: 'Heat Shield', element: Element.FIRE, type: CardType.SHIELD, attack: 2, defense: 15, image: CARD_IMAGES.FIRE_SHIELD, description: 'Blocks the coldest winds.', rarity: Rarity.UNCOMMON },
  { id: 'f4', name: 'Magma Blade', element: Element.FIRE, type: CardType.SWORD, attack: 10, defense: 5, image: CARD_IMAGES.FIRE_SWORD, description: 'Slicing with burning intensity.', rarity: Rarity.COMMON },
  { id: 'i1', name: 'Glacial Axe', element: Element.ICE, type: CardType.AXE, attack: 14, defense: 3, image: CARD_IMAGES.ICE_AXE, description: 'Cracks the earth with frost.', rarity: Rarity.UNCOMMON },
  { id: 'i2', name: 'Frostborn Hero', element: Element.ICE, type: CardType.HERO, attack: 11, defense: 9, image: CARD_IMAGES.ICE_HERO, description: 'Silent as a winter night.', rarity: Rarity.RARE },
  { id: 'i3', name: 'Ice Bastion', element: Element.ICE, type: CardType.SHIELD, attack: 1, defense: 16, image: CARD_IMAGES.ICE_SHIELD, description: 'Unbreakable frozen wall.', rarity: Rarity.UNCOMMON },
  { id: 'i4', name: 'Shatter Sword', element: Element.ICE, type: CardType.SWORD, attack: 9, defense: 6, image: CARD_IMAGES.ICE_SWORD, description: 'Piercing ice shards.', rarity: Rarity.COMMON },
  { id: 'w1', name: 'Storm Axe', element: Element.WIND, type: CardType.AXE, attack: 16, defense: 1, image: CARD_IMAGES.WIND_AXE, description: 'Swift as a gale.', rarity: Rarity.UNCOMMON },
  { id: 'w2', name: 'Aero Spirit', element: Element.WIND, type: CardType.HERO, attack: 13, defense: 7, image: CARD_IMAGES.WIND_HERO, description: 'One with the breeze.', rarity: Rarity.RARE },
  { id: 'w3', name: 'Cyclone Shield', element: Element.WIND, type: CardType.SHIELD, attack: 3, defense: 14, image: CARD_IMAGES.WIND_SHIELD, description: 'Deflects with air currents.', rarity: Rarity.UNCOMMON },
  { id: 'w4', name: 'Zephyr Edge', element: Element.WIND, type: CardType.SWORD, attack: 11, defense: 4, image: CARD_IMAGES.WIND_SWORD, description: 'Lightweight and deadly.', rarity: Rarity.COMMON },
  { id: 'e1', name: 'Granite Axe', element: Element.EARTH, type: CardType.AXE, attack: 13, defense: 4, image: CARD_IMAGES.EARTH_AXE, description: 'Heavy and relentless.', rarity: Rarity.UNCOMMON },
  { id: 'e2', name: 'Terra Guard', element: Element.EARTH, type: CardType.HERO, attack: 10, defense: 10, image: CARD_IMAGES.EARTH_HERO, description: 'Solid as bedrock.', rarity: Rarity.RARE },
  { id: 'e3', name: 'Stone Aegis', element: Element.EARTH, type: CardType.SHIELD, attack: 0, defense: 18, image: CARD_IMAGES.EARTH_SHIELD, description: 'The ultimate wall.', rarity: Rarity.UNCOMMON },
  { id: 'e4', name: 'Fossil Blade', element: Element.EARTH, type: CardType.SWORD, attack: 8, defense: 7, image: CARD_IMAGES.EARTH_SWORD, description: 'Sharp ancient stone.', rarity: Rarity.COMMON },
];

export const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  [Element.FIRE]: Element.ICE,
  [Element.ICE]: Element.WIND,
  [Element.WIND]: Element.EARTH,
  [Element.EARTH]: Element.FIRE,
};

