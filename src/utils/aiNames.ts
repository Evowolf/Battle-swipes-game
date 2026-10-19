import { Element, Card, CardType, Rarity } from '../../types';
import { CARD_IMAGES } from '../../constants';

// 20 Girl and 20 Boy duelist names (40 total)
export const AI_GIRL_NAMES: string[] = [
  "Aira",
  "Nami",
  "Sora",
  "Hikari",
  "Rinako",
  "Yume",
  "Kaede",
  "Lyria",
  "Misora",
  "Akiyo",
  "Tsukina",
  "Eriya",
  "Shizu",
  "Kanna",
  "Rikae",
  "Meiha",
  "Arisu",
  "Yuria",
  "Kiyomi",
  "Hanae"
];

export const AI_BOY_NAMES: string[] = [
  "Ren",
  "Kaito",
  "Shin",
  "Haruto",
  "Akira",
  "Ryou",
  "Daichi",
  "Satoru",
  "Itsuki",
  "Makoto",
  "Toma",
  "Keiji",
  "Hayato",
  "Riku",
  "Kazuma",
  "Naoki",
  "Jiro",
  "Sosuke",
  "Yuto",
  "Kenshin"
];

export const AI_PLAYER_NAMES: string[] = [
  ...AI_GIRL_NAMES,
  ...AI_BOY_NAMES
];

// Helper to pick a random AI name with optional exclusion list
export const getRandomAiName = (exclude: string[] = []): string => {
  const pool = AI_PLAYER_NAMES.filter(n => !exclude.includes(n));
  const available = pool.length > 0 ? pool : AI_PLAYER_NAMES;
  return available[Math.floor(Math.random() * available.length)];
};

// Hero avatar fallbacks
const HERO_IMAGES = {
  FIRE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Hero.png",
  ICE: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Ice%20Hero.png",
  WIND: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Wind%20Hero.png",
  EARTH: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Earth%20Hero.png",
  SHIELD: "https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Fire%20Shield%20card(1).png",
};

// Elemental hero profile pictures for AI fighters
export const AI_AVATARS: Record<Element, string> = {
  [Element.FIRE]: HERO_IMAGES.FIRE,
  [Element.ICE]: HERO_IMAGES.ICE,
  [Element.WIND]: HERO_IMAGES.WIND,
  [Element.EARTH]: HERO_IMAGES.EARTH,
};

export interface TournamentFighter {
  id: string;
  name: string;
  avatar: string;
  element: Element;
  isPlayer: boolean;
  title: string;
  deck?: Card[];
}

export interface TournamentMatch {
  id: string;
  round: number; // 1 = Quarterfinals (4 matches), 2 = Semifinals (2 matches), 3 = Grand Final (1 match)
  matchNumber: number; // 1 to 7 overall
  fighter1: TournamentFighter;
  fighter2: TournamentFighter;
  winner: TournamentFighter | null;
  status: 'pending' | 'in_progress' | 'completed';
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
}

export interface TournamentState {
  id: string;
  round: number; // 1, 2, 3
  matches: TournamentMatch[];
  playerEliminated: boolean;
  champion: TournamentFighter | null;
}

const ALL_ELEMENTS = [Element.FIRE, Element.ICE, Element.WIND, Element.EARTH];
const TITLES = [
  "Gladiator", "Master", "Chieftain", "Acolyte", "Warden", "Sage", "Vanguard", "Berserker"
];

