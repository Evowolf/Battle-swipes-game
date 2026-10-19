import { Rarity, CardType, Element } from '../../types';

export const ELEMENT_HERO_STATUSES: Record<Element, string[]> = {
  [Element.FIRE]: [
    'Phoenix Ascendant',
    'Solar Sovereign',
    'Infernal Warlord',
    'Dragon Champion',
    'Flame Valkyrie',
    'Blaze Overlord'
  ],
  [Element.ICE]: [
    'Frost Monarch',
    'Glacial Vanguard',
    'Blizzard Archon',
    'Arctic Paladin',
    'Rime Emperor',
    'Winter Warden'
  ],
  [Element.WIND]: [
    'Tempest Knight',
    'Sky Sovereign',
    'Gale Striker',
    'Zephyr Archon',
    'Storm Valkyrie',
    'Cyclone Champion'
  ],
  [Element.EARTH]: [
    'Titan Aegis',
    'Terra Colossus',
    'Mountain Sentinel',
    'Bedrock Crusader',
    'Granite Warlord',
    'Ancient Sovereign'
  ]
};

export function getRandomHeroStatus(element: Element): string {
  const list = ELEMENT_HERO_STATUSES[element] || ELEMENT_HERO_STATUSES[Element.FIRE];
  return list[Math.floor(Math.random() * list.length)];
}

export interface RarityConfig {
  id: Rarity;
  label: string;
  name: string;
  color: string;           // Primary hex color
  borderHex: string;       // Canvas border hex
  borderClass: string;     // Tailwind border class with glow
  borderSimpleClass: string; // Plain border class for small hand cards
  glowColor: string;       // Canvas shadow blur color
  badgeClass: string;      // Tailwind badge style
  tagIcon: string;         // Emoji or symbol icon
  description: string;     // Short description requested by user
  statDescription: string; // Extended power note
}

export const RARITY_CONFIGS: Record<Rarity, RarityConfig> = {
  [Rarity.COMMON]: {
    id: Rarity.COMMON,
    label: 'COMMON',
    name: 'Common',
    color: '#ef4444', // Red
    borderHex: '#ef4444',
    borderClass: 'border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.6)] ring-2 ring-red-500/40',
    borderSimpleClass: 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
    glowColor: 'rgba(239, 68, 68, 0.75)',
    badgeClass: 'bg-red-950/80 border-red-500/80 text-red-400 shadow-[0_0_14px_rgba(239,68,68,0.45)]',
    tagIcon: '●',
    description: 'Weaker end cards',
    statDescription: 'Modest power suited for opening skirmishes.',
  },
  [Rarity.UNCOMMON]: {
    id: Rarity.UNCOMMON,
    label: 'UNCOMMON',
    name: 'Uncommon',
    color: '#22c55e', // Green
    borderHex: '#22c55e',
    borderClass: 'border-emerald-500 shadow-[0_0_35px_rgba(34,197,94,0.6)] ring-2 ring-emerald-500/40',
    borderSimpleClass: 'border-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]',
    glowColor: 'rgba(34, 197, 94, 0.75)',
    badgeClass: 'bg-emerald-950/80 border-emerald-500/80 text-emerald-400 shadow-[0_0_14px_rgba(34,197,94,0.45)]',
    tagIcon: '●',
    description: 'Kinda strong',
    statDescription: 'Bolstered combat attributes with reliable balance.',
  },
  [Rarity.RARE]: {
    id: Rarity.RARE,
    label: 'RARE',
    name: 'Rare',
    color: '#3b82f6', // Blue
    borderHex: '#3b82f6',
    borderClass: 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.7)] ring-2 ring-blue-400/50',
    borderSimpleClass: 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]',
    glowColor: 'rgba(59, 130, 246, 0.85)',
    badgeClass: 'bg-blue-950/80 border-blue-400 text-blue-300 shadow-[0_0_18px_rgba(59,130,246,0.55)]',
    tagIcon: '●',
    description: 'Strong cards',
    statDescription: 'Formidable power capable of deciding crucial rounds.',
  },
  [Rarity.EPIC_RARE]: {
    id: Rarity.EPIC_RARE,
    label: 'EPIC RARE',
    name: 'Epic Rare',
    color: '#a855f7', // Purple
    borderHex: '#a855f7',
    borderClass: 'border-purple-500 shadow-[0_0_45px_rgba(168,85,247,0.85)] ring-2 ring-purple-300',
    borderSimpleClass: 'border-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.7)] ring-1 ring-purple-400/60',
    glowColor: 'rgba(168, 85, 247, 0.9)',
    badgeClass: 'bg-purple-950/90 border-purple-400 text-purple-200 shadow-[0_0_22px_rgba(168,85,247,0.7)] animate-pulse',
    tagIcon: '●',
    description: 'Unusually strong cards',
    statDescription: 'Extraordinary relic radiating supreme elemental dominion.',
  },
};

