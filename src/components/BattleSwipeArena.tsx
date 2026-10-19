import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Element, Rarity, CardType } from '../../types';
import { VFX, SOUNDS, ELEMENT_ICONS, ELEMENTAL_BALLS, ELEMENTAL_BACKDROPS, CARD_IMAGES } from '../../constants';
import { RARITY_CONFIGS } from '../utils/rarity';
import { Eye, Flame, Sparkles } from 'lucide-react';

export interface PreDuelResult {
  winner: 'player' | 'computer' | 'tie';
  bonusPoints: number;
  reason: string;
}

interface BattleSwipeArenaProps {
  playerCard: Card;
  computerCard: Card;
  currentEnvElement: Element | null;
  arenaBackdrop?: string;
  level: number;
  playSound: (soundUrl: string) => void;
  isMuted: boolean;
  onComplete: (result: {
    playerScore: number;
    computerScore: number;
    winner: 'player' | 'computer' | 'tie';
  }) => void;
  onOpen3DCard?: (card: Card) => void;
  isSpectating?: boolean;
  fighter1Name?: string;
  fighter2Name?: string;
  fighter1Avatar?: string;
  fighter2Avatar?: string;
  tournamentRound?: number;
  preDuelResult?: PreDuelResult;
  isMultiplayer?: boolean;
  onSendScore?: (score: number) => void;
  remoteScore?: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
  type: 'spark' | 'shard' | 'ember' | 'star' | 'smoke';
  rotation: number;
  rotSpeed: number;
  alpha: number;
}

interface SlashFlashStreak {
  id: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  color: string;
  startTime: number;
  duration: number;
}

interface AiSlashTrail {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  coreColor: string;
  fighterName: string;
  startTime: number;
  duration: number;
}

interface CanvasShockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  opacity: number;
  color: string;
  lineWidth: number;
}

interface TrailingWisp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

interface FallingElementalOrb {
  id: string;
  spawnOrder: number;
  x: number;
  y: number;
  lane: number;
  vx: number;
  vy: number;
  radius: number;
  element: Element;
  rotation: number;
  rotationSpeed: number;
  pulsePhase: number;
  isStruck: boolean;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  auraColor: string;
}

interface SlicedOrbPiece {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  element: Element;
  cutAngle: number;
  rotation: number;
  rotSpeed: number;
  half: 'left' | 'right';
  primaryColor: string;
  sliceColor: string;
  startTime: number;
  duration: number;
}

interface FallingHazardBomb {
  id: string;
  x: number;
  y: number;
  lane: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  fusePhase: number;
  pulsePhase: number;
  isDetonated: boolean;
}

interface DragPoint {
  x: number;
  y: number;
  time: number;
}

// In-Game Arcade Floating Combo Texts (Pops up directly in the arena, no DOM shift!)
interface FloatingGameText {
  id: string;
  text: string;
  subtext?: string;
  x: number;
  y: number;
  vy: number;
  scale: number;
  color: string;
  strokeColor: string;
  startTime: number;
  duration: number;
  isCombo?: boolean;
  isStyle?: boolean;
}

const BATTLE_DURATION_SEC = 10;
const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 620;
const START_Y = -50;
const BOTTOM_Y = 590;

const MAX_CONCURRENT_ORBS = 3;
const LANES_COUNT = 3;
const LANE_X = [105, 230, 355];

const ELEMENT_COLORS: Record<Element, {
  primary: string;
  secondary: string;
  glow: string;
  aura: string;
  dark: string;
  core: string;
}> = {
  [Element.FIRE]: {
    primary: '#f97316',
    secondary: '#ef4444',
    glow: 'rgba(255, 107, 0, 0.30)',
    aura: 'rgba(255, 69, 0, 0.10)',
    dark: '#7f1d1d',
    core: '#fff7ed',
  },
  [Element.ICE]: {
    primary: '#38bdf8',
    secondary: '#0284c7',
    glow: 'rgba(56, 189, 248, 0.30)',
    aura: 'rgba(14, 165, 233, 0.10)',
    dark: '#0c4a6e',
    core: '#f0f9ff',
  },
  [Element.WIND]: {
    primary: '#4ade80',
    secondary: '#16a34a',
    glow: 'rgba(74, 222, 128, 0.30)',
    aura: 'rgba(34, 197, 94, 0.10)',
    dark: '#14532d',
    core: '#f0fdf4',
  },
  [Element.EARTH]: {
    primary: '#fbbf24',
    secondary: '#d97706',
    glow: 'rgba(251, 191, 36, 0.30)',
    aura: 'rgba(217, 119, 6, 0.10)',
    dark: '#713f12',
    core: '#fefce8',
  },
};

const ELEMENT_BURST_PALETTES: Record<Element, string[]> = {
  [Element.FIRE]: ['#ffffff', '#fff7ed', '#fde047', '#fb923c', '#f97316', '#ef4444', '#dc2626'],
  [Element.ICE]: ['#ffffff', '#f0f9ff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#0284c7', '#0369a1'],
  [Element.WIND]: ['#ffffff', '#f0fdf4', '#dcfce7', '#86efac', '#4ade80', '#16a34a', '#15803d'],
  [Element.EARTH]: ['#ffffff', '#fefce8', '#fef9c3', '#fef08a', '#fbbf24', '#f59e0b', '#d97706'],
};

// Represents an isolated battle arena simulation for one player
interface FighterArenaState {
  fallingOrbs: FallingElementalOrb[];
  fallingBombs: FallingHazardBomb[];
  slicedPieces: SlicedOrbPiece[];
  burstParticles: BurstParticle[];
  shockwaves: CanvasShockwave[];
  slashStreaks: SlashFlashStreak[];
  aiSlashTrails: AiSlashTrail[];
  trailingWisps: TrailingWisp[];
  floatingTexts: FloatingGameText[];
  score: number;
  comboCount: number;
  maxCombo: number;
  lastBombSpawnTime: number;
  orbSpawnCounter: number;
  lastSoundTime: number;
}