const CARD_IMAGE_MAP: Record<Element, Record<CardType, string>> = {
  [Element.FIRE]: {
    [CardType.SWORD]: CARD_IMAGES.FIRE_SWORD,
    [CardType.AXE]: CARD_IMAGES.FIRE_AXE,
    [CardType.SHIELD]: CARD_IMAGES.FIRE_SHIELD,
    [CardType.HERO]: CARD_IMAGES.FIRE_HERO,
  },
  [Element.ICE]: {
    [CardType.SWORD]: CARD_IMAGES.ICE_SWORD,
    [CardType.AXE]: CARD_IMAGES.ICE_AXE,
    [CardType.SHIELD]: CARD_IMAGES.ICE_SHIELD,
    [CardType.HERO]: CARD_IMAGES.ICE_HERO,
  },
  [Element.WIND]: {
    [CardType.SWORD]: CARD_IMAGES.WIND_SWORD,
    [CardType.AXE]: CARD_IMAGES.WIND_AXE,
    [CardType.SHIELD]: CARD_IMAGES.WIND_SHIELD,
    [CardType.HERO]: CARD_IMAGES.WIND_HERO,
  },
  [Element.EARTH]: {
    [CardType.SWORD]: CARD_IMAGES.EARTH_SWORD,
    [CardType.AXE]: CARD_IMAGES.EARTH_AXE,
    [CardType.SHIELD]: CARD_IMAGES.EARTH_SHIELD,
    [CardType.HERO]: CARD_IMAGES.EARTH_HERO,
  },
};

const ELEMENT_PREFIXES: Record<Element, string[]> = {
  [Element.FIRE]: ['Inferno', 'Blazing', 'Cinder', 'Solar', 'Magma', 'Volcanic', 'Pyre'],
  [Element.ICE]: ['Glacial', 'Frost', 'Blizzard', 'Arctic', 'Frozen', 'Cryo', 'Rime'],
  [Element.WIND]: ['Zephyr', 'Gale', 'Tempest', 'Cyclone', 'Aero', 'Vortex', 'Skyward'],
  [Element.EARTH]: ['Granite', 'Terra', 'Obsidian', 'Bedrock', 'Seismic', 'Crag', 'Fossil'],
};

const WEAPON_NAMES: Record<CardType, string[]> = {
  [CardType.SWORD]: ['Blade', 'Edge', 'Saber', 'Rapier', 'Cleaver', 'Longsword'],
  [CardType.AXE]: ['Waraxe', 'Cleaver', 'Halberd', 'Battleaxe', 'Chopper', 'Reaper'],
  [CardType.SHIELD]: ['Aegis', 'Bastion', 'Bulwark', 'Ward', 'Buckler', 'Wall'],
  [CardType.HERO]: ['Champion', 'Avatar', 'Paragon', 'Warlord', 'Titan', 'Sovereign'],
};

