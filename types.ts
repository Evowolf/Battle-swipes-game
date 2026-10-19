
export enum Element {
  FIRE = 'FIRE',
  ICE = 'ICE',
  WIND = 'WIND',
  EARTH = 'EARTH'
}

export enum CardType {
  HERO = 'HERO',
  AXE = 'AXE',
  SWORD = 'SWORD',
  SHIELD = 'SHIELD'
}

export enum Rarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC_RARE = 'EPIC_RARE'
}

export interface Card {
  id: string;
  name: string;
  element: Element;
  type: CardType;
  attack: number;
  defense: number;
  image: string;
  description: string;
  rarity?: Rarity;
  isHero?: boolean;
  heroStatus?: string;
  baseWeapon?: CardType;
}

export interface CardSleeve {
  id: string;
  name: string;
  image: string;
  element: Element;
  rarity: Rarity;
  createdAt: number;
  isCustom?: boolean;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  speed: number;
  size: number;
}

export interface PlayerStats {
  totalWins: number;
  totalLosses: number;
  farthestLevel: number;
  runes: number;
}

export interface GameState {
  playerHP: number;
  computerHP: number;
  playerHand: Card[];
  computerHand: Card[];
  playerDrawPile: Card[];
  computerDrawPile: Card[];
  lastPlayedPlayer?: Card;
  lastPlayedComputer?: Card;
  turn: 'player' | 'computer';
  battleLog: string[];
  isGameOver: boolean;
  winner?: 'player' | 'computer' | 'tie';
  level: number;
  currentClashBg: string;
  currentOpponentName?: string;
  currentOpponentAvatar?: string;
}

export type BattleResult = {
  playerDamage: number;
  computerDamage: number;
  message: string;
};

export interface DeckBoxSkin {
  id: string;
  name: string;
  image: string;
  tileMode: 'repeat' | 'cover' | 'contain';
  tileSize: number;
  theme: 'gold' | 'ruby' | 'sapphire' | 'emerald' | 'obsidian';
  element: Element;
  boxColor?: string;
  liningColor?: string;
  outsideType?: 'image' | 'color';
  insideType?: 'color' | 'image';
  insideImage?: string;
  updatedAt: number;
}