export interface RollResult {
  rarity: Rarity;
  attack: number;
  defense: number;
}

/**
 * Rolls rarity and stat power:
 * - Red (Common): Weaker end cards
 * - Green (Uncommon): Kinda strong cards
 * - Blue (Rare): Strong cards
 * - Purple (Epic Rare): Unusually strong cards
 *
 * When a Rare Hero is drawn:
 * - Keeps the chosen weapon's base archetype (SWORD, AXE, SHIELD)
 * - Rolls in the high-tier spectrum (Rare or Epic Rare)
 * - Gains significantly elevated stats (+hero bonuses across ATK & DEF)
 */
export function rollForgeRarityAndStats(type: CardType, isHero: boolean, baseWeapon?: CardType): RollResult {
  const roll = Math.random();
  let rarity: Rarity;

  if (isHero) {
    // Rare Hero champions are rare draws that roll in the top tiers
    if (roll < 0.55) {
      rarity = Rarity.RARE; // 55% Blue (Rare - strong)
    } else {
      rarity = Rarity.EPIC_RARE; // 45% Purple (Epic Rare - unusually strong)
    }
  } else {
    // Standard vessels
    if (roll < 0.42) {
      rarity = Rarity.COMMON; // 42% (Red - weaker end)
    } else if (roll < 0.77) {
      rarity = Rarity.UNCOMMON; // 35% (Green - kinda strong)
    } else if (roll < 0.93) {
      rarity = Rarity.RARE; // 16% (Blue - strong)
    } else {
      rarity = Rarity.EPIC_RARE; // 7% (Purple - unusually strong)
    }
  }

  let attack = 10;
  let defense = 10;
  const effectiveWeapon = baseWeapon || (type === CardType.HERO ? CardType.SWORD : type);

  // If Hero Champion rolled: preserve chosen weapon while granting elevated Hero stats!
  if (isHero) {
    if (rarity === Rarity.RARE) {
      switch (effectiveWeapon) {
        case CardType.AXE:
          attack = 20 + Math.floor(Math.random() * 4); // 20 - 23 (devastating cleave)
          defense = 10 + Math.floor(Math.random() * 3); // 10 - 12 (heroic resilience)
          break;
        case CardType.SHIELD:
          attack = 11 + Math.floor(Math.random() * 3); // 11 - 13 (crushing shield-bash)
          defense = 22 + Math.floor(Math.random() * 4); // 22 - 25 (fortress aegis)
          break;
        case CardType.SWORD:
        default:
          attack = 17 + Math.floor(Math.random() * 3); // 17 - 19 (blade mastery)
          defense = 14 + Math.floor(Math.random() * 3); // 14 - 16 (agile guard)
          break;
      }
    } else {
      // EPIC RARE HERO
      switch (effectiveWeapon) {
        case CardType.AXE:
          attack = 25 + Math.floor(Math.random() * 5); // 25 - 29 (godlike damage)
          defense = 13 + Math.floor(Math.random() * 4); // 13 - 16 (titan armor)
          break;
        case CardType.SHIELD:
          attack = 14 + Math.floor(Math.random() * 4); // 14 - 17 (destructive counter)
          defense = 27 + Math.floor(Math.random() * 5); // 27 - 31 (unyielding monolith)
          break;
        case CardType.SWORD:
        default:
          attack = 21 + Math.floor(Math.random() * 4); // 21 - 24 (legendary blade)
          defense = 18 + Math.floor(Math.random() * 4); // 18 - 21 (heroic bastion)
          break;
      }
    }
    return { rarity, attack, defense };
  }

  // Normal non-hero rolls
  switch (rarity) {
    case Rarity.COMMON: // Weaker end cards
      switch (effectiveWeapon) {
        case CardType.HERO:
          attack = 7 + Math.floor(Math.random() * 3); // 7 - 9
          defense = 6 + Math.floor(Math.random() * 3); // 6 - 8
          break;
        case CardType.AXE:
          attack = 9 + Math.floor(Math.random() * 3);  // 9 - 11
          defense = 1 + Math.floor(Math.random() * 2); // 1 - 2
          break;
        case CardType.SWORD:
          attack = 7 + Math.floor(Math.random() * 3);  // 7 - 9
          defense = 3 + Math.floor(Math.random() * 3); // 3 - 5
          break;
        case CardType.SHIELD:
          attack = 0 + Math.floor(Math.random() * 2);  // 0 - 1
          defense = 9 + Math.floor(Math.random() * 4); // 9 - 12
          break;
      }
      break;

    case Rarity.UNCOMMON: // Kinda strong cards
      switch (effectiveWeapon) {
        case CardType.HERO:
          attack = 10 + Math.floor(Math.random() * 3); // 10 - 12
          defense = 8 + Math.floor(Math.random() * 3);  // 8 - 10
          break;
        case CardType.AXE:
          attack = 13 + Math.floor(Math.random() * 3); // 13 - 15
          defense = 2 + Math.floor(Math.random() * 3);  // 2 - 4
          break;
        case CardType.SWORD:
          attack = 10 + Math.floor(Math.random() * 3); // 10 - 12
          defense = 5 + Math.floor(Math.random() * 3);  // 5 - 7
          break;
        case CardType.SHIELD:
          attack = 1 + Math.floor(Math.random() * 3);  // 1 - 3
          defense = 14 + Math.floor(Math.random() * 4); // 14 - 17
          break;
      }
      break;

    case Rarity.RARE: // Strong cards
      switch (effectiveWeapon) {
        case CardType.HERO:
          attack = 13 + Math.floor(Math.random() * 3); // 13 - 15
          defense = 11 + Math.floor(Math.random() * 3); // 11 - 13
          break;
        case CardType.AXE:
          attack = 17 + Math.floor(Math.random() * 4); // 17 - 20
          defense = 3 + Math.floor(Math.random() * 3);  // 3 - 5
          break;
        case CardType.SWORD:
          attack = 13 + Math.floor(Math.random() * 3); // 13 - 15
          defense = 8 + Math.floor(Math.random() * 3);  // 8 - 10
          break;
        case CardType.SHIELD:
          attack = 3 + Math.floor(Math.random() * 3);  // 3 - 5
          defense = 18 + Math.floor(Math.random() * 4); // 18 - 21
          break;
      }
      break;

    case Rarity.EPIC_RARE: // Unusually strong cards
      switch (effectiveWeapon) {
        case CardType.HERO:
          attack = 17 + Math.floor(Math.random() * 5); // 17 - 21
          defense = 14 + Math.floor(Math.random() * 5); // 14 - 18
          break;
        case CardType.AXE:
          attack = 21 + Math.floor(Math.random() * 5); // 21 - 25
          defense = 5 + Math.floor(Math.random() * 4);  // 5 - 8
          break;
        case CardType.SWORD:
          attack = 17 + Math.floor(Math.random() * 4); // 17 - 20
          defense = 11 + Math.floor(Math.random() * 4); // 11 - 14
          break;
        case CardType.SHIELD:
          attack = 5 + Math.floor(Math.random() * 4);  // 5 - 8
          defense = 22 + Math.floor(Math.random() * 5); // 22 - 26
          break;
      }
      break;
  }

  return { rarity, attack, defense };
}