// Generates a unique 20-card deck for an AI fighter following tournament rules
export const generateAiTournamentDeck = (primaryElement: Element, fighterName: string): Card[] => {
  const deck: Card[] = [];
  const firstName = fighterName.split(' ')[0];

  // Distribute 20 cards: 10 primary element, 10 across secondary elements
  const secondaryElements = ALL_ELEMENTS.filter(e => e !== primaryElement);
  
  const elementPool: Element[] = [];
  for (let i = 0; i < 10; i++) elementPool.push(primaryElement);
  for (let i = 0; i < 10; i++) {
    elementPool.push(secondaryElements[i % secondaryElements.length]);
  }
  elementPool.sort(() => Math.random() - 0.5);

  const cardTypes = [
    CardType.SWORD, CardType.SWORD, CardType.SWORD, CardType.SWORD, CardType.SWORD, CardType.SWORD,
    CardType.AXE, CardType.AXE, CardType.AXE, CardType.AXE, CardType.AXE,
    CardType.SHIELD, CardType.SHIELD, CardType.SHIELD, CardType.SHIELD, CardType.SHIELD,
    CardType.HERO, CardType.HERO, CardType.HERO, CardType.HERO,
  ].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 20; i++) {
    const elem = elementPool[i];
    const type = cardTypes[i];
    const prefixList = ELEMENT_PREFIXES[elem];
    const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
    const nounList = WEAPON_NAMES[type];
    const noun = nounList[Math.floor(Math.random() * nounList.length)];

    let attack = 10;
    let defense = 5;

    // Randomize powers per card following martial balance rules
    if (type === CardType.SWORD) {
      attack = 8 + Math.floor(Math.random() * 8); // 8-15
      defense = 4 + Math.floor(Math.random() * 6); // 4-9
    } else if (type === CardType.AXE) {
      attack = 13 + Math.floor(Math.random() * 8); // 13-20
      defense = 1 + Math.floor(Math.random() * 4); // 1-4
    } else if (type === CardType.SHIELD) {
      attack = Math.floor(Math.random() * 4); // 0-3
      defense = 14 + Math.floor(Math.random() * 7); // 14-20
    } else { // HERO
      attack = 10 + Math.floor(Math.random() * 8); // 10-17
      defense = 8 + Math.floor(Math.random() * 8); // 8-15
    }

    const totalPower = attack + defense;
    let rarity = Rarity.COMMON;
    if (totalPower >= 24) rarity = Rarity.EPIC_RARE;
    else if (totalPower >= 20) rarity = Rarity.RARE;
    else if (totalPower >= 16) rarity = Rarity.UNCOMMON;

    const cardName = i === 0 
      ? `${firstName}'s ${prefix} ${noun}` 
      : `${prefix} ${noun}`;

    deck.push({
      id: `ai-deck-${fighterName.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
      name: cardName,
      element: elem,
      type,
      attack,
      defense,
      image: CARD_IMAGE_MAP[elem][type],
      description: `Wielded by ${fighterName}. Infused with ${elem.toLowerCase()} essence.`,
      rarity,
      isHero: type === CardType.HERO,
    });
  }

  return deck;
};

// Generates an 8-fighter martial arts tournament bracket
export const createInitialTournament = (
  playerName: string, 
  playerAvatar: string,
  playerDeck?: Card[]
): TournamentState => {
  // 1. Pick 7 unique AI fighters each with their own unique random deck
  const chosenNames: string[] = [];
  const aiFighters: TournamentFighter[] = [];

  for (let i = 0; i < 7; i++) {
    const name = getRandomAiName(chosenNames);
    chosenNames.push(name);
    const elem = ALL_ELEMENTS[Math.floor(Math.random() * ALL_ELEMENTS.length)];
    const title = TITLES[Math.floor(Math.random() * TITLES.length)];
    const aiDeck = generateAiTournamentDeck(elem, name);
    aiFighters.push({
      id: `ai-${i + 1}-${Date.now()}`,
      name,
      avatar: AI_AVATARS[elem] || HERO_IMAGES.FIRE,
      element: elem,
      isPlayer: false,
      title,
      deck: aiDeck,
    });
  }

  const playerFighter: TournamentFighter = {
    id: 'player-contender',
    name: playerName || 'Duelist',
    avatar: playerAvatar || HERO_IMAGES.FIRE,
    element: Element.FIRE,
    isPlayer: true,
    title: 'Contender',
    deck: playerDeck ? playerDeck.slice(0, 20) : undefined,
  };

  // Seed fighters: Player is in Match 1, fighter 1
  // Match 1: Player vs AI 0
  // Match 2: AI 1 vs AI 2
  // Match 3: AI 3 vs AI 4
  // Match 4: AI 5 vs AI 6
  const placeholderFighter: TournamentFighter = {
    id: 'tbd',
    name: 'TBD',
    avatar: HERO_IMAGES.SHIELD,
    element: Element.EARTH,
    isPlayer: false,
    title: 'Unknown',
  };

  const matches: TournamentMatch[] = [
    // Round 1: Quarterfinals (Matches 1-4)
    {
      id: 'm1',
      round: 1,
      matchNumber: 1,
      fighter1: playerFighter,
      fighter2: aiFighters[0],
      winner: null,
      status: 'pending',
      nextMatchId: 'm5',
      nextMatchSlot: 1,
    },
    {
      id: 'm2',
      round: 1,
      matchNumber: 2,
      fighter1: aiFighters[1],
      fighter2: aiFighters[2],
      winner: null,
      status: 'pending',
      nextMatchId: 'm5',
      nextMatchSlot: 2,
    },
    {
      id: 'm3',
      round: 1,
      matchNumber: 3,
      fighter1: aiFighters[3],
      fighter2: aiFighters[4],
      winner: null,
      status: 'pending',
      nextMatchId: 'm6',
      nextMatchSlot: 1,
    },
    {
      id: 'm4',
      round: 1,
      matchNumber: 4,
      fighter1: aiFighters[5],
      fighter2: aiFighters[6],
      winner: null,
      status: 'pending',
      nextMatchId: 'm6',
      nextMatchSlot: 2,
    },

    // Round 2: Semifinals (Matches 5-6)
    {
      id: 'm5',
      round: 2,
      matchNumber: 5,
      fighter1: placeholderFighter,
      fighter2: placeholderFighter,
      winner: null,
      status: 'pending',
      nextMatchId: 'm7',
      nextMatchSlot: 1,
    },
    {
      id: 'm6',
      round: 2,
      matchNumber: 6,
      fighter1: placeholderFighter,
      fighter2: placeholderFighter,
      winner: null,
      status: 'pending',
      nextMatchId: 'm7',
      nextMatchSlot: 2,
    },

    // Round 3: Grand Final (Match 7)
    {
      id: 'm7',
      round: 3,
      matchNumber: 7,
      fighter1: placeholderFighter,
      fighter2: placeholderFighter,
      winner: null,
      status: 'pending',
    },
  ];

  return {
    id: `tourney-${Date.now()}`,
    round: 1,
    matches,
    playerEliminated: false,
    champion: null,
  };
};

// Simulates an AI vs AI match outcome with natural variance
export const simulateAiMatch = (f1: TournamentFighter, f2: TournamentFighter): TournamentFighter => {
  // If one of the fighters is the player, simulation shouldn't happen automatically unless requested,
  // but if both are AI, 50/50 with slight element flavor
  const rand = Math.random();
  return rand > 0.5 ? f1 : f2;
};

// Advances the tournament state when a match concludes
export const advanceTournamentMatch = (
  tournament: TournamentState,
  matchId: string,
  winner: TournamentFighter
): TournamentState => {
  const matches = tournament.matches.map(m => {
    if (m.id === matchId) {
      return { ...m, winner, status: 'completed' as const };
    }
    return m;
  });

  const completedMatch = matches.find(m => m.id === matchId);
  if (!completedMatch) return tournament;

  // If this match feeds into a next match
  if (completedMatch.nextMatchId && completedMatch.nextMatchSlot) {
    const nextId = completedMatch.nextMatchId;
    const slot = completedMatch.nextMatchSlot;

    for (let i = 0; i < matches.length; i++) {
      if (matches[i].id === nextId) {
        if (slot === 1) {
          matches[i] = { ...matches[i], fighter1: winner };
        } else {
          matches[i] = { ...matches[i], fighter2: winner };
        }
      }
    }
  }

  // Check if player was eliminated
  const isMatchWithPlayer = completedMatch.fighter1.isPlayer || completedMatch.fighter2.isPlayer;
  const playerEliminated = tournament.playerEliminated || (isMatchWithPlayer && !winner.isPlayer);

  // Check if Grand Final completed
  let champion = tournament.champion;
  if (matchId === 'm7') {
    champion = winner;
  }

  // Determine current round
  const r1Complete = matches.filter(m => m.round === 1).every(m => m.status === 'completed');
  const r2Complete = matches.filter(m => m.round === 2).every(m => m.status === 'completed');
  const currentRound = r2Complete ? 3 : r1Complete ? 2 : 1;

  return {
    ...tournament,
    round: currentRound,
    matches,
    playerEliminated,
    champion,
  };
};