export const BattleSwipeArena: React.FC<BattleSwipeArenaProps> = ({
  playerCard,
  computerCard,
  currentEnvElement,
  arenaBackdrop,
  level,
  playSound,
  isMuted,
  onComplete,
  onOpen3DCard,
  isSpectating = false,
  fighter1Name = 'Player',
  fighter2Name = 'Opponent',
  fighter1Avatar,
  fighter2Avatar,
  tournamentRound,
  preDuelResult,
  isMultiplayer = false,
  onSendScore,
  remoteScore,
}) => {
  const effectiveBackdrop = arenaBackdrop || (currentEnvElement ? ELEMENTAL_BACKDROPS[currentEnvElement] : ELEMENTAL_BACKDROPS.FIRE);

  // Initial bonus
  const initialPlayerBonus = preDuelResult?.winner === 'player' ? preDuelResult.bonusPoints : 0;
  const initialOpponentBonus = preDuelResult?.winner === 'computer' ? preDuelResult.bonusPoints : 0;

  // Active watching target state: user can switch who they're watching at any time!
  const [activeViewingFighter, setActiveViewingFighter] = useState<'fighter1' | 'fighter2'>('fighter1');
  const [cameraSwitchPulse, setCameraSwitchPulse] = useState<boolean>(false);

  // Synchronized overall state
  const [playerScore, setPlayerScore] = useState<number>(initialPlayerBonus);
  const [computerScore, setComputerScore] = useState<number>(initialOpponentBonus);
  const [fighter1Combo, setFighter1Combo] = useState<number>(0);
  const [fighter2Combo, setFighter2Combo] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(BATTLE_DURATION_SEC);
  const [isBattleFinished, setIsBattleFinished] = useState<boolean>(false);
  const [finalWinner, setFinalWinner] = useState<'player' | 'computer' | 'tie' | null>(null);
  const [shakeMagnitude, setShakeMagnitude] = useState<number>(0);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [isDangerFlash, setIsDangerFlash] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const arenaTargetRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isCompletedRef = useRef<boolean>(false);
  const lastTimeUpdateRef = useRef<number>(0);
  const activeViewingFighterRef = useRef<'fighter1' | 'fighter2'>('fighter1');
  activeViewingFighterRef.current = activeViewingFighter;

  // Touch/pointer drag tracking
  const isPointerDownRef = useRef<boolean>(false);
  const dragPointsRef = useRef<DragPoint[]>([]);

  // Sound and complete refs
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSendScoreRef = useRef(onSendScore);
  onSendScoreRef.current = onSendScore;

  // Elemental references
  const enemyElement = computerCard?.element || Element.FIRE;
  const enemyColors = ELEMENT_COLORS[enemyElement] || ELEMENT_COLORS[Element.FIRE];
  const playerColors = (playerCard?.element && ELEMENT_COLORS[playerCard.element]) || ELEMENT_COLORS[Element.ICE];

  // Pre-load all Elemental Ball Images
  const elementalBallImagesRef = useRef<Record<Element, HTMLImageElement | null>>({
    [Element.FIRE]: null,
    [Element.ICE]: null,
    [Element.EARTH]: null,
    [Element.WIND]: null,
  });

  useEffect(() => {
    const elements: Element[] = [Element.FIRE, Element.ICE, Element.EARTH, Element.WIND];
    elements.forEach((el) => {
      const url = ELEMENTAL_BALLS[el];
      if (url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
          elementalBallImagesRef.current[el] = img;
        };
        img.onerror = () => {
          elementalBallImagesRef.current[el] = null;
        };
      }
    });
  }, []);

  // TWO SEPARATE ARENAS: Fighter 1 Arena and Fighter 2 Arena
  const fighter1ArenaRef = useRef<FighterArenaState>({
    fallingOrbs: [],
    fallingBombs: [],
    slicedPieces: [],
    burstParticles: [],
    shockwaves: [],
    slashStreaks: [],
    aiSlashTrails: [],
    trailingWisps: [],
    floatingTexts: [],
    score: initialPlayerBonus,
    comboCount: 0,
    maxCombo: 0,
    lastBombSpawnTime: 0,
    orbSpawnCounter: 0,
    lastSoundTime: 0,
  });

  const fighter2ArenaRef = useRef<FighterArenaState>({
    fallingOrbs: [],
    fallingBombs: [],
    slicedPieces: [],
    burstParticles: [],
    shockwaves: [],
    slashStreaks: [],
    aiSlashTrails: [],
    trailingWisps: [],
    floatingTexts: [],
    score: initialOpponentBonus,
    comboCount: 0,
    maxCombo: 0,
    lastBombSpawnTime: 0,
    orbSpawnCounter: 0,
    lastSoundTime: 0,
  });

  // Sound player with throttle
  const playSwipeSound = useCallback((arena: FighterArenaState, soundUrl: string) => {
    const now = performance.now();
    if (now - arena.lastSoundTime > 110) {
      arena.lastSoundTime = now;
      playSoundRef.current(soundUrl);
    }
  }, []);

  // Spawn orb in a specific arena
  const spawnOrbInArena = useCallback((fighterKey: 'fighter1' | 'fighter2') => {
    const arena = fighterKey === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;
    if (arena.fallingOrbs.length >= MAX_CONCURRENT_ORBS) return;

    arena.orbSpawnCounter += 1;
    const spawnNum = arena.orbSpawnCounter;

    // Lane selection
    const occupiedLanes = arena.fallingOrbs.map(o => o.lane);
    const availableLanes = [0, 1, 2].filter(l => !occupiedLanes.includes(l));
    const lane = availableLanes.length > 0 ? availableLanes[Math.floor(Math.random() * availableLanes.length)] : Math.floor(Math.random() * LANES_COUNT);

    const targetX = LANE_X[lane];
    const jitterX = (Math.random() - 0.5) * 14;
    const x = Math.max(50, Math.min(CANVAS_WIDTH - 50, targetX + jitterX));

    // Element selection
    const orbElement = fighterKey === 'fighter1' ? enemyElement : (playerCard?.element || Element.FIRE);
    const colors = ELEMENT_COLORS[orbElement] || ELEMENT_COLORS[Element.FIRE];

    // Speed: smooth and readable
    const baseSpeed = 2.4 + Math.min(level, 10) * 0.12;
    const vy = baseSpeed + (Math.random() - 0.5) * 0.3;
    const vx = (Math.random() - 0.5) * 0.4;

    arena.fallingOrbs.push({
      id: `orb-${fighterKey}-${Date.now()}-${Math.random()}`,
      spawnOrder: spawnNum,
      x,
      y: START_Y - Math.random() * 20,
      lane,
      vx,
      vy,
      radius: 36,
      element: orbElement,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.04,
      pulsePhase: Math.random() * Math.PI * 2,
      isStruck: false,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      glowColor: colors.glow,
      auraColor: colors.aura,
    });
  }, [enemyElement, playerCard?.element, level]);

  // Spawn bomb in a specific arena
  const spawnBombInArena = useCallback((fighterKey: 'fighter1' | 'fighter2') => {
    const arena = fighterKey === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;
    if (arena.fallingBombs.length > 0) return;

    const lane = Math.floor(Math.random() * LANES_COUNT);
    const x = LANE_X[lane] + (Math.random() - 0.5) * 16;
    arena.lastBombSpawnTime = performance.now();

    arena.fallingBombs.push({
      id: `bomb-${fighterKey}-${Date.now()}`,
      x,
      y: START_Y,
      lane,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 2.2 + Math.min(level, 8) * 0.1,
      radius: 30,
      rotation: 0,
      rotSpeed: 0.04,
      fusePhase: 0,
      pulsePhase: 0,
      isDetonated: false,
    });
  }, [level]);

  // Spawn floating combo text right inside the arena (Zero DOM layout shift!)
  const spawnFloatingGameText = useCallback((
    arena: FighterArenaState,
    text: string,
    subtext: string,
    x: number,
    y: number,
    color: string,
    isCombo: boolean = false,
    isStyle: boolean = false
  ) => {
    arena.floatingTexts.push({
      id: `txt-${Date.now()}-${Math.random()}`,
      text,
      subtext,
      x: Math.max(70, Math.min(CANVAS_WIDTH - 70, x)),
      y: Math.max(90, Math.min(BOTTOM_Y - 40, y)),
      vy: 1.4,
      scale: isCombo ? 1.25 : 1.0,
      color,
      strokeColor: '#000000',
      startTime: performance.now(),
      duration: 850,
      isCombo,
      isStyle,
    });
  }, []);

  // Trigger visual explosion in an arena
  const triggerOrbExplosion = useCallback((
    arena: FighterArenaState,
    x: number,
    y: number,
    element: Element,
    cutColor: string,
    cutAngleDeg: number,
    isStyle: boolean
  ) => {
    const palette = ELEMENT_BURST_PALETTES[element] || ELEMENT_BURST_PALETTES[Element.FIRE];
    const cutAngleRad = (cutAngleDeg * Math.PI) / 180;

    // Shockwave
    arena.shockwaves.push({
      x,
      y,
      r: 8,
      maxR: isStyle ? 65 : 48,
      opacity: 0.85,
      color: cutColor,
      lineWidth: 3,
    });

    // Cutting Flash Line
    arena.slashStreaks.push({
      id: Date.now() + Math.random(),
      x,
      y,
      angle: cutAngleRad,
      length: 110,
      width: 4.5,
      color: cutColor,
      startTime: performance.now(),
      duration: 180,
    });

    // Burst Shards
    const count = isStyle ? 20 : 14;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      const col = palette[Math.floor(Math.random() * palette.length)];
      arena.burstParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        color: col,
        size: Math.random() * 3 + 1.5,
        life: 0.8,
        decay: Math.random() * 0.04 + 0.02,
        type: Math.random() > 0.4 ? 'shard' : 'spark',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        alpha: 1,
      });
    }
  }, []);

  // Slice an orb in an arena
  const sliceOrbInArena = useCallback((
    fighterKey: 'fighter1' | 'fighter2',
    orb: FallingElementalOrb,
    sliceAngleDeg: number,
    styleBonus?: { name: string; bonus: number } | null
  ) => {
    const arena = fighterKey === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;
    if (orb.isStruck) return;
    orb.isStruck = true;

    // Check if in-order (lowest spawnOrder among active orbs)
    const activeUnstruck = arena.fallingOrbs.filter(o => !o.isStruck && o.y < BOTTOM_Y);
    let minSpawnOrb = orb;
    for (const o of activeUnstruck) {
      if (o.spawnOrder < minSpawnOrb.spawnOrder) {
        minSpawnOrb = o;
      }
    }
    const isInOrder = orb.id === minSpawnOrb.id || orb.spawnOrder <= minSpawnOrb.spawnOrder;

    const cutColor = fighterKey === 'fighter1' ? playerColors.primary : enemyColors.primary;
    const duelistName = fighterKey === 'fighter1' ? fighter1Name : fighter2Name;

    // Visual explosion
    triggerOrbExplosion(arena, orb.x, orb.y, orb.element, cutColor, sliceAngleDeg, Boolean(styleBonus));

    // Spawn half pieces
    const cutAngleRad = (sliceAngleDeg * Math.PI) / 180;
    const perpAngle = cutAngleRad + Math.PI / 2;
    const splitForce = 4.8;
    const now = performance.now();

    arena.slicedPieces.push(
      {
        id: `slice-l-${Date.now()}-${orb.id}`,
        x: orb.x,
        y: orb.y,
        vx: Math.cos(perpAngle) * splitForce,
        vy: Math.sin(perpAngle) * splitForce - 1.8,
        radius: orb.radius,
        element: orb.element,
        cutAngle: sliceAngleDeg,
        rotation: orb.rotation,
        rotSpeed: -0.2,
        half: 'left',
        primaryColor: orb.primaryColor,
        sliceColor: cutColor,
        startTime: now,
        duration: 450,
      },
      {
        id: `slice-r-${Date.now()}-${orb.id}`,
        x: orb.x,
        y: orb.y,
        vx: -Math.cos(perpAngle) * splitForce,
        vy: -Math.sin(perpAngle) * splitForce - 1.8,
        radius: orb.radius,
        element: orb.element,
        cutAngle: sliceAngleDeg,
        rotation: orb.rotation,
        rotSpeed: 0.2,
        half: 'right',
        primaryColor: orb.primaryColor,
        sliceColor: cutColor,
        startTime: now,
        duration: 450,
      }
    );

    // Audio
    playSwipeSound(arena, orb.element === Element.ICE ? SOUNDS.ICE_SLICE : SOUNDS.CARD_SWIPE);

    // Calculate score & combo
    let earnedPoints = 10;
    if (isInOrder) {
      arena.comboCount += 1;
      const curCombo = arena.comboCount;
      if (curCombo > arena.maxCombo) arena.maxCombo = curCombo;

      let multiplier = curCombo >= 10 ? 1.4 : curCombo >= 6 ? 1.25 : curCombo >= 3 ? 1.15 : 1.0;
      earnedPoints = Math.round(10 * multiplier);

      if (styleBonus) {
        earnedPoints += styleBonus.bonus;
      }
      arena.score += earnedPoints;

      // In-Game floating combo popup (directly inside the arena!)
      const comboText = curCombo >= 8 ? `🔥 FEVER x${curCombo}!` : curCombo >= 4 ? `⚡ MEGA x${curCombo}!` : `COMBO x${curCombo}`;
      const sub = styleBonus ? `+${earnedPoints} PTS • ${styleBonus.name}` : `+${earnedPoints} PTS IN ORDER`;
      spawnFloatingGameText(arena, comboText, sub, orb.x, orb.y, curCombo >= 6 ? '#facc15' : cutColor, true, Boolean(styleBonus));
    } else {
      arena.comboCount = 0;
      earnedPoints = 5;
      arena.score += earnedPoints;
      spawnFloatingGameText(arena, `+5 PTS`, `OUT OF ORDER #${orb.spawnOrder}`, orb.x, orb.y, '#f97316', false);
    }

    // Sync score & combo state
    if (fighterKey === 'fighter1') {
      setPlayerScore(arena.score);
      setFighter1Combo(arena.comboCount);
    } else {
      setComputerScore(arena.score);
      setFighter2Combo(arena.comboCount);
    }

    // Spawn replacement
    setTimeout(() => {
      spawnOrbInArena(fighterKey);
    }, 180);
  }, [playerColors.primary, enemyColors.primary, fighter1Name, fighter2Name, triggerOrbExplosion, playSwipeSound, spawnFloatingGameText, spawnOrbInArena]);

  // Detonate hazard bomb
  const detonateBombInArena = useCallback((fighterKey: 'fighter1' | 'fighter2', bomb: FallingHazardBomb) => {
    const arena = fighterKey === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;
    if (bomb.isDetonated) return;
    bomb.isDetonated = true;

    arena.comboCount = 0;
    arena.score = Math.max(0, arena.score - 50);

    if (fighterKey === 'fighter1') {
      setPlayerScore(arena.score);
      setFighter1Combo(0);
      setIsDangerFlash(true);
      setTimeout(() => setIsDangerFlash(false), 240);
    } else {
      setComputerScore(arena.score);
      setFighter2Combo(0);
    }

    playSoundRef.current(SOUNDS.FIRE_EXPLOSION);
    setShakeMagnitude(12);
    setTimeout(() => setShakeMagnitude(0), 300);

    // Floating bomb penalty popup
    spawnFloatingGameText(arena, `💥 BOMB DETONATED!`, `-50 PTS • COMBO LOST`, bomb.x, bomb.y, '#ef4444', false);
  }, [spawnFloatingGameText]);

  // AI strike execution in an arena (for spectator mode or AI opponent)
  const executeAiStrikeInArena = useCallback((fighterKey: 'fighter1' | 'fighter2') => {
    const arena = fighterKey === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;
    if (isCompletedRef.current) return;

    const activeOrbs = arena.fallingOrbs.filter(o => !o.isStruck && o.y > 60 && o.y < BOTTOM_Y - 20);
    if (activeOrbs.length === 0) return;

    // AI knows how combos are made: targets lowest spawnOrder in sequence
    activeOrbs.sort((a, b) => a.spawnOrder - b.spawnOrder);
    const targetOrb = Math.random() < 0.88 ? activeOrbs[0] : (activeOrbs[1] || activeOrbs[0]);
    if (!targetOrb) return;

    // Style combo check
    let styleBonus: { name: string; bonus: number } | null = null;
    if (arena.comboCount >= 2 && Math.random() < 0.35) {
      styleBonus = Math.random() > 0.5
        ? { name: 'S-PATTERN BLADE', bonus: 12 }
        : { name: 'VORTEX SLICE', bonus: 15 };
    }

    const cutAngleDeg = (fighterKey === 'fighter1' ? 38 : -38) + (Math.random() * 20 - 10);
    const cutColor = fighterKey === 'fighter1' ? playerColors.primary : enemyColors.primary;
    const duelistName = fighterKey === 'fighter1' ? fighter1Name : fighter2Name;

    // Generate visual blade slash trail
    const span = targetOrb.radius * 2.3;
    const cutAngleRad = (cutAngleDeg * Math.PI) / 180;
    const cosA = Math.cos(cutAngleRad);
    const sinA = Math.sin(cutAngleRad);

    const trailPts: { x: number; y: number }[] = [];
    if (styleBonus && styleBonus.name === 'S-PATTERN BLADE') {
      for (let s = -3; s <= 3; s++) {
        const t = s / 3;
        trailPts.push({
          x: targetOrb.x + cosA * (t * span),
          y: targetOrb.y + sinA * (t * span) + Math.sin(t * Math.PI * 2) * 18,
        });
      }
    } else {
      trailPts.push(
        { x: targetOrb.x - cosA * span, y: targetOrb.y - sinA * span },
        { x: targetOrb.x, y: targetOrb.y },
        { x: targetOrb.x + cosA * span, y: targetOrb.y + sinA * span }
      );
    }

    arena.aiSlashTrails.push({
      id: `ai-trail-${Date.now()}-${Math.random()}`,
      points: trailPts,
      color: cutColor,
      coreColor: '#ffffff',
      fighterName: duelistName,
      startTime: performance.now(),
      duration: 300,
    });

    sliceOrbInArena(fighterKey, targetOrb, cutAngleDeg, styleBonus);
  }, [playerColors.primary, enemyColors.primary, fighter1Name, fighter2Name, sliceOrbInArena]);

  // Switch watching target by tapping profile image
  const handleSwitchWatchingTarget = (target: 'fighter1' | 'fighter2') => {
    if (activeViewingFighter === target) return;
    setActiveViewingFighter(target);
    setCameraSwitchPulse(true);
    playSoundRef.current(SOUNDS.CARD_SWIPE);
    setTimeout(() => setCameraSwitchPulse(false), 280);
  };

  // INITIAL ORB POPULATION for both arenas
  useEffect(() => {
    // Populate Fighter 1 Arena
    setTimeout(() => spawnOrbInArena('fighter1'), 100);
    setTimeout(() => spawnOrbInArena('fighter1'), 450);

    // Populate Fighter 2 Arena
    setTimeout(() => spawnOrbInArena('fighter2'), 150);
    setTimeout(() => spawnOrbInArena('fighter2'), 500);
  }, [spawnOrbInArena]);

  // INDEPENDENT BATTLE TICKERS:
  // - In Spectator Mode: BOTH Fighter 1 and Fighter 2 auto-swipe in their own separate arenas!
  // - In Solo Play: Player swipes in Fighter 1 arena, AI strikes in Fighter 2 arena!
  useEffect(() => {
    if (isBattleFinished || isMultiplayer) return;

    let f1Interval: NodeJS.Timeout | null = null;
    let f2Interval: NodeJS.Timeout | null = null;

    if (isSpectating) {
      // Spectator mode: Fighter 1 auto-strikes in Arena 1
      f1Interval = setInterval(() => {
        if (!isCompletedRef.current) executeAiStrikeInArena('fighter1');
      }, 430);

      // Spectator mode: Fighter 2 auto-strikes in Arena 2
      f2Interval = setInterval(() => {
        if (!isCompletedRef.current) executeAiStrikeInArena('fighter2');
      }, 460);
    } else {
      // Solo play: Opponent AI auto-strikes in Arena 2
      const opponentCadenceMs = Math.max(380, 700 - Math.min(level, 10) * 26);
      f2Interval = setInterval(() => {
        if (!isCompletedRef.current) executeAiStrikeInArena('fighter2');
      }, opponentCadenceMs);
    }

    return () => {
      if (f1Interval) clearInterval(f1Interval);
      if (f2Interval) clearInterval(f2Interval);
    };
  }, [isBattleFinished, isMultiplayer, isSpectating, level, executeAiStrikeInArena]);

  // MASTER 60FPS RAF LOOP (Physics, Canvas Rendering & Clock for both arenas)
  useEffect(() => {
    let animId: number;
    const startTime = performance.now();

    const render = () => {
      const now = performance.now();
      const elapsedSec = (now - startTime) / 1000;
      const remaining = Math.max(0, BATTLE_DURATION_SEC - elapsedSec);

      // Throttle timer state
      if (now - lastTimeUpdateRef.current >= 95 || remaining <= 0) {
        lastTimeUpdateRef.current = now;
        setTimeLeft(remaining);
      }

      // 10-Second Completion Check
      if (remaining <= 0 && !isCompletedRef.current) {
        isCompletedRef.current = true;
        setIsBattleFinished(true);

        const finalP = fighter1ArenaRef.current.score;
        const finalC = fighter2ArenaRef.current.score;
        let winner: 'player' | 'computer' | 'tie' = 'tie';
        if (finalP > finalC) winner = 'player';
        else if (finalC > finalP) winner = 'computer';

        setFinalWinner(winner);

        if (winner === 'player') playSoundRef.current(SOUNDS.GAME_WIN);
        else if (winner === 'computer') playSoundRef.current(SOUNDS.GAME_LOSE);
        else playSoundRef.current(SOUNDS.TIE_CLASH);

        setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => {
            onCompleteRef.current({
              playerScore: finalP,
              computerScore: finalC,
              winner,
            });
          }, 320);
        }, 1600);
      }

      // Physics update for BOTH arenas simultaneously
      const arenas: ('fighter1' | 'fighter2')[] = ['fighter1', 'fighter2'];
      for (const fKey of arenas) {
        const ar = fKey === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;

        // Bomb spawn check
        if (elapsedSec > 1.8 && remaining > 1.0 && !isCompletedRef.current) {
          if (ar.fallingBombs.length === 0 && now - ar.lastBombSpawnTime > 2800) {
            spawnBombInArena(fKey);
          }
        }

        // Maintain at least 2 active orbs
        const activeOrbs = ar.fallingOrbs.filter(o => !o.isStruck && o.y < BOTTOM_Y);
        if (activeOrbs.length < 2 && !isCompletedRef.current) {
          spawnOrbInArena(fKey);
        }

        // Update falling orbs
        for (let i = ar.fallingOrbs.length - 1; i >= 0; i--) {
          const o = ar.fallingOrbs[i];
          if (!o.isStruck) {
            o.y += o.vy;
            o.x += o.vx;
            o.rotation += o.rotationSpeed;
            o.pulsePhase += 0.06;

            if (o.x < 48) { o.x = 48; o.vx = Math.abs(o.vx); }
            else if (o.x > CANVAS_WIDTH - 48) { o.x = CANVAS_WIDTH - 48; o.vx = -Math.abs(o.vx); }

            // Off bottom screen: combo drop
            if (o.y > BOTTOM_Y + 35) {
              ar.fallingOrbs.splice(i, 1);
              if (ar.comboCount > 0) {
                ar.comboCount = 0;
                if (fKey === 'fighter1') setFighter1Combo(0);
                else setFighter2Combo(0);
                spawnFloatingGameText(ar, 'COMBO LOST!', 'TARGET ESCAPED', o.x, BOTTOM_Y - 30, '#ef4444', false);
              }
              if (!isCompletedRef.current) {
                setTimeout(() => spawnOrbInArena(fKey), 200);
              }
            }
          } else {
            ar.fallingOrbs.splice(i, 1);
          }
        }

        // Update falling bombs
        for (let i = ar.fallingBombs.length - 1; i >= 0; i--) {
          const b = ar.fallingBombs[i];
          if (!b.isDetonated) {
            b.y += b.vy;
            b.x += b.vx;
            b.fusePhase += 0.14;
            if (b.y > BOTTOM_Y + 30) {
              ar.fallingBombs.splice(i, 1);
            }
          } else {
            ar.fallingBombs.splice(i, 1);
          }
        }
      }

      // RENDER ACTIVE VIEWED ARENA ON CANVAS
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          const currentArena = activeViewingFighterRef.current === 'fighter1' ? fighter1ArenaRef.current : fighter2ArenaRef.current;
          const currentFighterName = activeViewingFighterRef.current === 'fighter1' ? fighter1Name : fighter2Name;
          const currentFighterColor = activeViewingFighterRef.current === 'fighter1' ? playerColors.primary : enemyColors.primary;

          // 1. Draw Shockwaves
          const waves = currentArena.shockwaves;
          for (let i = waves.length - 1; i >= 0; i--) {
            const w = waves[i];
            w.r += (w.maxR - w.r) * 0.22 + 1.2;
            w.opacity -= 0.06;
            if (w.opacity <= 0 || w.r >= w.maxR) {
              waves.splice(i, 1);
            } else {
              ctx.save();
              ctx.beginPath();
              ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
              ctx.strokeStyle = w.color;
              ctx.lineWidth = w.lineWidth * w.opacity;
              ctx.globalAlpha = Math.max(0, w.opacity);
              ctx.stroke();
              ctx.restore();
            }
          }

          // 2. Draw Slash Flash Streaks
          const streaks = currentArena.slashStreaks;
          for (let i = streaks.length - 1; i >= 0; i--) {
            const s = streaks[i];
            const age = now - s.startTime;
            const prog = age / s.duration;
            if (prog >= 1) {
              streaks.splice(i, 1);
            } else {
              const alpha = Math.max(0, 1 - prog);
              const cosA = Math.cos(s.angle);
              const sinA = Math.sin(s.angle);
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = s.color;
              ctx.lineWidth = s.width * (1 - prog * 0.5);
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(s.x - cosA * (s.length / 2), s.y - sinA * (s.length / 2));
              ctx.lineTo(s.x + cosA * (s.length / 2), s.y + sinA * (s.length / 2));
              ctx.stroke();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.4;
              ctx.stroke();
              ctx.restore();
            }
          }

          // 3. Draw Falling Elemental Orbs with Target Reticle
          const orbs = currentArena.fallingOrbs;
          const unstruckOrbs = orbs.filter(o => !o.isStruck && o.y < BOTTOM_Y);
          const sortedOrbs = [...unstruckOrbs].sort((a, b) => a.spawnOrder - b.spawnOrder);

          for (let i = 0; i < orbs.length; i++) {
            const orb = orbs[i];
            if (orb.isStruck || orb.y > BOTTOM_Y) continue;

            const isCurrentTarget = sortedOrbs.length > 0 && sortedOrbs[0].id === orb.id;
            const r = orb.radius;

            ctx.save();
            ctx.translate(orb.x, orb.y);

            // Lock-on Target Reticle on #1
            if (isCurrentTarget) {
              const rot = (now * 0.002) % (Math.PI * 2);
              ctx.save();
              ctx.rotate(rot);
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 2.4;
              ctx.shadowColor = '#eab308';
              ctx.shadowBlur = 10;
              ctx.setLineDash([8, 6]);
              ctx.beginPath();
              ctx.arc(0, 0, r * 1.34, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();

              // Crosshair tick marks
              ctx.save();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              const off = r * 1.15;
              ctx.beginPath(); ctx.moveTo(0, -off); ctx.lineTo(0, -off - 6); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(0, off); ctx.lineTo(0, off + 6); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-off, 0); ctx.lineTo(-off - 6, 0); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(off, 0); ctx.lineTo(off + 6, 0); ctx.stroke();
              ctx.restore();
            }

            // Custom Elemental Ball Image
            const ballImg = elementalBallImagesRef.current[orb.element];
            const diam = r * 2.0;

            ctx.save();
            ctx.rotate(orb.rotation);
            ctx.shadowColor = isCurrentTarget ? '#facc15' : orb.primaryColor;
            ctx.shadowBlur = isCurrentTarget ? 6 : 3;

            if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
              ctx.drawImage(ballImg, -diam / 2, -diam / 2, diam, diam);
            } else {
              const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
              grad.addColorStop(0, '#ffffff');
              grad.addColorStop(0.4, orb.primaryColor);
              grad.addColorStop(1, '#09090b');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(0, 0, r, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();

            // Sequence Rank Badge (#1, #2, #3)
            const rank = sortedOrbs.findIndex(o => o.id === orb.id) + 1;
            ctx.save();
            ctx.fillStyle = isCurrentTarget ? 'rgba(234, 179, 8, 0.95)' : 'rgba(0, 0, 0, 0.85)';
            ctx.strokeStyle = isCurrentTarget ? '#ffffff' : '#facc15';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.roundRect(-14, -r - 18, 28, 16, 5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isCurrentTarget ? '#000000' : '#ffffff';
            ctx.font = '900 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`#${rank}`, 0, -r - 10);
            ctx.restore();

            ctx.restore();
          }

          // 4. Draw Falling Hazard Bombs
          const bombs = currentArena.fallingBombs;
          for (let i = 0; i < bombs.length; i++) {
            const b = bombs[i];
            if (b.isDetonated || b.y > BOTTOM_Y) continue;
            const r = b.radius;

            ctx.save();
            ctx.translate(b.x, b.y);

            const bombGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
            bombGrad.addColorStop(0, '#52525b');
            bombGrad.addColorStop(0.5, '#18181b');
            bombGrad.addColorStop(1, '#000000');
            ctx.fillStyle = bombGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.2;
            ctx.stroke();

            ctx.fillStyle = '#ef4444';
            ctx.font = '900 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', 0, 1);

            ctx.restore();
          }

          // 5. Draw Sliced Ball Halves
          const pieces = currentArena.slicedPieces;
          for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            const prog = (now - p.startTime) / p.duration;
            if (prog >= 1) {
              pieces.splice(i, 1);
            } else {
              const alpha = Math.max(0, 1 - prog);
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(p.rotation);
              ctx.globalAlpha = alpha;

              const ballImg = elementalBallImagesRef.current[p.element];
              const diam = p.radius * 2;

              ctx.beginPath();
              if (p.half === 'left') {
                ctx.arc(0, 0, p.radius, Math.PI / 2, (3 * Math.PI) / 2);
              } else {
                ctx.arc(0, 0, p.radius, -Math.PI / 2, Math.PI / 2);
              }
              ctx.closePath();
              ctx.clip();

              if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
                ctx.drawImage(ballImg, -diam / 2, -diam / 2, diam, diam);
              } else {
                ctx.fillStyle = p.primaryColor;
                ctx.fill();
              }

              ctx.strokeStyle = p.sliceColor;
              ctx.lineWidth = 3;
              ctx.stroke();
              ctx.restore();
            }
          }

          // 6. Draw Burst Particles
          const parts = currentArena.burstParticles;
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= p.decay;

            if (p.life <= 0) {
              parts.splice(i, 1);
            } else {
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.globalAlpha = Math.max(0, p.life);
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(0, 0, p.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // 7. Draw AI Duelist Slash Trails
          const aiTrails = currentArena.aiSlashTrails;
          for (let i = aiTrails.length - 1; i >= 0; i--) {
            const tr = aiTrails[i];
            const age = now - tr.startTime;
            const prog = age / tr.duration;
            if (prog >= 1) {
              aiTrails.splice(i, 1);
            } else {
              const alpha = Math.max(0, 1 - prog);
              const pts = tr.points;
              if (pts.length >= 2) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
                ctx.strokeStyle = tr.color;
                ctx.lineWidth = 6 * (1 - prog * 0.35);
                ctx.globalAlpha = alpha * 0.85;
                ctx.shadowColor = tr.color;
                ctx.shadowBlur = 10;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.2 * (1 - prog * 0.35);
                ctx.globalAlpha = alpha;
                ctx.stroke();

                const head = pts[pts.length - 1];
                ctx.fillStyle = tr.color;
                ctx.font = '900 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(tr.fighterName.toUpperCase(), head.x, head.y - 8);
                ctx.restore();
              }
            }
          }

          // 8. Draw Human User's Real-Time Neon Blade Swipe Trail
          if (!isSpectating && activeViewingFighterRef.current === 'fighter1') {
            const dragPts = dragPointsRef.current;
            if (isPointerDownRef.current && dragPts.length >= 2) {
              ctx.save();
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';

              ctx.beginPath();
              ctx.moveTo(dragPts[0].x, dragPts[0].y);
              for (let i = 1; i < dragPts.length; i++) ctx.lineTo(dragPts[i].x, dragPts[i].y);
              ctx.strokeStyle = currentArena.comboCount >= 8 ? '#fde047' : playerColors.primary;
              ctx.lineWidth = 7;
              ctx.globalAlpha = 0.8;
              ctx.shadowColor = playerColors.primary;
              ctx.shadowBlur = 12;
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(dragPts[0].x, dragPts[0].y);
              for (let i = 1; i < dragPts.length; i++) ctx.lineTo(dragPts[i].x, dragPts[i].y);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2.4;
              ctx.globalAlpha = 1.0;
              ctx.stroke();
              ctx.restore();
            }
          }

          // 9. IN-GAME FLOATING COMBO POPUPS (Animated effects & tweets inside the arena!)
          const texts = currentArena.floatingTexts;
          for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            const age = now - t.startTime;
            const prog = age / t.duration;
            if (prog >= 1) {
              texts.splice(i, 1);
            } else {
              const alpha = Math.max(0, 1 - prog);
              const y = t.y - (prog * 55);
              const bounceScale = t.scale * (1 + Math.sin(prog * Math.PI) * 0.28);

              ctx.save();
              ctx.translate(t.x, y);
              ctx.scale(bounceScale, bounceScale);
              ctx.globalAlpha = alpha;

              // Comic black outline
              ctx.font = '900 20px Impact, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.lineWidth = 4.5;
              ctx.strokeStyle = t.strokeColor;
              ctx.strokeText(t.text, 0, 0);

              // Vibrant fill with neon shadow
              ctx.fillStyle = t.color;
              ctx.shadowColor = t.color;
              ctx.shadowBlur = 12;
              ctx.fillText(t.text, 0, 0);

              // Subtext
              if (t.subtext) {
                ctx.font = '900 10.5px sans-serif';
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#000000';
                ctx.strokeText(t.subtext, 0, 18);
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 4;
                ctx.fillText(t.subtext, 0, 18);
              }

              // Mini twinkling sparkle stars
              if (t.isCombo) {
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(-35, -12, 2.5, 0, Math.PI * 2);
                ctx.arc(35, -12, 2.5, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore();
            }
          }

          // 10. IN-GAME ARCADE COMBO CHAIN BADGE (Pinned inside the canvas upper corner)
          if (currentArena.comboCount >= 2) {
            const curCombo = currentArena.comboCount;
            const pulse = 1 + Math.sin(now * 0.008) * 0.06;
            ctx.save();
            ctx.translate(CANVAS_WIDTH - 95, 42);
            ctx.scale(pulse, pulse);

            // Badge pill
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.strokeStyle = curCombo >= 8 ? '#facc15' : '#fb923c';
            ctx.lineWidth = 2;
            ctx.shadowColor = curCombo >= 8 ? '#facc15' : '#f97316';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.roundRect(-55, -16, 110, 32, 10);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.fillStyle = curCombo >= 8 ? '#facc15' : '#ffffff';
            ctx.font = '900 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`🔥 ${curCombo}x COMBO`, 0, -2);

            const mult = curCombo >= 10 ? '1.4x FEVER' : curCombo >= 6 ? '1.25x BOOST' : '1.15x';
            ctx.fillStyle = '#fde047';
            ctx.font = '900 8.5px monospace';
            ctx.fillText(mult, 0, 9);

            ctx.restore();
          }

          // Live Arena Watermark Badge inside canvas
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.strokeStyle = currentFighterColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(14, 14, 155, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = currentFighterColor;
          ctx.font = '900 10px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`⚔️ ${currentFighterName.toUpperCase()}`, 24, 26);
          ctx.restore();
        }
      }

      if (!isCompletedRef.current) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    spawnOrbInArena,
    spawnBombInArena,
    spawnFloatingGameText,
    fighter1Name,
    fighter2Name,
    playerColors.primary,
    enemyColors.primary,
  ]);

  // Touch/pointer swipe hit testing (for player's manual strikes in Arena 1)
  const testSwipeHit = useCallback((canvasX: number, canvasY: number, prevCanvasX: number, prevCanvasY: number) => {
    // Only player swipes directly on Fighter 1's arena when playing
    if (isSpectating || isCompletedRef.current || activeViewingFighterRef.current !== 'fighter1') return;

    const dx = canvasX - prevCanvasX;
    const dy = canvasY - prevCanvasY;
    const moveDist = Math.hypot(dx, dy);
    const swipeAngleDeg = moveDist > 2 ? (Math.atan2(dy, dx) * 180) / Math.PI : 30;

    const arena = fighter1ArenaRef.current;

    // Check bombs
    for (let i = 0; i < arena.fallingBombs.length; i++) {
      const b = arena.fallingBombs[i];
      if (!b.isDetonated && b.y < BOTTOM_Y) {
        const dist = Math.hypot(canvasX - b.x, canvasY - b.y);
        if (dist <= b.radius + 12) {
          detonateBombInArena('fighter1', b);
          return;
        }
      }
    }

    // Check orbs
    const hitCandidates: FallingElementalOrb[] = [];
    for (let i = 0; i < arena.fallingOrbs.length; i++) {
      const orb = arena.fallingOrbs[i];
      if (!orb.isStruck && orb.y < BOTTOM_Y) {
        const dist = Math.hypot(canvasX - orb.x, canvasY - orb.y);
        if (dist <= orb.radius + 12) {
          hitCandidates.push(orb);
        }
      }
    }

    hitCandidates.sort((a, b) => a.spawnOrder - b.spawnOrder);
    for (const orb of hitCandidates) {
      if (!orb.isStruck) {
        sliceOrbInArena('fighter1', orb, swipeAngleDeg, null);
      }
    }
  }, [isSpectating, detonateBombInArena, sliceOrbInArena]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = arenaTargetRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = true;
    const { x, y } = getCanvasCoords(e);
    dragPointsRef.current = [{ x, y, time: performance.now() }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const { x, y } = getCanvasCoords(e);
    const hist = dragPointsRef.current;
    const lastPt = hist[hist.length - 1];
    if (lastPt) testSwipeHit(x, y, lastPt.x, lastPt.y);
    dragPointsRef.current = [...hist.slice(-12), { x, y, time: performance.now() }];
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    dragPointsRef.current = [];
  };

  const timerRatio = timeLeft / BATTLE_DURATION_SEC;
  const isTimeUrgent = timeLeft <= 3.0;

  const f1AvatarSrc = fighter1Avatar || CARD_IMAGES.FIRE_HERO;
  const f2AvatarSrc = fighter2Avatar || CARD_IMAGES.ICE_HERO;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-between overflow-hidden bg-neutral-950 select-none touch-none ${
        isDangerFlash ? 'brightness-150 bg-red-950/40' : isFlashActive ? 'brightness-125' : ''
      } ${isExiting ? 'opacity-0 scale-95 transition-all duration-300' : 'animate-in fade-in duration-200'}`}
      style={{
        transform: shakeMagnitude > 0 ? `translate(${(Math.random() - 0.5) * shakeMagnitude}px, ${(Math.random() - 0.5) * shakeMagnitude}px)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 1. CHOSEN FIELD OF BATTLE BACKGROUND (PANORAMIC BACKDROP) */}
      <div
        className="absolute inset-0 bg-cover bg-center brightness-[0.52] saturate-[1.25] scale-105 pointer-events-none z-0 transition-transform duration-1000 ease-out"
        style={{ backgroundImage: `url(${effectiveBackdrop})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/40 to-black/90 pointer-events-none z-0" />

      {/* TOP HEADER: SCORES, TIMER & INTERACTIVE PROFILE IMAGES TO SWITCH WATCHING VIEW */}
      <div className="relative z-30 w-full pt-2 sm:pt-3 px-2 sm:px-6 flex flex-col items-center gap-1.5 shrink-0 pointer-events-none">
        
        {/* Real-time Scores, Profile Avatars & 10s Timer HUD */}
        <div className="w-full max-w-xl flex items-center justify-between gap-1.5 sm:gap-4 bg-black/85 border border-white/20 rounded-2xl px-2.5 sm:px-5 py-1.5 sm:py-2 backdrop-blur-md shadow-2xl">
          
          {/* Fighter 1 Profile (Interactive: Tap to Watch Fighter 1!) */}
          <div
            onClick={() => handleSwitchWatchingTarget('fighter1')}
            className={`flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer pointer-events-auto transition-all p-1 rounded-xl ${
              activeViewingFighter === 'fighter1'
                ? 'bg-cyan-950/70 border border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-105'
                : 'opacity-70 hover:opacity-100'
            }`}
            title={`Tap to switch camera to ${fighter1Name}`}
          >
            <div className="relative shrink-0">
              <div className={`w-9 h-9 min-[380px]:w-11 min-[380px]:h-11 sm:w-13 sm:h-13 rounded-full overflow-hidden border-2 ${
                activeViewingFighter === 'fighter1' ? 'border-cyan-400 ring-2 ring-cyan-300' : 'border-neutral-500'
              }`}>
                <img src={f1AvatarSrc} alt={fighter1Name} className="w-full h-full object-cover" />
              </div>
              {activeViewingFighter === 'fighter1' && (
                <div className="absolute -top-1.5 -left-1.5 bg-cyan-500 text-black px-1.5 py-0.2 rounded-full text-[6px] sm:text-[7.5px] font-black uppercase tracking-wider flex items-center gap-0.5 animate-pulse shadow">
                  <Eye className="w-2 h-2" />
                  <span>WATCH</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-start min-w-[65px] sm:min-w-[95px]">
              <span className="text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider text-cyan-400 truncate max-w-[85px] sm:max-w-[120px]">
                {fighter1Name}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-base min-[400px]:text-xl sm:text-3xl font-mono font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]">
                  {playerScore}
                </span>
                <span className="text-[7.5px] sm:text-[8.5px] text-cyan-400/80 font-bold uppercase">PTS</span>
              </div>
            </div>
          </div>

          {/* Center 10s Countdown Timer with Radial Dial */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative w-10 min-[380px]:w-12 sm:w-15 h-10 min-[380px]:h-12 sm:h-15 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="42%" stroke="#27272a" strokeWidth="3.5" fill="none" />
                <circle
                  cx="50%"
                  cy="50%"
                  r="42%"
                  stroke={isTimeUrgent ? '#ef4444' : '#eab308'}
                  strokeWidth="3.5"
                  strokeDasharray="264"
                  strokeDashoffset={264 * (1 - timerRatio)}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-75"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-sm sm:text-lg font-mono font-black tracking-tight ${isTimeUrgent ? 'text-red-500 animate-pulse text-base sm:text-xl' : 'text-yellow-400'}`}>
                  {timeLeft.toFixed(1)}s
                </span>
              </div>
            </div>
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-neutral-400 mt-0.5">
              SWIPE DUEL
            </span>
          </div>

          {/* Fighter 2 Profile (Interactive: Tap to Watch Fighter 2!) */}
          <div
            onClick={() => handleSwitchWatchingTarget('fighter2')}
            className={`flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer pointer-events-auto transition-all p-1 rounded-xl flex-row-reverse text-right ${
              activeViewingFighter === 'fighter2'
                ? 'bg-red-950/70 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-105'
                : 'opacity-70 hover:opacity-100'
            }`}
            title={`Tap to switch camera to ${fighter2Name}`}
          >
            <div className="relative shrink-0">
              <div className={`w-9 h-9 min-[380px]:w-11 min-[380px]:h-11 sm:w-13 sm:h-13 rounded-full overflow-hidden border-2 ${
                activeViewingFighter === 'fighter2' ? 'border-red-500 ring-2 ring-red-400' : 'border-neutral-500'
              }`}>
                <img src={f2AvatarSrc} alt={fighter2Name} className="w-full h-full object-cover" />
              </div>
              {activeViewingFighter === 'fighter2' && (
                <div className="absolute -top-1.5 -right-1.5 bg-red-600 text-white px-1.5 py-0.2 rounded-full text-[6px] sm:text-[7.5px] font-black uppercase tracking-wider flex items-center gap-0.5 animate-pulse shadow">
                  <Eye className="w-2 h-2" />
                  <span>WATCH</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end min-w-[65px] sm:min-w-[95px]">
              <span className="text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider text-red-400 truncate max-w-[85px] sm:max-w-[120px]">
                {fighter2Name}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-base min-[400px]:text-xl sm:text-3xl font-mono font-black text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                  {computerScore}
                </span>
                <span className="text-[7.5px] sm:text-[8.5px] text-red-400/80 font-bold uppercase">PTS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Watching Switch Pill Indicator (Never shifts play area) */}
        <div className="flex items-center justify-center gap-2 pointer-events-auto">
          <div className="px-3 py-0.5 rounded-full bg-black/85 border border-yellow-500/50 text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>
              LIVE VIEW: {activeViewingFighter === 'fighter1' ? fighter1Name.toUpperCase() : fighter2Name.toUpperCase()} • TAP OPPOSITE PROFILE TO SWITCH
            </span>
          </div>
        </div>
      </div>

      {/* CENTER ARENA: RIGID FIXED DIMENSIONS (NEVER SHRINKS, NEVER JUMPS, NEVER SHIFTS) */}
      <div
        ref={arenaTargetRef}
        className={`relative w-full max-w-[430px] sm:max-w-[460px] h-[510px] sm:h-[570px] shrink-0 my-auto overflow-hidden rounded-3xl border-2 border-white/20 bg-black/40 backdrop-blur-[2px] shadow-[0_0_50px_rgba(0,0,0,0.85)] cursor-crosshair transition-all duration-200 ${
          cameraSwitchPulse ? 'scale-[1.02] border-yellow-400' : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        />

        {/* Subdued Bottom Guide Line */}
        <div className="absolute bottom-2 inset-x-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-[8.5px] font-black uppercase text-yellow-300/80 bg-black/80 px-3 py-0.5 rounded-full border border-yellow-500/40 tracking-wider backdrop-blur-md">
            HIT TARGET #1 FIRST FOR COMBO • DODGE BOMBS
          </span>
        </div>
      </div>

      {/* BOTTOM CARDS BAR (Both Duelist Cards Fixed at Bottom for Reference) */}
      <div className="relative z-30 w-full pb-2 px-3 sm:px-6 flex items-center justify-between max-w-xl shrink-0 pointer-events-auto">
        {/* Fighter 1 Card */}
        {playerCard && (
          <div
            onClick={() => onOpen3DCard && onOpen3DCard(playerCard)}
            className="flex items-center gap-1.5 bg-black/80 border border-cyan-500/40 px-2 py-1 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow"
            title={`${playerCard.name} • Tap to view 3D`}
          >
            <div className="w-7 sm:w-8 aspect-[640/880] rounded overflow-hidden border border-cyan-400 bg-black">
              <img src={playerCard.image} alt={playerCard.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[7px] sm:text-[8px] font-black uppercase text-cyan-300 truncate max-w-[80px]">
                {playerCard.name}
              </span>
              <span className="text-[6.5px] text-yellow-400 font-bold">
                ⚔️ {playerCard.attack} · {playerCard.element}
              </span>
            </div>
          </div>
        )}

        <div className="text-[7.5px] sm:text-[9px] font-black text-white/50 tracking-widest uppercase">
          {activeViewingFighter === 'fighter1' ? `ARENA 1 (${fighter1Name})` : `ARENA 2 (${fighter2Name})`}
        </div>

        {/* Fighter 2 Card */}
        {computerCard && (
          <div
            onClick={() => onOpen3DCard && onOpen3DCard(computerCard)}
            className="flex items-center gap-1.5 bg-black/80 border border-red-500/40 px-2 py-1 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow flex-row-reverse text-right"
            title={`${computerCard.name} • Tap to view 3D`}
          >
            <div className="w-7 sm:w-8 aspect-[640/880] rounded overflow-hidden border border-red-500 bg-black">
              <img src={computerCard.image} alt={computerCard.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[7px] sm:text-[8px] font-black uppercase text-red-400 truncate max-w-[80px]">
                {computerCard.name}
              </span>
              <span className="text-[6.5px] text-yellow-400 font-bold">
                ⚔️ {computerCard.attack} · {computerCard.element}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FINAL SCOREBOARD & WINNER SUMMARY */}
      {isBattleFinished && (
        <div className="absolute inset-0 z-[300] bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-3 text-center max-w-lg">
            <span className="text-yellow-500 font-mono text-xs sm:text-sm uppercase tracking-[0.3em] font-black animate-pulse">
              10 SECONDS COMPLETED • RESOLVING DUEL
            </span>

            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.7)]">
              {isSpectating
                ? finalWinner === 'player'
                  ? `${fighter1Name?.toUpperCase() || 'FIGHTER 1'} WINS DUEL`
                  : finalWinner === 'computer'
                  ? `${fighter2Name?.toUpperCase() || 'FIGHTER 2'} WINS DUEL`
                  : 'TIED DUEL'
                : finalWinner === 'player'
                ? 'VICTORY'
                : finalWinner === 'computer'
                ? 'DEFEAT'
                : 'TIED DUEL'}
            </h2>

            <div className="flex items-center gap-6 sm:gap-10 my-2">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold uppercase text-cyan-400">
                  {fighter1Name?.toUpperCase() || 'FIGHTER 1'}
                </span>
                <span className="text-3xl sm:text-5xl font-mono font-black text-cyan-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.9)]">
                  {playerScore}
                </span>
              </div>
              <span className="text-2xl sm:text-4xl font-black text-neutral-600">VS</span>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold uppercase text-red-400">
                  {fighter2Name?.toUpperCase() || 'FIGHTER 2'}
                </span>
                <span className="text-3xl sm:text-5xl font-mono font-black text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]">
                  {computerScore}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-yellow-300 font-bold uppercase tracking-wider">
              {finalWinner === 'player'
                ? `${fighter1Name?.toUpperCase() || 'YOU'} WON THE SWIPING DUEL! APPLYING CARD ATTACK & DEFENSE...`
                : finalWinner === 'computer'
                ? `${fighter2Name?.toUpperCase() || 'OPPONENT'} WON THE SWIPING DUEL! PREPARE FOR IMPACT...`
                : 'TIED SWIPING SCORES! CARDS CLASH IN STALEMATE!'}
            </p>

            <span className="text-[10px] text-neutral-400 animate-pulse mt-2">
              Applying card attack and defense damage...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
