
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Swords, 
  Trophy, 
  User, 
  ScrollText, 
  ChevronRight, 
  Sparkles,
  Camera,
  Upload,
  FolderOpen,
  Eye,
  Flame,
  Shield,
  Maximize2,
  Minimize2,
  Dices,
  Check,
  X,
  Volume2,
  VolumeX,
  Flag,
  LogOut,
  FastForward,
  Edit3,
  ArrowLeft,
  Crown,
  Layers,
  RefreshCw,
  Settings,
  Wifi,
  Bluetooth,
  Sword,
  Pause
} from 'lucide-react';
import { GameState, Card, Element, CardType, Particle, PlayerStats, Rarity, CardSleeve, DeckBoxSkin } from './types';
import { ASSETS, INITIAL_DECK, ELEMENT_ADVANTAGE, ELEMENT_ICONS, CARD_IMAGES, ELEMENTAL_BACKDROPS, VFX, SOUNDS } from './constants';
import { geminiService } from './services/gemini';
import { ParticleCanvas } from './src/components/ParticleCanvas';
import { DeckRingCarousel } from './src/components/DeckRingCarousel';
import { DeckBoxArchive, DEFAULT_DECK_BOX_SKINS, getOpponentDeckBoxSkin } from './src/components/DeckBoxArchive';
import { BattleSwipeArena, PreDuelResult } from './src/components/BattleSwipeArena';
import { Card3DViewerModal } from './src/components/Card3DViewerModal';
import { OpeningDeckDraw } from './src/components/OpeningDeckDraw';
import { DuelOpeningClash } from './src/components/DuelOpeningClash';
import { BattleDeckBoxClashIntro } from './src/components/BattleDeckBoxClashIntro';
import { ArenaDeckDeployAndDraw } from './src/components/ArenaDeckDeployAndDraw';
import { BattleHandCarousel } from './src/components/BattleHandCarousel';
import { ForgedCardReveal } from './src/components/ForgedCardReveal';
import { ArenaTournament } from './src/components/ArenaTournament';
import { GameOptionsModal } from './src/components/GameOptionsModal';
import { PurchaseRunesModal } from './src/components/PurchaseRunesModal';
import { MultiplayerModal } from './src/components/MultiplayerModal';
import { ModeSelectionModal, ModeSelectionType, BattleChoice } from './src/components/ModeSelectionModal';
import { MultiplayerMode, ConnectionType } from './src/types/multiplayer';
import { multiplayerService } from './src/services/multiplayerService';
import { clearTemporaryMatchImages } from './src/utils/cardSync';
import { compositeCardImage, compositeCardSleeve } from './src/utils/cardCompositor';
import { RARITY_CONFIGS, rollForgeRarityAndStats, getRandomHeroStatus } from './src/utils/rarity';
import { getStorageItem, setStorageItem, getStorageItemSync } from './src/utils/storage';
import { 
  TournamentState, 
  TournamentMatch, 
  TournamentFighter,
  createInitialTournament, 
  advanceTournamentMatch, 
  simulateAiMatch, 
  getRandomAiName 
} from './src/utils/aiNames';

type Screen = 'loading' | 'menu' | 'playing' | 'deckBuilder' | 'stats' | 'cardForge' | 'deckEditor' | 'profile' | 'tournament';

const CLASH_BG_OPTIONS = Object.values(ELEMENTAL_BACKDROPS);
const FORGE_COST = 25;
const DECK_SIZE = 20;

const DEFAULT_PLAYER_PROFILE = CARD_IMAGES.FIRE_HERO;
const DEFAULT_OPPONENT_PROFILE = CARD_IMAGES.ICE_HERO;

const DEFAULT_CARD_SLEEVE: CardSleeve = {
  id: 'default',
  name: 'Primal Relic',
  image: ASSETS.CARD_TEMPLATE,
  element: Element.EARTH,
  rarity: Rarity.COMMON,
  createdAt: 0,
  isCustom: false,
};

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('battle_swipes_muted') === 'true';
    } catch {
      return false;
    }
  });
  const [gameVolume, setGameVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('battle_swipes_volume');
      return saved !== null ? Math.max(0, Math.min(100, Number(saved))) : 80;
    } catch {
      return 80;
    }
  });
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isPurchaseRunesOpen, setIsPurchaseRunesOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  
  // Custom Cards Management & Elemental Forge
  const [forgeMode, setForgeMode] = useState<'card' | 'sleeve'>('card');
  const [customCards, setCustomCards] = useState<Card[]>(() => 
    getStorageItemSync<Card[]>('battle_swipes_custom_cards', [])
  );
  const [cardSleeves, setCardSleeves] = useState<CardSleeve[]>(() => 
    getStorageItemSync<CardSleeve[]>('battle_swipes_card_sleeves', [])
  );
  const [activeSleeveId, setActiveSleeveId] = useState<string>(() => 
    getStorageItemSync<string>('battle_swipes_active_sleeve', 'default')
  );
  const [isForging, setIsForging] = useState(false);
  const [forgeResult, setForgeResult] = useState<Card | null>(null);
  const [forgeSleeveResult, setForgeSleeveResult] = useState<CardSleeve | null>(null);
  const [forgeTheme, setForgeTheme] = useState('');
  const [selectedForgeElement, setSelectedForgeElement] = useState<Element | 'RANDOM'>('RANDOM');
  const [selectedForgeWeapon, setSelectedForgeWeapon] = useState<CardType | 'RANDOM'>('RANDOM');
  const [forgePhoto, setForgePhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [sleeveFraming, setSleeveFraming] = useState<'cover' | 'fit'>('cover');
  const [cardFraming, setCardFraming] = useState<'cover' | 'fit'>('cover');

  // Active sleeve resolution for all card backs
  const activeSleeve: CardSleeve = useMemo(() => {
    if (activeSleeveId === 'default') return DEFAULT_CARD_SLEEVE;
    return cardSleeves.find(s => s.id === activeSleeveId) || DEFAULT_CARD_SLEEVE;
  }, [activeSleeveId, cardSleeves]);

  const activeSleeveImage = activeSleeve.id === 'default' ? ASSETS.CARD_TEMPLATE : activeSleeve.image;

  // Persist sleeves via IndexedDB storage (prevents QuotaExceededError)
  useEffect(() => {
    setStorageItem('battle_swipes_card_sleeves', cardSleeves).catch(() => {});
  }, [cardSleeves]);

  useEffect(() => {
    setStorageItem('battle_swipes_active_sleeve', activeSleeveId).catch(() => {});
  }, [activeSleeveId]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const altarRef = useRef<HTMLDivElement | null>(null);
  const forgeScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Profile, Duelist Name, Photo & Combined Forge/Archive Tabs
  const [profileTab, setProfileTab] = useState<'forge' | 'deckArchive'>('forge');
  const [playerName, setPlayerName] = useState<string>(() => 
    getStorageItemSync<string>('battle_swipes_player_name', '') || 'Duelist'
  );
  const [isEditingPlayerName, setIsEditingPlayerName] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState('');

  const [playerProfileImage, setPlayerProfileImage] = useState<string>(() => 
    getStorageItemSync<string>('battle_swipes_player_profile', '') || DEFAULT_PLAYER_PROFILE
  );
  const [isOpeningClashActive, setIsOpeningClashActive] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Arena Tournament State
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [activeTournamentMatch, setActiveTournamentMatch] = useState<TournamentMatch | null>(null);
  const [isSpectatingTournamentAi, setIsSpectatingTournamentAi] = useState(false);
  const [spectatorViewingFighter, setSpectatorViewingFighter] = useState<'fighter1' | 'fighter2'>('fighter1');
  const [viewedVsClashMatchIds, setViewedVsClashMatchIds] = useState<string[]>([]);
  const ongoingTournamentMatchesRef = useRef<Record<string, {
    gameState: GameState;
    displayPlayerHP: number;
    displayComputerHP: number;
  }>>({});

  // Multi-Deck management
  const [allDecks, setAllDecks] = useState<Card[][]>([[], [], []]);
  const [equippedDeckIndex, setEquippedDeckIndex] = useState<number>(0);
  const [editingVaultIndex, setEditingVaultIndex] = useState<number>(0);
  const [tempEditingDeck, setTempEditingDeck] = useState<Card[]>([]);
  const [filterElement, setFilterElement] = useState<Element | 'ALL'>('ALL');
  const [editorMobileTab, setEditorMobileTab] = useState<'collection' | 'deck'>('collection');

  // Persistent Stats & Currency
  const [stats, setStats] = useState<PlayerStats>({
    totalWins: 0,
    totalLosses: 0,
    farthestLevel: 1,
    runes: 100 
  });
  
  // Audio references
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    playerHP: 100,
    computerHP: 100,
    playerHand: [],
    computerHand: [],
    playerDrawPile: [],
    computerDrawPile: [],
    turn: 'player',
    battleLog: ["Duel initialized."],
    isGameOver: false,
    level: 1,
    currentClashBg: CLASH_BG_OPTIONS[0],
    currentOpponentName: 'Ren',
    currentOpponentAvatar: DEFAULT_OPPONENT_PROFILE,
  });

  const [displayPlayerHP, setDisplayPlayerHP] = useState(100);
  const [displayComputerHP, setDisplayComputerHP] = useState(100);

  const [isClashing, setIsClashing] = useState(false);
  const [clashStage, setClashStage] = useState<'flash' | 'intro' | 'vs-fade' | 'swipe-battle' | 'ascent' | 'impact' | 'falloff' | 'outro' | 'none'>('none');
  const [clashWinner, setClashWinner] = useState<'player' | 'computer' | 'tie' | 'none'>('none');
  const [activeDamageDisplay, setActiveDamageDisplay] = useState<{ pDmg: number; cDmg: number } | null>(null);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const swipeBattleResolverRef = useRef<((result: { playerScore: number; computerScore: number; winner: 'player' | 'computer' | 'tie' }) => void) | null>(null);
  
  // Battle Card Selection & Fling State
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [flungCard, setFlungCard] = useState<Card | null>(null);
  const [flingRect, setFlingRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const cardElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const isTurnProcessingRef = useRef(false);

  // 3D Card Inspector Modal state
  const [active3DCard, setActive3DCard] = useState<Card | null>(null);
  const lastCardTapRef = useRef<{ id: string; time: number } | null>(null);

  // Cinematic 3D Deck Box VS Clash Intro
  const [isBattleIntroActive, setIsBattleIntroActive] = useState(false);
  const [deckBoxSkins, setDeckBoxSkins] = useState<DeckBoxSkin[]>(DEFAULT_DECK_BOX_SKINS);

  // Sync saved deck box skins
  useEffect(() => {
    getStorageItem<DeckBoxSkin[]>('battle_swipes_deck_boxes', DEFAULT_DECK_BOX_SKINS)
      .then((saved) => {
        if (Array.isArray(saved) && saved.length === 3) {
          setDeckBoxSkins(saved);
        }
      })
      .catch(() => {});
  }, [currentScreen]);

  // Opening Hand Deck Flick & Draw Phase
  const [isDrawingOpeningHand, setIsDrawingOpeningHand] = useState(false);
  const [autoDrawOpeningHand, setAutoDrawOpeningHand] = useState<boolean>(() => {
    try {
      return localStorage.getItem('battle_swipes_auto_draw') === 'true';
    } catch {
      return false;
    }
  });

  // Multiplayer Connection & Mode Selection States
  const [isModeSelectionOpen, setIsModeSelectionOpen] = useState(false);
  const [modeSelectionType, setModeSelectionType] = useState<ModeSelectionType>('arena');
  const [isMultiplayerModalOpen, setIsMultiplayerModalOpen] = useState(false);
  const [multiplayerModalMode, setMultiplayerModalMode] = useState<MultiplayerMode>('arena');
  const [multiplayerModalConnType, setMultiplayerModalConnType] = useState<ConnectionType>('wifi');
  const [isMultiplayerActive, setIsMultiplayerActive] = useState(false);
  const [isMultiplayerPaused, setIsMultiplayerPaused] = useState(false);
  const [multiplayerPauseReason, setMultiplayerPauseReason] = useState('');
  const [currentPreDuelResult, setCurrentPreDuelResult] = useState<PreDuelResult | null>(null);
  const [multiplayerRemoteScore, setMultiplayerRemoteScore] = useState<number | undefined>(undefined);
  const opponentIncomingCardRef = useRef<Card | null>(null);
  const mySelectedMultiplayerCardRef = useRef<Card | null>(null);
  const [isWaitingForOpponentCard, setIsWaitingForOpponentCard] = useState(false);
  const [opponentHasSelectedCard, setOpponentHasSelectedCard] = useState(false);

  // Auto-open multiplayer modal if URL contains ?joinRoom=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const joinRoomCode = params.get('joinRoom');
      if (joinRoomCode) {
        setMultiplayerModalMode('arena');
        setMultiplayerModalConnType('wifi');
        setIsMultiplayerModalOpen(true);
      }
    }
  }, []);

  const handleModeSelect = (choice: BattleChoice) => {
    setIsModeSelectionOpen(false);
    playSound(SOUNDS.CARD_SWIPE);

    if (modeSelectionType === 'arena') {
      if (choice === 'single') {
        setIsMultiplayerActive(false);
        setActiveTournamentMatch(null); 
        setIsSpectatingTournamentAi(false); 
        resetGame(); 
        setCurrentScreen('playing'); 
      } else if (choice === 'wifi') {
        setMultiplayerModalMode('arena');
        setMultiplayerModalConnType('wifi');
        setIsMultiplayerModalOpen(true);
      } else if (choice === 'bluetooth') {
        setMultiplayerModalMode('arena');
        setMultiplayerModalConnType('bluetooth');
        setIsMultiplayerModalOpen(true);
      }
    } else {
      // tournament
      if (choice === 'single') {
        setIsMultiplayerActive(false);
        if (!tournamentState) {
          const tourney = createInitialTournament(playerName, playerProfileImage || DEFAULT_PLAYER_PROFILE);
          setTournamentState(tourney);
        }
        setCurrentScreen('tournament');
      } else if (choice === 'wifi') {
        setMultiplayerModalMode('tournament');
        setMultiplayerModalConnType('wifi');
        setIsMultiplayerModalOpen(true);
      } else if (choice === 'bluetooth') {
        setMultiplayerModalMode('tournament');
        setMultiplayerModalConnType('bluetooth');
        setIsMultiplayerModalOpen(true);
      }
    }
  };

  const render3DViewerModal = () => (
    <Card3DViewerModal
      card={active3DCard}
      onClose={() => setActive3DCard(null)}
      playSound={playSound}
      activeSleeveImage={activeSleeveImage}
    />
  );

  // Smooth HP interpolation
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayPlayerHP(prev => {
        const diff = gameState.playerHP - prev;
        if (Math.abs(diff) < 0.1) return gameState.playerHP;
        return prev + diff * 0.1;
      });
      setDisplayComputerHP(prev => {
        const diff = gameState.computerHP - prev;
        if (Math.abs(diff) < 0.1) return gameState.computerHP;
        return prev + diff * 0.1;
      });
    }, 16);
    return () => clearInterval(timer);
  }, [gameState.playerHP, gameState.computerHP]);

  const currentEnvElement = useMemo(() => {
    if (gameState.currentClashBg === ELEMENTAL_BACKDROPS.FIRE) return Element.FIRE;
    if (gameState.currentClashBg === ELEMENTAL_BACKDROPS.ICE) return Element.ICE;
    if (gameState.currentClashBg === ELEMENTAL_BACKDROPS.WIND) return Element.WIND;
    if (gameState.currentClashBg === ELEMENTAL_BACKDROPS.EARTH) return Element.EARTH;
    return null;
  }, [gameState.currentClashBg]);

  const availableLibrary = useMemo(() => {
    return [...INITIAL_DECK, ...customCards];
  }, [customCards]);

  const filteredLibrary = useMemo(() => {
    if (filterElement === 'ALL') return availableLibrary;
    return availableLibrary.filter(c => c.element === filterElement);
  }, [availableLibrary, filterElement]);

  // Persistence Load (prioritizing IndexedDB with transparent localStorage fallback & migration)
  useEffect(() => {
    getStorageItem<PlayerStats>('battle_swipes_stats', stats).then(savedStats => {
      if (savedStats) setStats(prev => ({ ...prev, ...savedStats }));
    }).catch(() => {});

    getStorageItem<Card[][]>('battle_swipes_decks', allDecks).then(savedDecks => {
      if (Array.isArray(savedDecks) && savedDecks.length === 3) setAllDecks(savedDecks);
    }).catch(() => {});

    getStorageItem<Card[]>('battle_swipes_custom_cards', []).then(savedCustom => {
      if (Array.isArray(savedCustom) && savedCustom.length > 0) setCustomCards(savedCustom);
    }).catch(() => {});

    getStorageItem<CardSleeve[]>('battle_swipes_card_sleeves', []).then(savedSleeves => {
      if (Array.isArray(savedSleeves) && savedSleeves.length > 0) setCardSleeves(savedSleeves);
    }).catch(() => {});

    getStorageItem<string>('battle_swipes_active_sleeve', 'default').then(savedSleeveId => {
      if (savedSleeveId) setActiveSleeveId(savedSleeveId);
    }).catch(() => {});

    getStorageItem<string>('battle_swipes_player_profile', DEFAULT_PLAYER_PROFILE).then(savedProfile => {
      if (savedProfile) setPlayerProfileImage(savedProfile);
    }).catch(() => {});

    getStorageItem<string>('battle_swipes_player_name', 'Duelist').then(savedName => {
      if (savedName) setPlayerName(savedName);
    }).catch(() => {});

    getStorageItem<TournamentState | null>('battle_swipes_tournament', null).then(savedTourney => {
      if (savedTourney) setTournamentState(savedTourney);
    }).catch(() => {});
  }, []);

  // Save Persistence (stores safely in IndexedDB and handles quota limits cleanly)
  useEffect(() => {
    setStorageItem('battle_swipes_player_name', playerName).catch(() => {});
  }, [playerName]);

  useEffect(() => {
    if (tournamentState) {
      setStorageItem('battle_swipes_tournament', tournamentState).catch(() => {});
    }
  }, [tournamentState]);

  useEffect(() => {
    setStorageItem('battle_swipes_stats', stats).catch(() => {});
  }, [stats]);

  useEffect(() => {
    setStorageItem('battle_swipes_decks', allDecks).catch(() => {});
  }, [allDecks]);

  useEffect(() => {
    setStorageItem('battle_swipes_custom_cards', customCards).catch(() => {});
  }, [customCards]);

  useEffect(() => {
    if (playerProfileImage) {
      setStorageItem('battle_swipes_player_profile', playerProfileImage).catch(() => {});
    }
  }, [playerProfileImage]);

  const handleUpdatePlayerName = (newName: string) => {
    const trimmed = newName.slice(0, 20);
    setPlayerName(trimmed);
    if (tournamentState) {
      const displayName = trimmed.trim() || 'Duelist';
      setTournamentState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          matches: prev.matches.map(m => ({
            ...m,
            fighter1: m.fighter1.isPlayer ? { ...m.fighter1, name: displayName } : m.fighter1,
            fighter2: m.fighter2.isPlayer ? { ...m.fighter2, name: displayName } : m.fighter2,
            winner: m.winner && m.winner.isPlayer ? { ...m.winner, name: displayName } : m.winner,
          })),
          champion: prev.champion && prev.champion.isPlayer ? { ...prev.champion, name: displayName } : prev.champion,
        };
      });
    }
  };

  const handleProfilePhotoUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 400, 400);
          const croppedUrl = canvas.toDataURL('image/jpeg', 0.88);
          setPlayerProfileImage(croppedUrl);
          if (tournamentState) {
            setTournamentState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                matches: prev.matches.map(m => ({
                  ...m,
                  fighter1: m.fighter1.isPlayer ? { ...m.fighter1, avatar: croppedUrl } : m.fighter1,
                  fighter2: m.fighter2.isPlayer ? { ...m.fighter2, avatar: croppedUrl } : m.fighter2,
                  winner: m.winner && m.winner.isPlayer ? { ...m.winner, avatar: croppedUrl } : m.winner,
                })),
                champion: prev.champion && prev.champion.isPlayer ? { ...prev.champion, avatar: croppedUrl } : prev.champion,
              };
            });
          }
          playSound(SOUNDS.GAME_WIN);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem('battle_swipes_muted', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setGameVolume(clamped);
    try {
      localStorage.setItem('battle_swipes_volume', String(clamped));
    } catch {}
    if (bgMusicRef.current) {
      bgMusicRef.current.volume = Math.max(0, Math.min(1, (clamped / 100) * 0.4));
    }
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) audio.volume = Math.max(0, Math.min(1, clamped / 100));
    });
  }, []);

  const handleToggleAutoDraw = useCallback((enabled: boolean) => {
    setAutoDrawOpeningHand(enabled);
    try {
      localStorage.setItem('battle_swipes_auto_draw', String(enabled));
    } catch {}
  }, []);

  const lastPlayedSoundTimesRef = useRef<Record<string, number>>({});

  // Pre-cache all game audio assets immediately for instant, zero-latency playback
  useEffect(() => {
    Object.values(SOUNDS).forEach((url) => {
      if (!url) return;
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        audio.load();
        audioRefs.current[url] = audio;
      } catch (e) {
        // Safe preload suppression
      }
    });
  }, []);

  const playSound = useCallback((soundUrl: string) => {
    if (isMuted || !soundUrl) return;
    try {
      const now = performance.now();
      const lastTime = lastPlayedSoundTimesRef.current[soundUrl] || 0;

      // Ultra-responsive 35ms debounce per sound URL to prevent distortion while ensuring crisp, instantaneous response
      if (now - lastTime < 35) {
        return;
      }

      lastPlayedSoundTimesRef.current[soundUrl] = now;

      const baseVol = Math.max(0, Math.min(1, gameVolume / 100));

      let soundScale = 1.0;
      if (soundUrl === SOUNDS.VS_CLASH_EXPLOSION) {
        soundScale = 0.90; // Impactful, punchy clash explosion sound when player portraits/cards collide
      } else if (soundUrl === SOUNDS.TIE_CLASH) {
        soundScale = 0.55;
      } else if (soundUrl === SOUNDS.WOOSHING) {
        soundScale = 0.65; // Smooth, cinematic whooshing for sliding deck boxes and cards emerging
      } else if (
        soundUrl === SOUNDS.EARTH_SLICE ||
        soundUrl === SOUNDS.FIRE_SLICE ||
        soundUrl === SOUNDS.ICE_SLICE ||
        soundUrl === SOUNDS.WIND_SLICE
      ) {
        soundScale = 0.32; // Gentle, crisp, non-annoying elemental slice audio
      } else if (soundUrl === SOUNDS.CARD_DRAW) {
        soundScale = 0.65; // Satisfying fluid card draw sound
      } else if (soundUrl === SOUNDS.CARD_SHUFFLE) {
        soundScale = 1.0; // Loud, clear authentic card shuffling sound
      } else if (
        soundUrl === SOUNDS.SHIELD_BLOCK ||
        soundUrl === SOUNDS.EARTH_EXPLOSION ||
        soundUrl === SOUNDS.FIRE_EXPLOSION ||
        soundUrl === SOUNDS.ICE_EXPLOSION ||
        soundUrl === SOUNDS.WIND_EXPLOSION
      ) {
        soundScale = 0.40;
      } else if (soundUrl === SOUNDS.CARD_SWIPE || soundUrl === SOUNDS.SWIPE) {
        soundScale = 0.38; // Soft, subtle tactile card glide
      } else if (soundUrl === SOUNDS.CARD_SPAWN) {
        soundScale = 0.48; // Crisp card creation sound in Card Forge
      } else if (soundUrl === SOUNDS.MENU_POP) {
        soundScale = 0.45; // Crisp, responsive menu navigation pop
      } else if (soundUrl === SOUNDS.CHIME) {
        soundScale = 0.46; // Rewarding chime for combos and streaks
      }

      let vol = Math.max(0, Math.min(1, baseVol * soundScale));
      if (soundUrl === SOUNDS.CARD_SHUFFLE) {
        vol = 1.0; // Guarantee card shuffle audio is loud and distinct
      }
      const cached = audioRefs.current[soundUrl];

      if (cached) {
        const voice = cached.cloneNode(true) as HTMLAudioElement;
        voice.volume = vol;
        voice.play().catch(() => {
          cached.currentTime = 0;
          cached.volume = vol;
          cached.play().catch(() => {});
        });
      } else {
        const newAudio = new Audio(soundUrl);
        newAudio.volume = vol;
        audioRefs.current[soundUrl] = newAudio;
        newAudio.play().catch(() => {});
      }
    } catch (e) {
      // Audio playback safely suppressed
    }
  }, [isMuted, gameVolume]);

  const startBackgroundMusic = useCallback(() => {
    try {
      const musicVol = Math.max(0, Math.min(1, (gameVolume / 100) * 0.4));
      if (!bgMusicRef.current) {
        bgMusicRef.current = new Audio(SOUNDS.BATTLE_MUSIC);
        bgMusicRef.current.loop = true;
        bgMusicRef.current.volume = musicVol;
      } else {
        bgMusicRef.current.volume = musicVol;
      }
      if (isMuted) bgMusicRef.current.pause();
      else if (bgMusicRef.current.paused) {
        bgMusicRef.current.play().catch(() => {});
      }
    } catch (e) {
      // Audio autoplay safely suppressed
    }
  }, [isMuted, gameVolume]);

  const stopBackgroundMusic = useCallback(() => {
    try {
      if (bgMusicRef.current) bgMusicRef.current.pause();
    } catch (e) {
      // Safely ignore
    }
  }, []);

  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) {
        bgMusicRef.current.pause();
      } else if (currentScreen === 'playing' && !gameState.isGameOver) {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }, [isMuted, currentScreen, gameState.isGameOver]);

  useEffect(() => {
    if (currentScreen === 'playing' && !gameState.isGameOver) startBackgroundMusic();
    else if (currentScreen !== 'playing') stopBackgroundMusic();
  }, [currentScreen, gameState.isGameOver, startBackgroundMusic, stopBackgroundMusic]);

  // Ensure Chronicle tab is closed whenever quitting a match or leaving the battle arena
  useEffect(() => {
    if (currentScreen !== 'playing') {
      setIsLogOpen(false);
    }
  }, [currentScreen]);

  const resetGame = useCallback((
    isNextLevel: boolean = false, 
    customOpponentName?: string, 
    customOpponentAvatar?: string, 
    isSpectating: boolean = false,
    customOpponentDeck?: Card[],
    customPlayerDeck?: Card[]
  ) => {
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const equippedDeck = allDecks[equippedDeckIndex] || [];
    
    // If a custom player deck is provided (e.g., AI vs AI tournament spectating Fighter 1), use it!
    const playerDeckSource: Card[] = customPlayerDeck && customPlayerDeck.length >= DECK_SIZE
      ? customPlayerDeck.slice(0, DECK_SIZE).map(c => ({...c, id: `p-${Math.random()}`}))
      : (equippedDeck.length >= DECK_SIZE 
          ? equippedDeck.slice(0, DECK_SIZE).map(c => ({...c, id: `p-${Math.random()}`})) 
          : Array.from({ length: DECK_SIZE }, () => ({
              ...availableLibrary[Math.floor(Math.random() * availableLibrary.length)],
              id: `p-rand-${Math.random()}`
            })));

    // If a custom opponent deck is provided (e.g., unique AI tournament deck or synced multiplayer deck), use it!
    const computerDeck: Card[] = customOpponentDeck && customOpponentDeck.length > 0
      ? Array.from({ length: DECK_SIZE }, (_, i) => ({
          ...customOpponentDeck[i % customOpponentDeck.length],
          id: `c-${Math.random()}`
        }))
      : Array.from({ length: DECK_SIZE }, () => ({
          ...INITIAL_DECK[Math.floor(Math.random() * INITIAL_DECK.length)],
          id: `c-${Math.random()}`
        }));

    const shuffledPlayer = shuffle(playerDeckSource);
    const shuffledComputer = shuffle(computerDeck);
    
    const opponentName = customOpponentName || getRandomAiName();
    const opponentAvatar = customOpponentAvatar || DEFAULT_OPPONENT_PROFILE;
    const pDuelistName = isSpectating && activeTournamentMatch ? activeTournamentMatch.fighter1.name : (playerName || 'Player');

    setGameState({
      playerHP: 100,
      computerHP: 100,
      playerHand: shuffledPlayer.slice(0, 5),
      computerHand: shuffledComputer.slice(0, 5),
      playerDrawPile: shuffledPlayer.slice(5),
      computerDrawPile: shuffledComputer.slice(5),
      turn: 'player',
      battleLog: [isNextLevel ? `Level ${gameState.level + 1} begins: ${pDuelistName} vs ${opponentName}!` : `Duel begins: ${pDuelistName} vs ${opponentName}!`],
      isGameOver: false,
      level: isNextLevel ? gameState.level + 1 : 1,
      currentClashBg: CLASH_BG_OPTIONS[Math.floor(Math.random() * CLASH_BG_OPTIONS.length)],
      currentOpponentName: opponentName,
      currentOpponentAvatar: opponentAvatar,
    });
    
    setDisplayPlayerHP(100);
    setDisplayComputerHP(100);
    setIsClashing(false);
    setClashStage('none');
    setHighlightedCardId(null);
    setFlungCard(null);
    setFlingRect(null);
    isTurnProcessingRef.current = false;
    mySelectedMultiplayerCardRef.current = null;
    opponentIncomingCardRef.current = null;
    setIsWaitingForOpponentCard(false);
    setOpponentHasSelectedCard(false);
    setIsBattleIntroActive(!isSpectating);
    setIsDrawingOpeningHand(!isSpectating);
    setIsOpeningClashActive(false);
    setIsLogOpen(false);
    startBackgroundMusic();
  }, [allDecks, equippedDeckIndex, availableLibrary, gameState.level, startBackgroundMusic]);

  const finishBattle = useCallback((playerWon: boolean) => {
    if (activeTournamentMatch && tournamentState) {
      const isPlayerF1 = activeTournamentMatch.fighter1.isPlayer;
      const isPlayerF2 = activeTournamentMatch.fighter2.isPlayer;
      const isSpectating = isSpectatingTournamentAi;

      let winner: TournamentFighter;
      if (isSpectating) {
        winner = playerWon ? activeTournamentMatch.fighter1 : activeTournamentMatch.fighter2;
      } else {
        winner = playerWon 
          ? (isPlayerF1 ? activeTournamentMatch.fighter1 : activeTournamentMatch.fighter2)
          : (isPlayerF1 ? activeTournamentMatch.fighter2 : activeTournamentMatch.fighter1);
      }

      const updated = advanceTournamentMatch(tournamentState, activeTournamentMatch.id, winner);
      setTournamentState(updated);
      if (activeTournamentMatch.id) {
        delete ongoingTournamentMatchesRef.current[activeTournamentMatch.id];
      }

      if (isSpectating) {
        playSound(SOUNDS.TIE_CLASH);
        return;
      }

      if (winner.isPlayer && updated.champion?.isPlayer) {
        setStats(prev => ({
          ...prev,
          totalWins: prev.totalWins + 1,
          runes: prev.runes + 500,
        }));
        playSound(SOUNDS.GAME_WIN);
        return;
      }
    }

    if (isSpectatingTournamentAi) {
      playSound(SOUNDS.TIE_CLASH);
      return;
    }

    if (playerWon) {
      const runeReward = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
      setStats(prev => ({
        ...prev,
        totalWins: prev.totalWins + 1,
        farthestLevel: Math.max(prev.farthestLevel, gameState.level),
        runes: prev.runes + runeReward
      }));
      playSound(SOUNDS.GAME_WIN);
    } else {
      setStats(prev => ({ ...prev, totalLosses: prev.totalLosses + 1 }));
      playSound(SOUNDS.GAME_LOSE);
    }
  }, [gameState.level, playSound, activeTournamentMatch, tournamentState, isSpectatingTournamentAi]);

  // Pre-Battle Card Duel: Elemental Weakness & Weapon Rock-Paper-Scissors
  const calculatePreBattleDuel = (pCard: Card, oCard: Card): PreDuelResult => {
    // 1. Check Elemental Weakness
    const pEl = pCard.element;
    const oEl = oCard.element;
    if (pEl && oEl && pEl !== oEl) {
      if (ELEMENT_ADVANTAGE[pEl] === oEl) {
        return {
          winner: 'player',
          bonusPoints: 40,
          reason: `${pEl} EXPLOITS ${oEl} WEAKNESS (+40 PTS)`,
        };
      }
      if (ELEMENT_ADVANTAGE[oEl] === pEl) {
        return {
          winner: 'computer',
          bonusPoints: 40,
          reason: `${oEl} EXPLOITS ${pEl} WEAKNESS (+40 PTS)`,
        };
      }
    }

    // 2. Check Card / Weapon Archetype (Rock Paper Scissors)
    // SWORD beats AXE, AXE beats SHIELD, SHIELD beats SWORD, HERO trumps weapons
    const pType = pCard.type;
    const oType = oCard.type;

    if (pType === CardType.HERO && oType !== CardType.HERO) {
      return {
        winner: 'player',
        bonusPoints: 40,
        reason: `HEROIC TRIUMPH OVER ${oType} (+40 PTS)`,
      };
    }
    if (oType === CardType.HERO && pType !== CardType.HERO) {
      return {
        winner: 'computer',
        bonusPoints: 40,
        reason: `HEROIC TRIUMPH OVER ${pType} (+40 PTS)`,
      };
    }

    const weaponWins: Record<string, string> = {
      [CardType.SWORD]: CardType.AXE,
      [CardType.AXE]: CardType.SHIELD,
      [CardType.SHIELD]: CardType.SWORD,
    };

    if (weaponWins[pType] === oType) {
      return {
        winner: 'player',
        bonusPoints: 40,
        reason: `${pType} BEATS ${oType} (+40 PTS)`,
      };
    }
    if (weaponWins[oType] === pType) {
      return {
        winner: 'computer',
        bonusPoints: 40,
        reason: `${oType} BEATS ${pType} (+40 PTS)`,
      };
    }

    // 3. Raw Attack stat comparison if identical
    if (pCard.attack > oCard.attack) {
      return {
        winner: 'player',
        bonusPoints: 40,
        reason: `HIGHER ATK POWER (${pCard.attack} vs ${oCard.attack}) (+40 PTS)`,
      };
    }
    if (oCard.attack > pCard.attack) {
      return {
        winner: 'computer',
        bonusPoints: 40,
        reason: `HIGHER ATK POWER (${oCard.attack} vs ${pCard.attack}) (+40 PTS)`,
      };
    }

    return {
      winner: 'tie',
      bonusPoints: 0,
      reason: 'EVEN MATCHUP (EQUAL ADVANTAGE)',
    };
  };

  // Computer AI Card Knowledge: knows how combos, element counters and realm affinities are made!
  const selectSmartAiCard = (
    availableCards: Card[], 
    envElement?: Element | null, 
    opponentCard?: Card
  ): Card => {
    if (!availableCards || availableCards.length === 0) {
      return { ...INITIAL_DECK[0], id: `fallback-${Date.now()}` };
    }
    if (availableCards.length === 1) return availableCards[0];

    // The computer executes combos ~68% of the time
    const shouldExecuteCombo = Math.random() < 0.68;

    if (shouldExecuteCombo) {
      // 1. Elemental Counter Advantage Combo (+50% ATK damage!)
      if (opponentCard && opponentCard.element) {
        const counterCard = availableCards.find(c => ELEMENT_ADVANTAGE[c.element] === opponentCard.element);
        if (counterCard) return counterCard;
      }

      // 2. Realm Affinity Combo (+5 ATK Realm Affinity bonus!)
      if (envElement) {
        const realmCards = availableCards.filter(c => c.element === envElement);
        if (realmCards.length > 0) {
          realmCards.sort((a, b) => b.attack - a.attack);
          return realmCards[0];
        }
      }

      // 3. Hero / High-Tier Attack combo
      const trumpCards = availableCards.filter(c => c.type === CardType.HERO || c.rarity === Rarity.EPIC_RARE);
      if (trumpCards.length > 0 && Math.random() < 0.55) {
        trumpCards.sort((a, b) => b.attack - a.attack);
        return trumpCards[0];
      }
    }

    // Default: prioritize highest attack card among top choices
    const sorted = [...availableCards].sort((a, b) => b.attack - a.attack);
    const topCandidates = sorted.slice(0, Math.min(3, sorted.length));
    return topCandidates[Math.floor(Math.random() * topCandidates.length)] || availableCards[0];
  };

  const playTurn = async (playerCard: Card, customOpponentCard?: Card) => {
    if (!playerCard || gameState.isGameOver) {
      isTurnProcessingRef.current = false;
      return;
    }

    setIsWaitingForOpponentCard(false);
    setOpponentHasSelectedCard(false);

    // Safely select an AI card using smart combo/element intelligence
    let aiCard: Card;
    if (customOpponentCard) {
      aiCard = customOpponentCard;
    } else if (isMultiplayerActive && opponentIncomingCardRef.current) {
      aiCard = opponentIncomingCardRef.current;
      opponentIncomingCardRef.current = null;
    } else {
      const availableComputerCards = (gameState.computerHand && gameState.computerHand.length > 0)
        ? gameState.computerHand 
        : (gameState.computerDrawPile && gameState.computerDrawPile.length > 0 
            ? gameState.computerDrawPile 
            : INITIAL_DECK);

      aiCard = selectSmartAiCard(availableComputerCards, currentEnvElement, playerCard);
    }

    // Evaluate Pre-Battle Card Duel / Elemental Weakness
    const preDuel = calculatePreBattleDuel(playerCard, aiCard);
    setCurrentPreDuelResult(preDuel);
    setMultiplayerRemoteScore(undefined);

    setGameState(prev => ({ ...prev, lastPlayedPlayer: playerCard, lastPlayedComputer: aiCard }));
    setIsClashing(true);
    setClashWinner('none');

    // 1. INTRO: VS logo appears, hero/played cards slide in from left and right
    setClashStage('intro');
    await new Promise(r => setTimeout(r, 650));

    // 2. VS FADE & CARDS LOCK INTO CLASH: Cards stop in place, VS logo fades out
    setClashStage('vs-fade');
    await new Promise(r => setTimeout(r, 600));

    // 3. 10-SECOND ELEMENTAL SWIPE BATTLE
    // Swipe falling enemy elements, chain combos and stylish S-curves & circles!
    setClashStage('swipe-battle');
    const swipeResult = await new Promise<{ playerScore: number; computerScore: number; winner: 'player' | 'computer' | 'tie' }>(resolve => {
      swipeBattleResolverRef.current = resolve;
    });

    // Calculate Damage Using Attack and Defense on both cards:
    // If attack > defense, deals damage to HP.
    // If defense >= attack, HP is unaffected (0 damage).
    let pAtk = playerCard?.attack ?? 10;
    let cAtk = aiCard?.attack ?? 10;
    const pDef = playerCard?.defense ?? 5;
    const cDef = aiCard?.defense ?? 5;

    if (playerCard?.element && aiCard?.element) {
      if (ELEMENT_ADVANTAGE[playerCard.element] === aiCard.element) pAtk = Math.floor(pAtk * 1.5);
      if (ELEMENT_ADVANTAGE[aiCard.element] === playerCard.element) cAtk = Math.floor(cAtk * 1.5);
      if (currentEnvElement === playerCard.element) pAtk += 5;
      if (currentEnvElement === aiCard.element) cAtk += 5;
    }

    let playerDamage = 0;
    let computerDamage = 0;
    let result: { winner: 'player' | 'computer' | 'tie'; pDmg: number; cDmg: number };

    if (swipeResult.winner === 'player') {
      if (pAtk > cDef) {
        computerDamage = pAtk - cDef;
      } else {
        computerDamage = 0; // Defense held! HP unaffected!
      }
      result = { winner: 'player', pDmg: 0, cDmg: computerDamage };
    } else if (swipeResult.winner === 'computer') {
      if (cAtk > pDef) {
        playerDamage = cAtk - pDef;
      } else {
        playerDamage = 0; // Defense held! HP unaffected!
      }
      result = { winner: 'computer', pDmg: playerDamage, cDmg: 0 };
    } else {
      result = { winner: 'tie', pDmg: 0, cDmg: 0 };
    }

    setClashWinner(result.winner as any);
    setActiveDamageDisplay({ pDmg: result.pDmg, cDmg: result.cDmg });
    await new Promise(r => setTimeout(r, 200));

    // 4. ASCENT: Winning/Hero card shoots upward off-screen, spinning with glowing particles!
    setClashStage('ascent');
    playSound(SOUNDS.FIRE_SLICE);
    await new Promise(r => setTimeout(r, 900));

    // 4. IMPACT: Hero card zooms back down theatrically onto losing card with smashing particle explosion!
    setClashStage('impact');
    playSound(SOUNDS.VS_CLASH_EXPLOSION);
    setIsScreenShaking(true);
    setTimeout(() => setIsScreenShaking(false), 550);

    // Apply damage to health immediately on impact
    const nextPlayerHP = Math.max(0, gameState.playerHP - result.pDmg);
    const nextComputerHP = Math.max(0, gameState.computerHP - result.cDmg);

    setGameState(prev => ({
      ...prev,
      playerHP: Math.max(0, prev.playerHP - result.pDmg),
      computerHP: Math.max(0, prev.computerHP - result.cDmg),
    }));

    // Sync HP in multiplayer
    if (isMultiplayerActive) {
      multiplayerService.sendSyncHP(nextPlayerHP, nextComputerHP, gameState.level);
    }

    const winningEl = result.winner === 'player' ? playerCard?.element : result.winner === 'computer' ? aiCard?.element : 'TIE';
    if (winningEl === 'TIE') {
      playSound(SOUNDS.TIE_CLASH);
    } else {
      const sliceMap: Record<Element, string> = {
        [Element.FIRE]: SOUNDS.FIRE_SLICE,
        [Element.ICE]: SOUNDS.ICE_SLICE,
        [Element.WIND]: SOUNDS.WIND_SLICE,
        [Element.EARTH]: SOUNDS.EARTH_SLICE,
      };
      const explosionMap: Record<Element, string> = {
        [Element.FIRE]: SOUNDS.FIRE_EXPLOSION,
        [Element.ICE]: SOUNDS.ICE_EXPLOSION,
        [Element.WIND]: SOUNDS.WIND_EXPLOSION,
        [Element.EARTH]: SOUNDS.EARTH_EXPLOSION,
      };
      playSound(sliceMap[winningEl as Element] || SOUNDS.FIRE_SLICE);
      setTimeout(() => {
        playSound(explosionMap[winningEl as Element] || SOUNDS.FIRE_EXPLOSION);
      }, 200);
    }
    
    // Wait for the elemental impact effect to show ON the card
    await new Promise(r => setTimeout(r, 850));

    // 5. FALLOFF: Trigger falloff stage where losing card tumbles off screen
    setClashStage('falloff');

    // Wait for falloff animation to complete
    await new Promise(r => setTimeout(r, 750));

    let didBattleEnd = false;
    let playerWonGame = false;

    setGameState(prev => {
      const newPlayerHP = prev.playerHP;
      const newComputerHP = prev.computerHP;
      const newPHand = prev.playerHand.filter(c => c && c.id !== playerCard.id);
      const newCHand = prev.computerHand.filter(c => c && c.id !== aiCard.id);
      const updatedPHand = [...newPHand];
      const updatedCHand = [...newCHand];
      const pPile = [...prev.playerDrawPile];
      const cPile = [...prev.computerDrawPile];
      
      if (pPile.length > 0) updatedPHand.push(pPile.shift()!);
      if (cPile.length > 0) updatedCHand.push(cPile.shift()!);
      
      // If either side runs out of cards and reserves, or HP reaches 0, battle ends
      const over = newPlayerHP === 0 || newComputerHP === 0 || updatedPHand.length === 0 || updatedCHand.length === 0;
      let win: any = undefined;
      if (over) {
        win = newPlayerHP > newComputerHP ? 'player' : newComputerHP > newPlayerHP ? 'computer' : 'tie';
        didBattleEnd = true;
        playerWonGame = (win === 'player');
      }

      const pName = isSpectatingTournamentAi && activeTournamentMatch
        ? activeTournamentMatch.fighter1.name
        : (playerName || 'Player');
      const oppName = isSpectatingTournamentAi && activeTournamentMatch
        ? activeTournamentMatch.fighter2.name
        : (prev.currentOpponentName || 'Opponent');

      const pDefenseHeld = swipeResult?.winner === 'computer' && result.pDmg === 0;
      const cDefenseHeld = swipeResult?.winner === 'player' && result.cDmg === 0;

      const battleSwipeLog = (swipeResult?.winner === 'player')
        ? cDefenseHeld
          ? `10s Element Duel: ${pName} WON (${swipeResult?.playerScore ?? 0} pts vs ${swipeResult?.computerScore ?? 0} pts)! ${oppName}'s defense (${cDef} DEF) held against ${pAtk} ATK - 0 HP damage!`
          : `10s Element Duel: ${pName} WON (${swipeResult?.playerScore ?? 0} pts vs ${swipeResult?.computerScore ?? 0} pts)! Broke through defense (${pAtk} ATK vs ${cDef} DEF) dealing ${result.cDmg} HP damage to ${oppName}!`
        : (swipeResult?.winner === 'computer')
        ? pDefenseHeld
          ? `10s Element Duel: ${oppName} WON (${swipeResult?.computerScore ?? 0} pts vs ${swipeResult?.playerScore ?? 0} pts)! ${pName}'s defense (${pDef} DEF) held against ${cAtk} ATK - 0 HP damage!`
          : `10s Element Duel: ${oppName} WON (${swipeResult?.computerScore ?? 0} pts vs ${swipeResult?.playerScore ?? 0} pts)! Broke through defense (${cAtk} ATK vs ${pDef} DEF) inflicting ${result.pDmg} HP damage to ${pName}!`
        : `10s Element Duel: TIED at ${swipeResult?.playerScore ?? 0} pts between ${pName} and ${oppName}! Both cards held strong!`;

      return {
        ...prev,
        playerHand: updatedPHand,
        computerHand: updatedCHand,
        playerDrawPile: pPile,
        computerDrawPile: cPile,
        isGameOver: over,
        winner: win,
        battleLog: [battleSwipeLog, ...prev.battleLog].slice(0, 20)
      };
    });

    if (didBattleEnd) {
      finishBattle(playerWonGame);
    }

    setIsClashing(false);
    setClashStage('none');
    setActiveDamageDisplay(null);
    setHighlightedCardId(null);
    setFlungCard(null);
    setFlingRect(null);
    isTurnProcessingRef.current = false;
  };

  // Auto-play turns when spectating AI vs AI tournament matches
  useEffect(() => {
    if (!isSpectatingTournamentAi || currentScreen !== 'playing' || gameState.isGameOver || isClashing || isDrawingOpeningHand || isOpeningClashActive || isBattleIntroActive) {
      return;
    }

    const timer = setTimeout(() => {
      if (gameState.playerHand.length > 0 && !isTurnProcessingRef.current && !isClashing) {
        // Fighter 1 AI knows how combos and realm affinities are made!
        const smartCard = selectSmartAiCard(gameState.playerHand, currentEnvElement);
        playTurn(smartCard);
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [isSpectatingTournamentAi, currentScreen, gameState.isGameOver, isClashing, isDrawingOpeningHand, isOpeningClashActive, isBattleIntroActive, gameState.playerHand, currentEnvElement]);

  const handleSkipSpectating = () => {
    if (!activeTournamentMatch || !tournamentState) return;
    const winner = simulateAiMatch(activeTournamentMatch.fighter1, activeTournamentMatch.fighter2);
    const updated = advanceTournamentMatch(tournamentState, activeTournamentMatch.id, winner);
    setTournamentState(updated);
    if (activeTournamentMatch.id) {
      delete ongoingTournamentMatchesRef.current[activeTournamentMatch.id];
    }
    setActiveTournamentMatch(null);
    setIsSpectatingTournamentAi(false);
    setSpectatorViewingFighter('fighter1');
    setCurrentScreen('tournament');
    playSound(SOUNDS.TIE_CLASH);
  };

  const handleLeaveSpectating = useCallback(() => {
    if (activeTournamentMatch) {
      // Save ongoing match state so if user comes back to watch, it continues where it left off
      ongoingTournamentMatchesRef.current[activeTournamentMatch.id] = {
        gameState: { ...gameState },
        displayPlayerHP,
        displayComputerHP,
      };
    }
    setActiveTournamentMatch(null);
    setIsSpectatingTournamentAi(false);
    setSpectatorViewingFighter('fighter1');
    setIsOpeningClashActive(false);
    setCurrentScreen('tournament');
    playSound(SOUNDS.CARD_SWIPE);
  }, [activeTournamentMatch, gameState, displayPlayerHP, displayComputerHP, playSound]);

  const handleFlingCard = useCallback((playerCard: Card, customElement?: HTMLElement | null) => {
    if (gameState.isGameOver || isClashing || isTurnProcessingRef.current || !playerCard) return;
    isTurnProcessingRef.current = true;

    // Capture starting bounding box for seamless flight animation into battle area
    const targetEl = customElement || cardElementsRef.current[playerCard.id];
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      setFlingRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
    } else {
      setFlingRect({
        left: window.innerWidth / 2 - 40,
        top: window.innerHeight - 150,
        width: 80,
        height: 110
      });
    }

    setFlungCard(playerCard);
    playSound(SOUNDS.CARD_SWIPE);

    if (isMultiplayerActive) {
      multiplayerService.sendCardPlayed(playerCard.id, gameState.level, playerName || 'Warrior', playerCard);
      // If opponent has ALREADY played their card, we have both! Launch clash!
      if (opponentIncomingCardRef.current) {
        const oppCard = opponentIncomingCardRef.current;
        opponentIncomingCardRef.current = null;
        mySelectedMultiplayerCardRef.current = null;
        setIsWaitingForOpponentCard(false);
        setOpponentHasSelectedCard(false);
        setTimeout(() => {
          playTurn(playerCard, oppCard);
          setFlungCard(null);
          setHighlightedCardId(null);
        }, 420);
      } else {
        // Wait for opponent to select their card
        mySelectedMultiplayerCardRef.current = playerCard;
        setIsWaitingForOpponentCard(true);
        setTimeout(() => {
          setFlungCard(null);
          setHighlightedCardId(null);
        }, 420);
      }
      return;
    }

    // Let the card soar forward and off-screen into the arena, then launch battle clash
    setTimeout(() => {
      playTurn(playerCard);
      setFlungCard(null);
      setHighlightedCardId(null);
    }, 420);
  }, [gameState.isGameOver, isClashing, playSound, isMultiplayerActive, playerName, gameState.level]);

  // Spectator Mode: Pick and play card for Fighter 2
  const handleFlingCardAsOpponent = useCallback((opponentCard: Card, customElement?: HTMLElement | null) => {
    if (gameState.isGameOver || isClashing || isTurnProcessingRef.current || !opponentCard) return;
    isTurnProcessingRef.current = true;

    const targetEl = customElement || cardElementsRef.current[opponentCard.id];
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      setFlingRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
    } else {
      setFlingRect({
        left: window.innerWidth / 2 - 40,
        top: window.innerHeight - 150,
        width: 80,
        height: 110
      });
    }

    setFlungCard(opponentCard);
    playSound(SOUNDS.CARD_SWIPE);

    // Fighter 1 AI intelligently selects card to clash with
    const availableF1Cards = (gameState.playerHand && gameState.playerHand.length > 0)
      ? gameState.playerHand
      : (gameState.playerDrawPile && gameState.playerDrawPile.length > 0 ? gameState.playerDrawPile : [opponentCard]);
    const smartF1Card = selectSmartAiCard(availableF1Cards, currentEnvElement);

    setTimeout(() => {
      playTurn(smartF1Card, opponentCard);
      setFlungCard(null);
      setHighlightedCardId(null);
    }, 420);
  }, [gameState.isGameOver, isClashing, playSound, gameState.playerHand, gameState.playerDrawPile, currentEnvElement]);

  // Multiplayer Match Start Handler
  const handleStartMultiplayerMatch = useCallback((
    opponentDeck: Card[],
    opponentName: string,
    opponentAvatar: string,
    isTournament: boolean
  ) => {
    setIsMultiplayerActive(true);
    setIsMultiplayerPaused(false);
    mySelectedMultiplayerCardRef.current = null;
    opponentIncomingCardRef.current = null;
    setIsWaitingForOpponentCard(false);
    setOpponentHasSelectedCard(false);
    if (isTournament) {
      const tourney = createInitialTournament(playerName, playerProfileImage || DEFAULT_PLAYER_PROFILE);
      if (tourney.matches && tourney.matches[0]) {
        tourney.matches[0].fighter2 = {
          id: 'mp-challenger-2',
          name: opponentName,
          avatar: opponentAvatar,
          element: opponentDeck[0]?.element || Element.FIRE,
          isPlayer: false,
          title: 'Challenger',
          deck: opponentDeck,
        };
      }
      setTournamentState(tourney);
      setCurrentScreen('tournament');
    } else {
      setActiveTournamentMatch(null);
      setIsSpectatingTournamentAi(false);
      resetGame(false, opponentName, opponentAvatar, false, opponentDeck);
      setCurrentScreen('playing');
    }
    playSound(SOUNDS.CARD_SWIPE);
  }, [playerName, playerProfileImage, playSound, resetGame]);

  // Multiplayer Disconnect, Score & Card Play Listener
  useEffect(() => {
    const unsub = multiplayerService.subscribe((event) => {
      if (event.type === 'opponent_disconnected' || event.type === 'match_paused') {
        if (isMultiplayerActive && (currentScreen === 'playing' || currentScreen === 'tournament')) {
          setIsMultiplayerPaused(true);
          setMultiplayerPauseReason(event.data?.reason || 'Challenger connection dropped');
        }
      } else if (event.type === 'match_resumed') {
        setIsMultiplayerPaused(false);
      } else if (event.type === 'card_played_by_opponent') {
        if (event.data?.card) {
          opponentIncomingCardRef.current = event.data.card;
          setOpponentHasSelectedCard(true);

          // If we already selected our card and were waiting, both cards are now ready! Launch clash!
          if (mySelectedMultiplayerCardRef.current) {
            const myCard = mySelectedMultiplayerCardRef.current;
            const oppCard = event.data.card;
            mySelectedMultiplayerCardRef.current = null;
            opponentIncomingCardRef.current = null;
            setIsWaitingForOpponentCard(false);
            setOpponentHasSelectedCard(false);
            playTurn(myCard, oppCard);
          }
        }
      } else if (event.type === 'swipe_score_received') {
        if (typeof event.data?.score === 'number') {
          setMultiplayerRemoteScore(event.data.score);
        }
      } else if (event.type === 'sync_hp_received') {
        if (typeof event.data?.playerHP === 'number' && typeof event.data?.opponentHP === 'number') {
          // Sender sent: playerHP (sender's HP), opponentHP (recipient's HP)
          // For recipient: recipient's playerHP is opponentHP, computerHP is playerHP!
          setGameState(prev => ({
            ...prev,
            playerHP: event.data.opponentHP,
            computerHP: event.data.playerHP,
          }));
        }
      }
    });

    return () => {
      unsub();
    };
  }, [isMultiplayerActive, currentScreen]);

  // Camera & Photo Handlers for Elemental Forge
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user' = cameraFacing) => {
    stopCamera();
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera with facing constraint failed, attempting default camera...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr: any) {
        console.error("Camera access failed", fallbackErr);
        setCameraError("Camera unavailable or permission denied. Please upload a photo instead.");
      }
    }
  }, [cameraFacing, stopCamera]);

  const flipCamera = useCallback(() => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  }, [cameraFacing, startCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = video.videoWidth || 640;
      snapCanvas.height = video.videoHeight || 480;
      const sCtx = snapCanvas.getContext('2d');
      if (sCtx) {
        if (cameraFacing === 'user') {
          sCtx.translate(snapCanvas.width, 0);
          sCtx.scale(-1, 1);
        }
        sCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
        const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.92);
        setForgePhoto(dataUrl);
        playSound(SOUNDS.CARD_SWIPE);
      }
    } catch (err) {
      console.error("Failed to capture photo frame", err);
    } finally {
      stopCamera();
    }
  }, [cameraFacing, playSound, stopCamera]);

  const handlePhotoFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForgePhoto(reader.result);
        playSound(SOUNDS.CARD_SWIPE);
      }
    };
    reader.readAsDataURL(file);
  };

  // Close camera if leaving the Forge screen
  useEffect(() => {
    if (currentScreen !== 'cardForge' && (currentScreen !== 'profile' || profileTab !== 'forge')) {
      stopCamera();
    }
  }, [currentScreen, profileTab, stopCamera]);

  const handleForge = async () => {
    if (stats.runes < FORGE_COST) return;
    setIsForging(true);
    setForgeResult(null);
    setForgeSleeveResult(null);

    // On mobile screens, smoothly bring the altar/result into view
    setTimeout(() => {
      altarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    // SLEEVE FORGING MODE
    if (forgeMode === 'sleeve') {
      try {
        const allElements = [Element.FIRE, Element.ICE, Element.WIND, Element.EARTH];
        const finalElement: Element = selectedForgeElement === 'RANDOM'
          ? allElements[Math.floor(Math.random() * allElements.length)]
          : selectedForgeElement;

        // Roll rarity
        const rand = Math.random();
        let rolledRarity = Rarity.COMMON;
        if (rand < 0.10) rolledRarity = Rarity.EPIC_RARE;
        else if (rand < 0.30) rolledRarity = Rarity.RARE;
        else if (rand < 0.60) rolledRarity = Rarity.UNCOMMON;

        let finalName = forgeTheme.trim();
        if (!finalName) {
          finalName = `${finalElement} Sleeve`;
        }

        let rawPhoto = forgePhoto;
        if (!rawPhoto) {
          const sleevePrompt = `A mystical and ornate Punk-Rock ${finalElement} TCG card sleeve backing artwork with glowing ${finalElement} runes and dark obsidian stone embellishments, 3:4 portrait ratio.`;
          try {
            rawPhoto = await geminiService.generateCustomCard(sleevePrompt, false);
          } catch (err) {
            console.warn("AI sleeve art fallback", err);
          }
          if (!rawPhoto) {
            rawPhoto = ELEMENTAL_BACKDROPS[finalElement];
          }
        }

        const compositedSleeveImage = await compositeCardSleeve({
          photoSrc: rawPhoto,
          element: finalElement,
          name: finalName,
          rarity: rolledRarity,
          fitMode: sleeveFraming,
        });

        setStats(prev => ({ ...prev, runes: prev.runes - FORGE_COST }));

        const newSleeve: CardSleeve = {
          id: `sleeve-${Date.now()}`,
          name: finalName,
          image: compositedSleeveImage,
          element: finalElement,
          rarity: rolledRarity,
          createdAt: Date.now(),
          isCustom: true,
        };

        setForgeSleeveResult(newSleeve);

        setTimeout(() => {
          altarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);

        playSound(SOUNDS.CARD_SPAWN);
      } catch (e) {
        console.error("Forge sleeve failed", e);
      } finally {
        setIsForging(false);
      }
      return;
    }

    // CARD FORGING MODE
    try {
      // 1. Resolve Element: User choice or chosen at random if user picked 'RANDOM'
      const allElements = [Element.FIRE, Element.ICE, Element.WIND, Element.EARTH];
      const finalElement: Element = selectedForgeElement === 'RANDOM'
        ? allElements[Math.floor(Math.random() * allElements.length)]
        : selectedForgeElement;

      // 2. Resolve Chosen Weapon & Rare Hero Draw
      // Available weapons in the game: SWORD, AXE, SHIELD (not Hero - Hero is a rare random draw)
      const nonHeroTypes = [CardType.SWORD, CardType.AXE, CardType.SHIELD];
      const chosenWeapon: CardType = selectedForgeWeapon === 'RANDOM'
        ? nonHeroTypes[Math.floor(Math.random() * nonHeroTypes.length)]
        : selectedForgeWeapon;

      // Hero champion is a rare random draw (~18% chance)
      const isHero = Math.random() < 0.18;
      const finalType: CardType = isHero ? CardType.HERO : chosenWeapon;
      const heroStatus = isHero ? getRandomHeroStatus(finalElement) : undefined;

      // 3. Resolve Rarity and Stats based on weapon archetype:
      // If hero: weapon archetype is preserved, element kept, and granted higher stats!
      const { rarity: rolledRarity, attack: atk, defense: def } = rollForgeRarityAndStats(finalType, isHero, chosenWeapon);
      const rConfig = RARITY_CONFIGS[rolledRarity];

      // 4. Resolve Card Name
      let finalName = forgeTheme.trim();
      if (!finalName) {
        try {
          finalName = await geminiService.generateCardName(finalElement, isHero ? CardType.HERO : chosenWeapon, "");
        } catch {
          finalName = isHero 
            ? `${finalElement} ${heroStatus || 'Hero'} ${chosenWeapon === CardType.AXE ? 'Axe' : chosenWeapon === CardType.SHIELD ? 'Shield' : 'Blade'}`
            : `${finalElement} ${chosenWeapon}`;
        }
      }
      if (!finalName || finalName === "Mystic Card" || finalName === "Untitled Legend") {
        finalName = isHero 
          ? `${heroStatus || 'Heroic'} ${chosenWeapon === CardType.AXE ? 'Axe' : chosenWeapon === CardType.SHIELD ? 'Shield' : 'Blade'}`
          : `${finalElement} ${chosenWeapon}`;
      }

      // 5. Card Image: Use photo (from upload/camera snap) sized to fit with card backing and front frames
      let rawPhoto = forgePhoto;
      if (!rawPhoto) {
        // Fallback: If user forged without providing a photo, generate custom card art or elemental backdrop
        const finalDescription = isHero 
          ? `A 3:4 portrait aspect ratio digital card face of a Punk-Rock ${finalElement} Hero champion named "${finalName}" wielding an exalted ${chosenWeapon.toLowerCase()}. Human-shaped head with a tight-fitted burlap mask (Deadpool style), big anime eyes, and a mouth made of multiple 'X' stitches forming a smile.`
          : `A 3:4 portrait aspect ratio digital card face of a powerful Punk-Rock ${finalElement} ${chosenWeapon} weapon named "${finalName}". Flat 2D art, NO characters.`;
        
        try {
          rawPhoto = await geminiService.generateCustomCard(finalDescription, isHero);
        } catch (err) {
          console.warn("AI generation fallback", err);
        }
        if (!rawPhoto) {
          rawPhoto = ELEMENTAL_BACKDROPS[finalElement];
        }
      }

      // Sizing the image with card backing and front frames to fit perfectly, applying rarity border color
      const compositedCardImage = await compositeCardImage({
        photoSrc: rawPhoto,
        element: finalElement,
        type: finalType,
        name: finalName,
        attack: atk,
        defense: def,
        isHero,
        heroStatus,
        baseWeapon: chosenWeapon,
        rarity: rolledRarity,
        fitMode: cardFraming
      });

      setStats(prev => ({ ...prev, runes: prev.runes - FORGE_COST }));

      setForgeResult({
        id: `custom-${Date.now()}`,
        name: finalName,
        element: finalElement,
        type: finalType,
        attack: atk,
        defense: def,
        image: compositedCardImage,
        rarity: rolledRarity,
        isHero,
        heroStatus,
        baseWeapon: chosenWeapon,
        description: isHero 
          ? `HERO AWAKENED: Blessed with ${heroStatus || 'Divine'} status! Higher ${chosenWeapon.toLowerCase()} stats and primal ${finalElement.toLowerCase()} fury.`
          : `${rConfig.name} ${finalElement.toLowerCase()} ${chosenWeapon.toLowerCase()}. ${rConfig.description}.`
      });

      // Smoothly scroll to the framed result so mobile users see the forged card immediately
      setTimeout(() => {
        altarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);

      playSound(SOUNDS.CARD_SPAWN);
    } catch (e) {
      console.error("Forge failed", e);
    } finally {
      setIsForging(false);
    }
  };

  const handleForgeKeep = () => {
    if (forgeResult) {
      setCustomCards(prev => [...prev, forgeResult]);
      setForgeResult(null);
      setForgeTheme('');
      setForgePhoto(null);
      playSound(SOUNDS.CHIME);
    }
  };

  const handleSleeveKeep = (equipImmediately: boolean = false) => {
    if (!forgeSleeveResult) return;
    const sleeveToSave = forgeSleeveResult;
    setCardSleeves(prev => {
      if (prev.some(s => s.id === sleeveToSave.id)) return prev;
      return [sleeveToSave, ...prev];
    });
    playSound(SOUNDS.CHIME);
    if (equipImmediately) {
      setActiveSleeveId(sleeveToSave.id);
    }
    setForgeSleeveResult(null);
    setForgeTheme('');
    setForgePhoto(null);
  };

  const inspectSleeveIn3D = (sleeve: CardSleeve) => {
    const virtualCard: Card = {
      id: sleeve.id,
      name: sleeve.name,
      image: sleeve.image,
      element: sleeve.element,
      type: CardType.SHIELD,
      attack: 0,
      defense: 99,
      rarity: sleeve.rarity,
      description: `Custom ${sleeve.element} Card Sleeve. Crafted in the Elemental Forge.`,
    };
    setActive3DCard(virtualCard);
  };

  const startDeckEditing = (idx: number) => {
    setEditingVaultIndex(idx);
    setTempEditingDeck([...(allDecks[idx] || [])]);
    setCurrentScreen('deckEditor');
  };

  const saveDeck = () => {
    const newAllDecks = [...allDecks];
    newAllDecks[editingVaultIndex] = [...tempEditingDeck];
    setAllDecks(newAllDecks);
    setProfileTab('deckArchive');
    setCurrentScreen('profile');
    playSound(SOUNDS.GAME_WIN);
  };

  const toggleCardInDeck = (card: Card) => {
    const existingIndex = tempEditingDeck.findIndex(c => c.id === card.id);
    if (existingIndex > -1) {
      setTempEditingDeck(prev => prev.filter(c => c.id !== card.id));
      playSound(SOUNDS.CARD_SWIPE);
    } else {
      if (tempEditingDeck.length < DECK_SIZE) {
        setTempEditingDeck(prev => [...prev, card]);
        playSound(SOUNDS.CARD_SWIPE);
      }
    }
  };

  const renderHPBar = (type: 'player' | 'computer', hp: number, containerWidth: string) => {
    const isPlayer = type === 'player';
    const barImg = isPlayer ? ASSETS.PLAYER_HP_BAR : ASSETS.COMPUTER_HP_BAR;
    const holderImg = isPlayer ? ASSETS.PLAYER_HP_HOLDER : ASSETS.COMPUTER_HP_HOLDER;
    const clampedHp = Math.max(0, Math.min(100, hp));
    const missingHp = 100 - clampedHp;
    
    return (
      <div className={`relative ${containerWidth} h-16 min-[400px]:h-20 sm:h-28 lg:h-36 flex items-center justify-center overflow-visible`}>
        <div 
          className="absolute z-0 w-[80%] h-[75%] top-[12.5%] overflow-hidden transition-all duration-300 ease-out"
          style={{ 
            left: '10%', 
            clipPath: isPlayer 
              ? `inset(0 ${missingHp}% 0 0)` 
              : `inset(0 0 0 ${missingHp}%)` 
          }}
        >
          <img src={barImg} className="w-full h-full object-fill brightness-125 saturate-150" alt="HP Fill" />
        </div>
        <img src={holderImg} className="absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl pointer-events-none" alt="HP Holder" />
      </div>
    );
  };

  useEffect(() => {
    const totalAssets = [...Object.values(ASSETS), ...Object.values(ELEMENT_ICONS), ...Object.values(CARD_IMAGES)].length;
    let count = 0;
    [...Object.values(ASSETS), ...Object.values(ELEMENT_ICONS), ...Object.values(CARD_IMAGES)].forEach(src => {
      const img = new Image();
      img.src = src;
      img.onload = () => { count++; setLoadProgress(Math.floor((count / totalAssets) * 100)); };
      img.onerror = () => { count++; };
    });
    setTimeout(() => setCurrentScreen('menu'), 2000);
  }, []);

  const renderSharedModals = () => (
    <>
      {/* Purchase Runes / Ancient Rune Treasury Modal */}
      <PurchaseRunesModal
        isOpen={isPurchaseRunesOpen}
        onClose={() => setIsPurchaseRunesOpen(false)}
        currentRunes={stats.runes}
        onAddRunes={(amount) => {
          setStats(prev => ({
            ...prev,
            runes: prev.runes + amount,
          }));
        }}
        playSound={playSound}
      />

      {/* Mode Selection Modal for Arena & Tournament */}
      <ModeSelectionModal
        isOpen={isModeSelectionOpen}
        onClose={() => setIsModeSelectionOpen(false)}
        mode={modeSelectionType}
        onSelect={handleModeSelect}
        playSound={playSound}
      />

      {/* Multiplayer Connection & Lobby Modal */}
      <MultiplayerModal
        isOpen={isMultiplayerModalOpen}
        onClose={() => setIsMultiplayerModalOpen(false)}
        mode={multiplayerModalMode}
        initialConnectionType={multiplayerModalConnType}
        playerName={playerName || 'Warrior'}
        playerAvatar={playerProfileImage || DEFAULT_PLAYER_PROFILE}
        equippedDeck={allDecks[equippedDeckIndex] || []}
        runesCount={stats.runes}
        onStartBattle={handleStartMultiplayerMatch}
        playSound={playSound}
      />

      {/* 3D Inspection Modal Overlay */}
      {render3DViewerModal()}
    </>
  );

  if (currentScreen === 'loading') {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center font-cinzel text-white p-4 text-center">
        <img src={ASSETS.VS_LOGO} className="h-28 sm:h-48 mb-6 sm:mb-8 animate-pulse max-w-full" />
        <h1 className="text-xl sm:text-3xl font-black mb-4 sm:mb-6 tracking-widest text-yellow-600 uppercase">Communing with Realms</h1>
        <div className="w-64 sm:w-80 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 transition-all duration-300" style={{ width: `${loadProgress}%` }} />
        </div>
        <p className="mt-3 sm:mt-4 text-xs text-white/40">{loadProgress}% STABILIZED</p>
      </div>
    );
  }

  if (currentScreen === 'menu') {
    return (
      <div className="relative w-full h-[100dvh] max-h-[100dvh] bg-black overflow-y-auto overscroll-y-contain custom-scrollbar flex flex-col items-center justify-between p-3 sm:p-6 py-4 sm:py-8 select-none">
        <div className="fixed inset-0 bg-cover bg-center animate-bg-sway opacity-60 pointer-events-none" style={{ backgroundImage: `url(${ASSETS.TITLE_BG})` }} />
        {/* Top Header Bar: Warrior Profile Thumbnail (Upper Left) & Runes Counter (Upper Right) */}
        <div className="relative w-full max-w-xs sm:max-w-md flex items-center justify-between mb-2 z-20 shrink-0">
          {/* Warrior Profile Thumbnail Button */}
          <button
            onClick={() => {
              setCurrentScreen('profile');
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className="group flex items-center gap-1.5 sm:gap-2 bg-black/75 hover:bg-neutral-950/90 pl-1 pr-2.5 sm:pr-3 py-1 rounded-full border border-yellow-500/40 hover:border-yellow-400 backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer select-none shrink-0"
            title="Open Warrior Profile"
          >
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-yellow-600 via-yellow-400 to-amber-300 shadow-md group-hover:scale-105 transition-transform overflow-hidden shrink-0">
              <img
                src={playerProfileImage || DEFAULT_PLAYER_PROFILE}
                alt="Warrior Profile"
                className="w-full h-full rounded-full object-cover bg-neutral-900"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_PLAYER_PROFILE;
                }}
              />
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-yellow-200 group-hover:text-yellow-100 transition-colors truncate max-w-[75px] sm:max-w-[110px]">
                {playerName || 'Warrior'}
              </span>
              <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-yellow-500/70">
                Profile
              </span>
            </div>
          </button>

          {/* Runes Currency Indicator: Uses the Single Rune Crystal Image + Number (No text 'Runes') */}
          <button
            onClick={() => {
              setIsPurchaseRunesOpen(true);
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className="flex items-center gap-1.5 sm:gap-2 bg-black/85 hover:bg-neutral-900 pl-2 pr-2.5 py-1 sm:pl-2.5 sm:pr-3 sm:py-1.5 rounded-full border border-yellow-600/50 hover:border-yellow-400 backdrop-blur-md shadow-md transition-all group cursor-pointer active:scale-95 select-none shrink-0"
            title={`Rune Treasury - ${stats.runes} Runes held (Click to purchase or claim)`}
            aria-label={`Rune balance: ${stats.runes}`}
          >
            <img 
              src={ASSETS.CURRENCY_RUNE} 
              alt="Runes" 
              width={18}
              height={18}
              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', maxWidth: '18px', maxHeight: '18px', objectFit: 'contain' }}
              className="rune-currency-icon filter drop-shadow-[0_1px_4px_rgba(234,179,8,0.4)] group-hover:scale-105 transition-transform" 
              draggable={false}
              referrerPolicy="no-referrer"
            />
            <span className="text-yellow-400 font-black text-xs sm:text-sm font-mono tracking-tight leading-none">
              {stats.runes}
            </span>
            <span className="w-3.5 h-3.5 rounded-full bg-yellow-500/20 text-yellow-300 font-black text-[10px] flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-colors leading-none shrink-0">+</span>
          </button>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-5 w-full max-w-xs sm:max-w-md my-auto px-2">
          <img 
            src={ASSETS.TITLE_LOGO} 
            alt="Battle Swipes"
            className="w-[200px] min-[380px]:w-[240px] sm:w-[340px] lg:w-[460px] max-h-[26vh] sm:max-h-[35vh] h-auto object-contain drop-shadow-2xl" 
            draggable={false}
          />
          
          {/* Toned-down, neat title navigation buttons (Original fantasy banner artwork) */}
          <div className="flex flex-col gap-2 sm:gap-2.5 w-full max-w-[240px] min-[380px]:max-w-[270px] sm:max-w-[320px] px-1">
            {/* 1. Enter Arena */}
            <button 
              onClick={() => { 
                setModeSelectionType('arena');
                setIsModeSelectionOpen(true);
                playSound(SOUNDS.MENU_POP);
              }} 
              className="relative group w-full transition-transform duration-150 hover:scale-[1.015] active:scale-[0.985] focus:outline-none select-none cursor-pointer filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)] hover:drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              aria-label="Enter Arena"
              title="Enter Arena - Choose Single, Wi-Fi, or Bluetooth Battle"
            >
              <img
                src={ASSETS.BTN_ENTER_ARENA}
                alt="Enter Arena"
                className="w-full h-auto object-contain pointer-events-none"
                draggable={false}
                referrerPolicy="no-referrer"
              />
            </button>

            {/* 2. Clashing Tournament */}
            <button 
              onClick={() => {
                setModeSelectionType('tournament');
                setIsModeSelectionOpen(true);
                playSound(SOUNDS.MENU_POP);
              }}
              className="relative group w-full transition-transform duration-150 hover:scale-[1.015] active:scale-[0.985] focus:outline-none select-none cursor-pointer filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)] hover:drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              aria-label="Clashing Tournament"
              title="Clashing Tournament - Choose Solo, Wi-Fi, or Bluetooth Tournament"
            >
              <img
                src={ASSETS.BTN_CLASHING_TOURNAMENT}
                alt="Clashing Tournament"
                className="w-full h-auto object-contain pointer-events-none"
                draggable={false}
                referrerPolicy="no-referrer"
              />
            </button>

            {/* 3. Options (Sound, Volume, Auto-Draw & Duel Records) */}
            <button 
              onClick={() => {
                setIsOptionsOpen(true);
                playSound(SOUNDS.MENU_POP);
              }} 
              className="relative group w-full transition-transform duration-150 hover:scale-[1.015] active:scale-[0.985] focus:outline-none select-none cursor-pointer filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)] hover:drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              aria-label="Options"
              title="Game Options"
            >
              <img
                src={ASSETS.BTN_OPTIONS}
                alt="Options"
                className="w-full h-auto object-contain pointer-events-none"
                draggable={false}
                referrerPolicy="no-referrer"
              />
            </button>
          </div>
        </div>

        {/* Consolidated Game Options Modal */}
        <GameOptionsModal
          isOpen={isOptionsOpen}
          onClose={() => setIsOptionsOpen(false)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          gameVolume={gameVolume}
          onChangeVolume={handleVolumeChange}
          autoDrawOpeningHand={autoDrawOpeningHand}
          onToggleAutoDraw={handleToggleAutoDraw}
          onOpenDuelRecords={() => {
            setIsOptionsOpen(false);
            setCurrentScreen('stats');
          }}
          stats={stats}
          playSound={playSound}
        />

        {/* Shared Modals for Mode Selection (Arena/Tournament), Multiplayer, Rune Treasury, and 3D Cards */}
        {renderSharedModals()}
      </div>
    );
  }

  const renderDeckArchiveContent = () => (
    <DeckBoxArchive
      allDecks={allDecks}
      setAllDecks={setAllDecks}
      equippedDeckIndex={equippedDeckIndex}
      setEquippedDeckIndex={setEquippedDeckIndex}
      deckSize={DECK_SIZE}
      availableLibrary={availableLibrary}
      cardSleeves={cardSleeves}
      activeSleeveImage={activeSleeveImage}
      playSound={playSound}
      onOpen3DCard={(card) => setActive3DCard(card)}
      onOpenFullDeckEditor={(vaultIdx) => startDeckEditing(vaultIdx)}
    />
  );

  if (currentScreen === 'deckBuilder') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        {(() => {
          setProfileTab('deckArchive');
          setCurrentScreen('profile');
          return null;
        })()}
      </div>
    );
  }

  if (currentScreen === 'deckEditor') return (
    <>
      <DeckRingCarousel
        cards={editorMobileTab === 'deck' ? tempEditingDeck : filteredLibrary}
        tempEditingDeck={tempEditingDeck}
        deckSize={DECK_SIZE}
        viewMode={editorMobileTab}
        setViewMode={setEditorMobileTab}
        filterElement={filterElement}
        setFilterElement={setFilterElement}
        onAddCard={(card) => {
          if (tempEditingDeck.length < DECK_SIZE) {
            const existing = tempEditingDeck.some(c => c.id === card.id);
            if (!existing) {
              const updated = [...tempEditingDeck, card];
              setTempEditingDeck(updated);
              // Auto-sync into allDecks and localStorage immediately
              setAllDecks(prev => {
                const next = [...prev];
                next[editingVaultIndex] = updated;
                return next;
              });
              return true;
            }
          }
          return false;
        }}
        onRemoveCard={(card) => {
          const existingIdx = tempEditingDeck.findIndex(c => c.id === card.id);
          if (existingIdx > -1) {
            const updated = tempEditingDeck.filter((_, idx) => idx !== existingIdx);
            setTempEditingDeck(updated);
            // Auto-sync into allDecks and localStorage immediately
            setAllDecks(prev => {
              const next = [...prev];
              next[editingVaultIndex] = updated;
              return next;
            });
            return true;
          }
          return false;
        }}
        onBack={() => {
          // Ensure deck changes are saved to allDecks on return to archive
          const newAllDecks = [...allDecks];
          newAllDecks[editingVaultIndex] = [...tempEditingDeck];
          setAllDecks(newAllDecks);
          setProfileTab('deckArchive');
          setCurrentScreen('profile');
          playSound(SOUNDS.CARD_SWIPE);
        }}
        onSave={saveDeck}
        vaultIndex={editingVaultIndex}
        playSound={playSound}
        onOpen3DCard={(card) => setActive3DCard(card)}
        activeSleeve={activeSleeve}
        cardSleeves={cardSleeves}
        onEquipSleeve={(sleeve) => {
          setActiveSleeveId(sleeve.id);
          playSound(SOUNDS.SHIELD_BLOCK);
        }}
        onNavigateToForgeSleeves={() => {
          setForgeMode('sleeve');
          setProfileTab('forge');
          setCurrentScreen('profile');
          playSound(SOUNDS.CARD_SWIPE);
        }}
      />
      {renderSharedModals()}
    </>
  );

  if (currentScreen === 'stats') return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-y-auto overscroll-y-contain custom-scrollbar flex flex-col items-center justify-start sm:justify-center font-cinzel text-white p-4 sm:p-8 pt-20 sm:pt-24 pb-20 touch-pan-y z-10">
      <div className="fixed inset-0 bg-cover bg-center opacity-40 grayscale pointer-events-none" style={{ backgroundImage: `url(${ASSETS.TITLE_BG})` }} />
      <div className="fixed top-3 left-3 sm:top-6 sm:left-6 z-40">
        <button onClick={() => setCurrentScreen('menu')} className="bg-black/90 px-4 py-2 sm:px-8 sm:py-3 rounded-full border border-white/20 text-white hover:bg-white/10 font-black tracking-widest text-xs sm:text-base shadow-2xl active:scale-95 transition-all backdrop-blur-md">← RETURN</button>
      </div>
      <div className="relative z-20 bg-black/80 backdrop-blur-3xl border-2 border-white/5 p-6 sm:p-12 md:p-16 rounded-3xl sm:rounded-[4rem] max-w-2xl w-full text-center space-y-6 sm:space-y-10 my-auto shadow-2xl">
        <h2 className="text-2xl sm:text-4xl font-black uppercase text-white/50 tracking-[0.3em] sm:tracking-[0.5em]">Service Records</h2>
        <div className="grid grid-cols-2 gap-6 sm:gap-12">
          <div className="space-y-1">
            <div className="text-3xl sm:text-5xl font-black text-green-500">{stats.totalWins}</div>
            <div className="text-[10px] uppercase font-black text-white/40 tracking-widest">Victories</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-5xl font-black text-red-500">{stats.totalLosses}</div>
            <div className="text-[10px] uppercase font-black text-white/40 tracking-widest">Defeats</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-yellow-500">Lvl {stats.farthestLevel}</div>
            <div className="text-[10px] uppercase font-black text-white/40 tracking-widest">Max Depth</div>
          </div>
          <div 
            onClick={() => {
              setIsPurchaseRunesOpen(true);
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className="space-y-1 cursor-pointer group hover:scale-105 transition-transform"
            title="Click to Open Rune Treasury"
          >
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <img 
                src={ASSETS.CURRENCY_RUNE} 
                alt="Runes" 
                width={20}
                height={20}
                style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', maxWidth: '20px', maxHeight: '20px', objectFit: 'contain' }}
                className="rune-currency-icon filter drop-shadow-[0_2px_6px_rgba(234,179,8,0.4)] group-hover:scale-105 transition-transform" 
                draggable={false}
                referrerPolicy="no-referrer"
              />
              <span className="text-lg sm:text-xl font-black text-yellow-400 group-hover:text-yellow-300 leading-none">
                {stats.runes}
              </span>
              <span className="text-xs text-yellow-400 font-bold underline">+</span>
            </div>
            <div className="text-[10px] uppercase font-black text-white/40 group-hover:text-yellow-200/70 tracking-widest transition-colors">Current Runes</div>
          </div>
        </div>
      </div>
      {renderSharedModals()}
    </div>
  );

  if (currentScreen === 'cardForge') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        {(() => {
          setProfileTab('forge');
          setCurrentScreen('profile');
          return null;
        })()}
      </div>
    );
  }

  if (currentScreen === 'profile') return (
    <div 
      ref={forgeScrollContainerRef}
      className="fixed inset-0 w-full h-[100dvh] overflow-y-auto overscroll-y-contain custom-scrollbar touch-pan-y z-30 flex flex-col items-center justify-start font-cinzel text-yellow-100 pb-36 sm:pb-28"
    >
      <div className="fixed inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: `url(${ASSETS.BACKDROP})` }} />
      
      {/* Top Sticky Navigation Bar */}
      <div className="sticky top-0 z-40 w-full bg-[#0d0705]/95 backdrop-blur-md border-b border-yellow-900/40 py-2.5 px-3 sm:px-8 flex items-center justify-between shadow-2xl">
        <button 
          onClick={() => {
            stopCamera();
            setCurrentScreen('menu');
          }} 
          className="min-h-[44px] bg-black/80 px-4 sm:px-7 py-2 rounded-full border border-yellow-600/40 text-yellow-500 hover:bg-yellow-950/40 font-black tracking-widest text-xs sm:text-base shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4 text-yellow-500 shrink-0" />
          <span>TITLE MENU</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {profileTab === 'forge' && (forgeResult || forgeSleeveResult) && (
            <button
              onClick={() => altarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="min-h-[36px] lg:hidden text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/30 active:scale-95 transition-all animate-pulse flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span>VIEW RESULT</span>
            </button>
          )}
          <button 
            onClick={() => {
              setIsPurchaseRunesOpen(true);
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className="flex items-center gap-1.5 sm:gap-2 bg-black/85 hover:bg-neutral-900 pl-2 pr-2.5 py-1 sm:pl-2.5 sm:pr-3 sm:py-1.5 rounded-full border border-yellow-600/50 hover:border-yellow-400 shadow-md cursor-pointer transition-all active:scale-95 group shrink-0 select-none"
            title={`Rune Treasury - ${stats.runes} Runes (Click to open)`}
          >
            <img 
              src={ASSETS.CURRENCY_RUNE} 
              alt="Runes" 
              width={18}
              height={18}
              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', maxWidth: '18px', maxHeight: '18px', objectFit: 'contain' }}
              className="rune-currency-icon filter drop-shadow-[0_1px_4px_rgba(234,179,8,0.4)] group-hover:scale-105 transition-transform" 
              draggable={false}
              referrerPolicy="no-referrer"
            />
            <span className="text-yellow-400 font-black text-xs sm:text-sm font-mono leading-none">{stats.runes}</span>
            <span className="w-3.5 h-3.5 rounded-full bg-yellow-500/20 text-yellow-300 font-black text-[10px] flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-colors leading-none shrink-0">+</span>
          </button>
        </div>
      </div>

      {/* DUELIST PROFILE & AVATAR UPLOAD HERO */}
      <div className="relative z-20 w-full max-w-5xl px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="bg-[#1a0f0a]/95 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-yellow-900/50 shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          
          {/* Avatar with Custom Upload Frame (Larger Thumbnail, No Camera Emoji) */}
          <div 
            onClick={() => profilePhotoInputRef.current?.click()}
            className="relative group shrink-0 cursor-pointer"
            title="Click to change your avatar image"
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl p-1 bg-gradient-to-b from-yellow-400 via-amber-600 to-yellow-800 shadow-[0_0_30px_rgba(234,179,8,0.5)] border-2 border-yellow-300 transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full rounded-xl overflow-hidden border border-yellow-200 bg-black relative shadow-inner">
                <img 
                  src={playerProfileImage || DEFAULT_PLAYER_PROFILE} 
                  alt="Player Profile" 
                  className="w-full h-full object-cover object-center group-hover:opacity-90 transition-opacity"
                />
                {/* Subtle Hover Prompt Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-yellow-300 text-[10px] font-black uppercase tracking-wider gap-1 backdrop-blur-[2px]">
                  <Upload className="w-5 h-5 text-yellow-400" />
                  <span>Change Photo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden File Input for Profile Photo */}
          <input 
            type="file" 
            ref={profilePhotoInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProfilePhotoUpload(file);
              if (e.target) e.target.value = '';
            }}
          />

          {/* Profile Details, Duelist Name Input & Upload Controls */}
          <div className="flex-1 w-full text-center sm:text-left space-y-2.5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-yellow-400 uppercase tracking-wider">
                  DUELIST PROFILE
                </h2>
                <p className="text-[11px] sm:text-xs text-yellow-200/60 font-serif italic">
                  Customize your name and battle avatar for duels and tournaments
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center justify-center sm:justify-end gap-2 text-[10px] sm:text-xs font-black">
                <span className="px-2.5 py-1 bg-green-950/80 border border-green-500/50 text-green-300 rounded-lg">
                  {stats.totalWins} Wins
                </span>
                <span className="px-2.5 py-1 bg-yellow-950/80 border border-yellow-500/50 text-yellow-300 rounded-lg">
                  Level {stats.farthestLevel}
                </span>
              </div>
            </div>

            {/* Duelist Name Typing Area */}
            <div className="space-y-1 w-full max-w-md mx-auto sm:mx-0">
              <label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-yellow-500/90 flex items-center justify-center sm:justify-start gap-1.5">
                <User className="w-3.5 h-3.5 text-yellow-400" />
                <span>WARRIOR NAME</span>
              </label>
              <div className="relative">
                <input 
                  type="text"
                  value={playerName}
                  onChange={(e) => handleUpdatePlayerName(e.target.value)}
                  maxLength={20}
                  placeholder="Enter Duelist Name..."
                  className="w-full bg-black/80 border border-yellow-600/50 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-yellow-200 placeholder-white/20 font-black uppercase text-sm sm:text-base px-3.5 py-2 rounded-xl outline-none shadow-inner tracking-wider transition-all"
                />
              </div>
            </div>

            {/* Upload & Reset Buttons with Min 44px Touch Targets (No Emojis) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => profilePhotoInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-xs tracking-wider uppercase shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4 text-black shrink-0" />
                <span>UPLOAD PHOTO</span>
              </button>
              {playerProfileImage !== DEFAULT_PLAYER_PROFILE && (
                <button
                  type="button"
                  onClick={() => {
                    setPlayerProfileImage(DEFAULT_PLAYER_PROFILE);
                    if (tournamentState) {
                      setTournamentState(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          matches: prev.matches.map(m => ({
                            ...m,
                            fighter1: m.fighter1.isPlayer ? { ...m.fighter1, avatar: DEFAULT_PLAYER_PROFILE } : m.fighter1,
                            fighter2: m.fighter2.isPlayer ? { ...m.fighter2, avatar: DEFAULT_PLAYER_PROFILE } : m.fighter2,
                            winner: m.winner && m.winner.isPlayer ? { ...m.winner, avatar: DEFAULT_PLAYER_PROFILE } : m.winner,
                          })),
                          champion: prev.champion && prev.champion.isPlayer ? { ...prev.champion, avatar: DEFAULT_PLAYER_PROFILE } : prev.champion,
                        };
                      });
                    }
                    playSound(SOUNDS.CARD_SWIPE);
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/90 text-white/60 hover:text-white border border-white/20 font-bold text-[10px] sm:text-xs tracking-wider uppercase active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>RESET DEFAULT</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TWO TABS: ELEMENTAL FORGE vs DECK ARCHIVE (No Emojis) */}
        <div className="mt-4 sm:mt-6 flex items-center justify-center p-1 bg-black/80 rounded-2xl border border-yellow-900/60 w-full max-w-md mx-auto gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setProfileTab('forge');
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className={`flex-1 min-h-[46px] py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
              profileTab === 'forge'
                ? 'bg-gradient-to-r from-red-600 via-yellow-600 to-amber-500 text-black shadow-lg shadow-yellow-500/20 font-black scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>FORGE</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setProfileTab('deckArchive');
              stopCamera();
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className={`flex-1 min-h-[46px] py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
              profileTab === 'deckArchive'
                ? 'bg-gradient-to-r from-red-600 via-yellow-600 to-amber-500 text-black shadow-lg shadow-yellow-500/20 font-black scale-[1.02]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>DECK ARCHIVE</span>
          </button>
        </div>
      </div>

      {/* Tab 2: Deck Archive */}
      {profileTab === 'deckArchive' && (
        <div className="relative z-20 w-full max-w-5xl px-3 sm:px-6 pt-4 sm:pt-6 mx-auto">
          {renderDeckArchiveContent()}
        </div>
      )}

      {/* Tab 1: Elemental Forge Chamber & Altar */}
      {profileTab === 'forge' && (
        <div className="relative z-20 w-full max-w-5xl px-3 sm:px-6 pt-3 sm:pt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* LEFT COLUMN: The Elemental Forge Chamber */}
        <div className="bg-[#1a0f0a]/95 backdrop-blur-md p-4 min-[380px]:p-5 sm:p-7 rounded-2xl sm:rounded-[2.5rem] border-2 sm:border-4 border-yellow-900/50 shadow-2xl space-y-4 sm:space-y-6">
          
          {/* Forge Mode Switcher: Card vs Sleeve */}
          <div className="flex items-center justify-center p-1 bg-black/70 rounded-2xl border border-yellow-900/50 gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setForgeMode('card');
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className={`flex-1 min-h-[44px] py-2 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
                forgeMode === 'card'
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>FORGE CARD</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setForgeMode('sleeve');
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className={`flex-1 min-h-[44px] py-2 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
                forgeMode === 'sleeve'
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>FORGE SLEEVE</span>
            </button>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl min-[380px]:text-2xl sm:text-3xl font-black text-yellow-500 uppercase tracking-wider drop-shadow-md">
              {forgeMode === 'sleeve' ? 'Runic Sleeve Forge' : 'Elemental Forge'}
            </h2>
            <p className="text-[10px] sm:text-xs text-yellow-600/80 font-serif italic">
              {forgeMode === 'sleeve' 
                ? 'Craft a custom card sleeve used as the backing of all your cards.' 
                : 'Snap a photo or upload any image to forge your custom elemental card.'}
            </p>
          </div>

          {/* 1. PHOTO INPUT: Upload from device or Snap with Live Camera */}
          <div className="space-y-2">
            <label className="text-[10px] sm:text-xs uppercase text-yellow-500 font-black tracking-wider flex items-center justify-between">
              <span>{forgeMode === 'sleeve' ? 'Sleeve Artwork / Sigil Source' : 'Card Image Source'}</span>
              {forgePhoto && (
                <span className="text-green-400 font-bold text-[9px] sm:text-[10px] flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-400" />
                  <span>Photo Ready</span>
                </span>
              )}
            </label>

            {/* Hidden native file input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoFileUpload(f);
                if (e.target) e.target.value = '';
              }} 
            />

            {/* Live Camera Viewfinder */}
            {isCameraActive ? (
              <div className="relative w-full max-h-[300px] sm:max-h-[400px] aspect-[4/3] rounded-2xl overflow-hidden bg-black border-2 border-yellow-500 shadow-2xl flex flex-col items-center justify-between p-2.5 sm:p-3">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover absolute inset-0 ${cameraFacing === 'user' ? '-scale-x-100' : ''}`} 
                />
                
                {/* Camera Top Bar */}
                <div className="relative z-10 w-full flex items-center justify-between bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                  <span className="text-[10px] sm:text-xs text-yellow-400 font-black flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    LIVE VIEWFINDER
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={flipCamera} 
                      className="min-h-[36px] px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-[10px] font-black tracking-wider uppercase active:scale-95 transition-all flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 shrink-0" />
                      <span>Flip</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={stopCamera} 
                      className="min-h-[36px] px-3 py-1 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-black tracking-wider uppercase active:scale-95 transition-all flex items-center gap-1"
                    >
                      <X className="w-3 h-3 shrink-0" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>

                {/* Camera Center Reticle */}
                <div className="relative z-10 w-32 sm:w-36 h-40 sm:h-48 border-2 border-yellow-400/70 rounded-xl pointer-events-none flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <span className="text-[9px] uppercase tracking-widest text-yellow-300/90 bg-black/60 px-2 py-0.5 rounded font-bold">
                    {forgeMode === 'sleeve' ? 'Frame Sleeve Sigil' : 'Frame Subject'}
                  </span>
                </div>

                {/* Camera Capture Button */}
                <div className="relative z-10 w-full flex justify-center pb-1">
                  <button 
                    type="button" 
                    onClick={capturePhoto} 
                    className="min-h-[44px] bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(234,179,8,0.8)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>SNAP PHOTO</span>
                  </button>
                </div>
              </div>
            ) : forgePhoto ? (
              /* Photo Loaded Preview */
              <div className="relative w-full rounded-2xl overflow-hidden bg-black/80 border-2 border-yellow-500/80 p-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 shadow-xl">
                <div className="relative w-24 h-32 sm:w-28 sm:h-36 shrink-0 rounded-xl overflow-hidden border border-yellow-400 shadow-lg bg-black">
                  <img src={forgePhoto} alt="Forge Subject" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border border-white/20 pointer-events-none" />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="text-xs sm:text-sm font-black text-yellow-400 flex items-center justify-center sm:justify-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span>Artwork Ready for {forgeMode === 'sleeve' ? 'Sleeve' : 'Card'}</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/60">
                    {forgeMode === 'sleeve'
                      ? 'The whole image will cover the back of the card, displaying the full image with no text.'
                      : 'The full image will cover the front of the card with sleek floating TCG stats, elemental crest, and rarity border.'}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500/40 text-yellow-300 text-[10px] sm:text-xs font-black tracking-wider uppercase active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <FolderOpen className="w-3 h-3 shrink-0" />
                      <span>Change</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => startCamera('environment')} 
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500/40 text-yellow-300 text-[10px] sm:text-xs font-black tracking-wider uppercase active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Camera className="w-3 h-3 shrink-0" />
                      <span>Snap Again</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setForgePhoto(null)} 
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800 border border-red-500/40 text-red-300 text-[10px] sm:text-xs font-black tracking-wider uppercase active:scale-95 transition-all flex items-center gap-1"
                    >
                      <X className="w-3 h-3 shrink-0" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Photo Selection & Drag-and-Drop Area */
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDraggingPhoto(true); }}
                onDragLeave={() => setIsDraggingPhoto(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPhoto(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handlePhotoFileUpload(f);
                }}
                className={`w-full rounded-2xl border-2 border-dashed p-4 sm:p-6 text-center space-y-3 transition-all ${
                  isDraggingPhoto 
                    ? 'border-yellow-400 bg-yellow-500/10 scale-102' 
                    : 'border-yellow-900/60 bg-black/40 hover:border-yellow-600/80'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
                    <Camera className="w-5 h-5 text-yellow-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-black text-yellow-200">
                    {forgeMode === 'sleeve' ? 'Use Any Image for Sleeve Backing' : 'Use Any Photo or Snap a Live Picture'}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/50 max-w-xs">
                    {forgeMode === 'sleeve' 
                      ? 'Snap or upload any artwork, rune, emblem, or picture to use on the back of your cards.'
                      : 'Take a photo of anything you want, or choose an image file from your device.'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1">
                  <button 
                    type="button" 
                    onClick={() => startCamera('environment')} 
                    className="min-h-[44px] px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-xs tracking-wider uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>SNAP PHOTO</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="min-h-[44px] px-4 sm:px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-yellow-500/40 text-yellow-300 font-black text-xs tracking-wider uppercase active:scale-95 transition-all flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    <span>CHOOSE FILE</span>
                  </button>
                </div>

                {cameraError && (
                  <p className="text-[10px] text-red-400 font-bold">{cameraError}</p>
                )}
              </div>
            )}
          </div>

          {/* 2. TITLE (OPTIONAL) */}
          <div>
            <label className="text-[10px] sm:text-xs uppercase text-yellow-600 font-black mb-1 block tracking-wider">
              {forgeMode === 'sleeve' ? 'Sleeve Vault Name (Optional)' : 'Card Title (Optional)'}
            </label>
            <input 
              value={forgeTheme} 
              onChange={e => setForgeTheme(e.target.value)} 
              type="text" 
              placeholder={forgeMode === 'sleeve' ? 'Name for your collection vault (e.g. Phoenix Ward)...' : 'Name your card or generate automatically...'} 
              className="w-full bg-black/60 border-2 border-yellow-900/40 p-3 sm:p-3.5 rounded-xl text-yellow-100 focus:border-yellow-500 outline-none transition-all text-base sm:text-sm placeholder:text-white/30" 
            />
            {forgeMode === 'sleeve' && (
              <p className="text-[9px] sm:text-[10px] text-yellow-400/80 italic mt-1">
                No text will appear on the card back — pure full-bleed sleeve artwork.
              </p>
            )}
          </div>

          {/* 2.5 CARD & SLEEVE FRAMING (FULL IMAGE VS EDGE-TO-EDGE) */}
          {forgeMode === 'card' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] sm:text-xs uppercase text-yellow-600 font-black tracking-wider">
                  Card Front Framing
                </label>
                <span className="text-[9px] text-green-400 font-bold">
                  {cardFraming === 'cover' ? 'Full-Bleed Cover' : 'Fit Whole Image (100% Uncropped)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCardFraming('cover')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs font-black tracking-normal min-h-[44px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    cardFraming === 'cover'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] font-black'
                      : 'bg-black/50 text-yellow-500/80 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Maximize2 className="w-4 h-4 shrink-0" />
                  <span>Full-Bleed Cover</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardFraming('fit')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs font-black tracking-normal min-h-[44px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    cardFraming === 'fit'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] font-black'
                      : 'bg-black/50 text-yellow-500/80 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Minimize2 className="w-4 h-4 shrink-0" />
                  <span>Fit Whole Image</span>
                </button>
              </div>
              <p className="text-[9px] sm:text-[10px] text-white/50 italic">
                {cardFraming === 'cover'
                  ? 'Fills the entire front of the card edge-to-edge with your full chosen image.'
                  : 'Displays 100% of your chosen image uncropped on the front of the card with ambient backdrop.'}
              </p>
            </div>
          )}

          {forgeMode === 'sleeve' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] sm:text-xs uppercase text-yellow-600 font-black tracking-wider">
                  Artwork Framing
                </label>
                <span className="text-[9px] text-green-400 font-bold">
                  {sleeveFraming === 'cover' ? 'Full-Bleed Cover (Recommended)' : 'Fit Whole Image (0-100%)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSleeveFraming('cover')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs font-black tracking-normal min-h-[44px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    sleeveFraming === 'cover'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] font-black'
                      : 'bg-black/50 text-yellow-500/80 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Maximize2 className="w-4 h-4 shrink-0" />
                  <span>Full-Bleed Cover</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSleeveFraming('fit')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs font-black tracking-normal min-h-[44px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    sleeveFraming === 'fit'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] font-black'
                      : 'bg-black/50 text-yellow-500/80 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Minimize2 className="w-4 h-4 shrink-0" />
                  <span>Fit Whole Image</span>
                </button>
              </div>
              <p className="text-[9px] sm:text-[10px] text-white/50 italic">
                {sleeveFraming === 'cover'
                  ? 'The image covers the entire back of the card edge-to-edge with no empty space.'
                  : 'Fits the complete uncropped image directly across all four corners of the card back.'}
              </p>
            </div>
          )}

          {/* 3. ELEMENT INFUSION SELECTION (RANDOM OR USER CHOSEN) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-xs uppercase text-yellow-600 font-black tracking-wider">
                Elemental Infusion
              </label>
              <span className="text-[9px] sm:text-[10px] text-yellow-500/80 font-semibold">
                {selectedForgeElement === 'RANDOM' ? 'Random Roll' : `${selectedForgeElement} Selected`}
              </span>
            </div>
            
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {/* RANDOM OPTION */}
              <button 
                type="button" 
                onClick={() => setSelectedForgeElement('RANDOM')} 
                className={`p-1.5 sm:p-2 rounded-xl border text-[9px] sm:text-[11px] font-black tracking-normal min-h-[46px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                  selectedForgeElement === 'RANDOM' 
                    ? 'bg-gradient-to-b from-yellow-400 to-amber-600 text-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.5)] scale-102 font-black' 
                    : 'bg-black/50 text-yellow-500 border-yellow-900/40 hover:border-yellow-600/60'
                }`}
              >
                <Dices className="w-4 h-4 mb-0.5 shrink-0" />
                <span className="text-[8px] sm:text-[9px] leading-tight font-black">RANDOM</span>
              </button>

              {/* SPECIFIC ELEMENTS */}
              {[Element.FIRE, Element.ICE, Element.WIND, Element.EARTH].map(el => {
                const isSelected = selectedForgeElement === el;
                return (
                  <button 
                    key={el} 
                    type="button" 
                    onClick={() => setSelectedForgeElement(el)} 
                    className={`p-1.5 sm:p-2 rounded-xl border text-[9px] sm:text-[11px] font-black tracking-normal min-h-[46px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                      isSelected 
                        ? 'bg-yellow-600 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-102' 
                        : 'bg-black/50 text-yellow-500 border-yellow-900/40 hover:border-yellow-600/60'
                    }`}
                  >
                    <img src={ELEMENT_ICONS[el]} alt={el} className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain mb-0.5" />
                    <span className="text-[8px] sm:text-[9px] leading-tight font-black">{el}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] sm:text-[10px] text-white/40 italic">
              {forgeMode === 'sleeve' 
                ? 'Imbues your sleeve backing with an authentic elemental emblem and thematic palette.' 
                : 'Pick an element beforehand or leave on Random for a surprise elemental infusion!'}
            </p>
          </div>

          {/* 3.5 WEAPON ARCHETYPE SELECTION (SWORD, AXE, SHIELD, OR RANDOM - NOT HERO) */}
          {forgeMode === 'card' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] sm:text-xs uppercase text-yellow-600 font-black tracking-wider flex items-center gap-1">
                  <span>Weapon Archetype</span>
                </label>
                <span className="text-[9px] sm:text-[10px] text-yellow-500/80 font-semibold">
                  {selectedForgeWeapon === 'RANDOM' ? 'Any Weapon' : selectedForgeWeapon}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {/* RANDOM */}
                <button
                  type="button"
                  onClick={() => setSelectedForgeWeapon('RANDOM')}
                  className={`p-1.5 sm:p-2 rounded-xl border text-[9px] sm:text-[11px] font-black tracking-normal min-h-[46px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                    selectedForgeWeapon === 'RANDOM'
                      ? 'bg-gradient-to-b from-yellow-400 to-amber-600 text-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.5)] scale-102 font-black'
                      : 'bg-black/50 text-yellow-500 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Dices className="w-4 h-4 mb-0.5 shrink-0" />
                  <span className="text-[8px] sm:text-[9px] leading-tight font-black">RANDOM</span>
                </button>

                {/* SWORD */}
                <button
                  type="button"
                  onClick={() => setSelectedForgeWeapon(CardType.SWORD)}
                  className={`p-1.5 sm:p-2 rounded-xl border text-[9px] sm:text-[11px] font-black tracking-normal min-h-[46px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                    selectedForgeWeapon === CardType.SWORD
                      ? 'bg-yellow-600 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-102 font-black'
                      : 'bg-black/50 text-yellow-500 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Swords className="w-4 h-4 mb-0.5 shrink-0" />
                  <span className="text-[8px] sm:text-[9px] leading-tight font-black">SWORD</span>
                </button>

                {/* AXE */}
                <button
                  type="button"
                  onClick={() => setSelectedForgeWeapon(CardType.AXE)}
                  className={`p-1.5 sm:p-2 rounded-xl border text-[9px] sm:text-[11px] font-black tracking-normal min-h-[46px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                    selectedForgeWeapon === CardType.AXE
                      ? 'bg-yellow-600 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-102 font-black'
                      : 'bg-black/50 text-yellow-500 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Flame className="w-4 h-4 mb-0.5 shrink-0" />
                  <span className="text-[8px] sm:text-[9px] leading-tight font-black">AXE</span>
                </button>

                {/* SHIELD */}
                <button
                  type="button"
                  onClick={() => setSelectedForgeWeapon(CardType.SHIELD)}
                  className={`p-1.5 sm:p-2 rounded-xl border text-[9px] sm:text-[11px] font-black tracking-normal min-h-[46px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                    selectedForgeWeapon === CardType.SHIELD
                      ? 'bg-yellow-600 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-102 font-black'
                      : 'bg-black/50 text-yellow-500 border-yellow-900/40 hover:border-yellow-600/60'
                  }`}
                >
                  <Shield className="w-4 h-4 mb-0.5 shrink-0" />
                  <span className="text-[8px] sm:text-[9px] leading-tight font-black">SHIELD</span>
                </button>
              </div>

              <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-yellow-950/40 border border-yellow-500/30 text-[8.5px] sm:text-[9.5px] text-yellow-300">
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Rare Hero Draw:</strong> Hero cannot be chosen directly! Rare random draws ascend this weapon into a Hero with that weapon&apos;s style, an elemental Hero Status, and higher stats.
                </span>
              </div>
            </div>
          )}

          {/* 4. STATS & RARITY NOTE */}
          <div className="bg-black/40 border border-yellow-900/40 rounded-xl p-2.5 sm:p-3 text-[9px] sm:text-[11px] text-yellow-200/80 space-y-2">
            <div className="font-black text-yellow-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span>{forgeMode === 'sleeve' ? 'SLEEVE RARITY & METALLIC ACCENTS' : 'FORGE RARITY TIERS & STRENGTH'}</span>
              </span>
              <span className="text-[9px] text-yellow-300/70">BORDER COLORS</span>
            </div>
            
            {/* Rarity Grid Legend */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-red-950/40 border border-red-500/50">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-red-400 text-[9px] sm:text-[10px] leading-tight">Common (Red)</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-red-200/60 truncate">Standard Border</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-green-950/40 border border-green-500/50">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-green-400 text-[9px] sm:text-[10px] leading-tight">Uncommon (Green)</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-green-200/60 truncate">Emerald Foil</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-blue-950/40 border border-blue-500/50">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-blue-400 text-[9px] sm:text-[10px] leading-tight">Rare (Blue)</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-blue-200/60 truncate">Sapphire Foil</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-purple-950/40 border border-purple-500/50">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-purple-400 text-[9px] sm:text-[10px] leading-tight">Epic Rare (Purple)</span>
                  <span className="text-[7.5px] sm:text-[8.5px] text-purple-200/60 truncate">Mythic Amethyst</span>
                </div>
              </div>
            </div>

            <p className="text-white/50 text-[8px] sm:text-[9.5px] leading-relaxed">
              {forgeMode === 'sleeve'
                ? 'Sleeves are forged with authentic full-bleed 640x880 dimensions and custom metallic rarity borders, perfectly matching your card fronts.'
                : 'When forged, rarity tier and stats (ATK & DEF) are rolled at random. Hero cards have high chance of Rare or Epic Rare!'}
            </p>
          </div>

          {/* 5. FORGE ACTION BUTTON */}
          <div className="space-y-2 pt-1">
            <button 
              disabled={isForging || stats.runes < FORGE_COST} 
              onClick={handleForge} 
              className={`min-h-[52px] w-full py-3.5 sm:py-4.5 rounded-2xl font-black text-base sm:text-xl tracking-[0.12em] sm:tracking-[0.2em] shadow-2xl transition-all ${
                isForging || stats.runes < FORGE_COST 
                  ? 'bg-white/5 text-white/20 animate-pulse cursor-not-allowed' 
                  : 'bg-gradient-to-r from-red-600 via-yellow-600 to-amber-500 text-black hover:brightness-125 active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.4)]'
              }`}
            >
              {isForging 
                ? (forgeMode === 'sleeve' ? 'FORGING SLEEVE...' : 'FORGING ESSENCE...') 
                : (forgeMode === 'sleeve' ? 'FORGE CARD SLEEVE' : 'FORGE CARD')}
            </button>
            <div className="flex items-center justify-center gap-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-yellow-600/70">
              <span>Cost: {FORGE_COST} Runes</span>
              <span className="text-white/20">•</span>
              <button
                type="button"
                onClick={() => {
                  setIsPurchaseRunesOpen(true);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className="text-yellow-400 hover:text-yellow-300 underline font-black cursor-pointer tracking-widest transition-colors"
              >
                + GET RUNES
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Forge Altar & Sized Resulting Card or Sleeve */}
        <div 
          ref={altarRef}
          className="scroll-mt-24 bg-black/60 rounded-2xl sm:rounded-[2.5rem] border-2 border-white/10 flex flex-col items-center justify-center p-4 sm:p-8 shadow-inner relative overflow-hidden min-h-[300px] sm:min-h-[480px]"
        >
          <div className="absolute inset-0 bg-yellow-600/5 blur-[100px] animate-pulse pointer-events-none" />
          
          {isForging ? (
            <div className="flex flex-col items-center gap-4 z-10 py-8">
              <div className="w-14 h-14 sm:w-18 sm:h-18 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(234,179,8,0.6)]" />
              <span className="text-yellow-400 text-xs sm:text-sm font-black tracking-widest uppercase animate-pulse">
                {forgeMode === 'sleeve' ? 'Compositing Sleeve Essence...' : 'Compositing Primal Essence...'}
              </span>
              <span className="text-[10px] text-white/40">
                {forgeMode === 'sleeve' 
                  ? 'Compositing full-bleed card backing with zero text & authentic borders' 
                  : 'Rolling rarity & sizing card with authentic borders'}
              </span>
            </div>
          ) : forgeMode === 'sleeve' && forgeSleeveResult ? (() => {
            const resultRarityConfig = RARITY_CONFIGS[forgeSleeveResult.rarity || Rarity.COMMON];
            const isEquipped = activeSleeveId === forgeSleeveResult.id;
            return (
              <div className="flex flex-col items-center gap-4 sm:gap-6 animate-in zoom-in-95 fade-in duration-500 z-10 py-2 w-full max-w-sm">
                {/* Sized Framed Sleeve Preview with Rarity Border */}
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => inspectSleeveIn3D(forgeSleeveResult)}
                  onDoubleClick={() => inspectSleeveIn3D(forgeSleeveResult)}
                  title="Double tap or click to inspect in 3D"
                >
                  <img 
                    src={forgeSleeveResult.image} 
                    alt={forgeSleeveResult.name}
                    className={`w-48 min-[380px]:w-56 sm:w-68 lg:w-72 aspect-[640/880] rounded-2xl border-4 ${resultRarityConfig.borderClass} group-hover:scale-102 transition-transform bg-black object-fill`} 
                    style={{ borderColor: resultRarityConfig.color }}
                  />
                  
                  {/* Element corner emblem */}
                  <div className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 w-9 h-9 sm:w-12 sm:h-12 bg-black border-2 border-yellow-500 rounded-full p-1.5 sm:p-2 shadow-xl">
                    <img src={ELEMENT_ICONS[forgeSleeveResult.element]} alt={forgeSleeveResult.element} className="w-full h-full object-contain" />
                  </div>

                  {/* Sleeve Badge */}
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full shadow-xl border border-white animate-bounce flex items-center gap-1">
                    <Shield className="w-3 h-3 text-black" />
                    <span>CARD SLEEVE</span>
                  </div>
                </div>

                {/* Sleeve Meta & Controls */}
                <div className="text-center w-full space-y-3">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-black text-yellow-400 drop-shadow-lg">
                      {forgeSleeveResult.name}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-yellow-200/70 font-serif italic">
                      Custom {forgeSleeveResult.element} Card Sleeve Backing
                    </p>
                  </div>

                  {/* Badge */}
                  <div className="flex items-center justify-center gap-2 text-xs font-black">
                    <span className="px-3 py-1 bg-yellow-950/80 border border-yellow-500/60 rounded-lg text-yellow-400 shadow">
                      {resultRarityConfig.name} Rarity
                    </span>
                    {isEquipped && (
                      <span className="px-3 py-1 bg-green-950/80 border border-green-500/60 rounded-lg text-green-400 shadow flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-400" />
                        <span>ACTIVE ON ALL CARDS</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center pt-2">
                    <button 
                      onClick={() => handleSleeveKeep(true)} 
                      className="min-h-[48px] bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-5 sm:px-7 py-2.5 rounded-full font-black text-xs sm:text-sm hover:brightness-110 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Shield className="w-4 h-4 text-black shrink-0" />
                      <span>USE FOR ALL CARDS</span>
                    </button>
                    <button 
                      onClick={() => handleSleeveKeep(false)} 
                      className="min-h-[48px] bg-green-700/80 hover:bg-green-600 text-white px-4 sm:px-6 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>SAVE TO VAULT</span>
                    </button>
                    <button 
                      onClick={() => {
                        setForgeSleeveResult(null);
                        setForgePhoto(null);
                        setForgeTheme('');
                      }} 
                      className="min-h-[48px] bg-white/10 text-white/60 px-3.5 sm:px-4 py-2.5 rounded-full font-black text-xs sm:text-sm hover:bg-red-600 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-1"
                    >
                      <X className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })() : forgeMode === 'card' && forgeResult ? (
            <ForgedCardReveal
              card={forgeResult}
              onInspect3D={() => setActive3DCard(forgeResult)}
              onKeep={handleForgeKeep}
              onDiscard={() => {
                setForgeResult(null);
                setForgePhoto(null);
                setForgeTheme('');
              }}
            />
          ) : forgePhoto ? (
            /* Live Pre-Forge Altar Display showing the Full Image on Card Front or Sleeve Back */
            <div className="flex flex-col items-center gap-4 sm:gap-6 animate-in zoom-in-95 fade-in duration-500 z-10 py-2 w-full max-w-sm">
              <div className="relative group w-48 min-[380px]:w-56 sm:w-68 lg:w-72 aspect-[640/880] rounded-2xl overflow-hidden border-4 border-yellow-400/90 shadow-[0_0_25px_rgba(234,179,8,0.35)] bg-black">
                {/* Full Image background */}
                {((forgeMode === 'card' && cardFraming === 'fit') || (forgeMode === 'sleeve' && sleeveFraming === 'fit')) && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-40 blur-md scale-110"
                    style={{ backgroundImage: `url(${forgePhoto})` }}
                  />
                )}
                <img 
                  src={forgePhoto} 
                  alt={forgeMode === 'sleeve' ? 'Chosen Sleeve Artwork' : 'Chosen Card Artwork'} 
                  className={`w-full h-full relative z-10 ${
                    (forgeMode === 'card' ? cardFraming : sleeveFraming) === 'cover' ? 'object-cover' : 'object-contain'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none z-20" />

                {/* Floating Top Header Banner */}
                <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between px-3 py-1.5 rounded-full bg-black/80 border border-yellow-400/80 backdrop-blur-md shadow-lg">
                  <span className="text-xs sm:text-sm font-black text-yellow-300 truncate max-w-[65%]">
                    {forgeTheme.trim() || (forgeMode === 'sleeve' ? 'Custom Sleeve' : 'Awaiting Strike')}
                  </span>
                  <span className="text-[10px] font-black text-yellow-500 uppercase tracking-wider">
                    {selectedForgeElement === 'RANDOM' ? 'RANDOM' : selectedForgeElement}
                  </span>
                </div>

                {/* Floating Subtitle / Framing Badge */}
                <div className="absolute top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/85 border border-white/20 text-[9px] font-bold text-white/90 shadow">
                    {(forgeMode === 'card' ? cardFraming : sleeveFraming) === 'cover' ? 'FULL-BLEED' : 'FIT WHOLE IMAGE'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-yellow-950/85 border border-yellow-500/50 text-[9px] font-black text-yellow-300 shadow">
                    {forgeMode === 'sleeve' ? 'CARD SLEEVE BACKING' : (selectedForgeWeapon === 'RANDOM' ? 'ANY WEAPON' : selectedForgeWeapon)}
                  </span>
                </div>

                {/* Floating Bottom Badges: Card stats vs Pure Sleeve Backing */}
                {forgeMode === 'card' ? (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between">
                    <div className="px-2.5 py-1 rounded-xl bg-red-950/90 border border-red-500/80 text-red-300 text-xs font-black shadow flex items-center gap-1">
                      <Swords className="w-3.5 h-3.5 text-red-300 shrink-0" />
                      <span>ATK ???</span>
                    </div>
                    <div className="px-2 py-0.5 rounded-lg bg-black/80 border border-yellow-500/50 text-[9px] font-black text-yellow-400 shadow flex items-center gap-1">
                      <Crown className="w-3 h-3 text-yellow-400 shrink-0" />
                      <span>HERO ROLL</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-sky-950/90 border border-sky-500/80 text-sky-300 text-xs font-black shadow flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      <span>DEF ???</span>
                    </div>
                  </div>
                ) : (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 flex items-center justify-center">
                    <div className="px-3 py-1 rounded-full bg-black/85 border border-yellow-500/60 text-yellow-300 text-[10px] font-black shadow flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      <span>CARD SLEEVE BACKING • NO TEXT OVERLAY</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ready prompt */}
              <div className="text-center space-y-1">
                <span className="text-xs sm:text-sm font-black text-yellow-400 flex items-center justify-center gap-1.5 animate-pulse">
                  <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span>{forgeMode === 'sleeve' ? 'FULL SLEEVE ARTWORK READY' : 'FULL ARTWORK READY ON CARD FRONT'}</span>
                  <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                </span>
                <p className="text-[10px] sm:text-xs text-white/50">
                  {forgeMode === 'sleeve'
                    ? 'Strike the anvil below to forge your card backing sleeve with metallic borders!'
                    : 'Strike the anvil below to awaken combat stats, element runes, and roll rarity!'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-2.5 p-6 z-10">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-2xl text-white/20 animate-pulse">
                <Sparkles className="w-6 h-6 text-white/30" />
              </div>
              <span className="text-white/30 uppercase font-black tracking-[0.25em] text-xs sm:text-sm">
                {forgeMode === 'sleeve' ? 'Sleeve Altar Awaiting Forge' : 'Altar Awaiting Forge'}
              </span>
              <p className="text-[10px] sm:text-xs text-white/40 max-w-xs">
                {forgeMode === 'sleeve' 
                  ? 'Provide artwork or snap a photo, choose an elemental affinity, and forge a custom sleeve backing for all your cards.'
                  : 'Provide a photo, select an element or roll random, and strike the anvil to forge your card.'}
              </p>
            </div>
          )}
        </div>
      </div>
      )}
      {renderSharedModals()}
    </div>
  );

  const renderCardSelfVisuals = (card?: Card) => {
    if (!card) return null;
    const isHero = card.type === CardType.HERO;
    const isShield = card.type === CardType.SHIELD;

    let heroBadgeText = 'HEROIC PHOENIX INFERNO';
    let heroWingsGradient = 'from-red-600/60 via-amber-500/50 to-yellow-400/30';

    if (card.element === Element.ICE) {
      heroBadgeText = 'HEROIC ABSOLUTE ZERO';
      heroWingsGradient = 'from-blue-600/60 via-cyan-400/50 to-sky-200/30';
    } else if (card.element === Element.WIND) {
      heroBadgeText = 'HEROIC MYTHIC TEMPEST';
      heroWingsGradient = 'from-emerald-600/60 via-teal-400/50 to-green-300/30';
    } else if (card.element === Element.EARTH) {
      heroBadgeText = 'HEROIC TITAN GEOCRAG';
      heroWingsGradient = 'from-amber-800/60 via-yellow-600/50 to-amber-500/30';
    }

    return (
      <>
        {/* Unique Hero Element Organic Glowing Aura & Dynamic Particles (Sparks, Mist, Embers) */}
        {isHero && (
          <div className="absolute -inset-10 sm:-inset-20 pointer-events-none flex items-center justify-center z-0">
            <div className={`w-full h-full bg-gradient-to-r ${heroWingsGradient} rounded-full blur-3xl animate-hero-aura`} />
            <ParticleCanvas element={card.element} isHero={true} />
          </div>
        )}

        {/* Shield Deflection Ring */}
        {isShield && (
          <div className="absolute -inset-3 sm:-inset-5 rounded-2xl sm:rounded-3xl border-2 border-blue-400/60 pointer-events-none animate-shield-bounce z-10" />
        )}

        {/* Hero Unique Badge */}
        {isHero && (clashStage === 'impact' || clashStage === 'falloff' || clashStage === 'ascent') && (
          <div className="absolute -bottom-5 sm:-bottom-9 left-1/2 -translate-x-1/2 z-40 whitespace-nowrap bg-black/95 px-3.5 sm:px-6 py-0.5 sm:py-1 rounded-full border border-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.8)] animate-hero-badge">
            <span className="text-[8px] sm:text-xs font-black uppercase tracking-widest text-yellow-300">{heroBadgeText}</span>
          </div>
        )}
      </>
    );
  };

  const renderImpactEffect = (attackingCard?: Card) => {
    if (!attackingCard || (clashStage !== 'impact' && clashStage !== 'falloff')) return null;
    if (clashWinner === 'tie') return null;
    const el = attackingCard.element;
    const isHero = attackingCard.type === CardType.HERO;
    const isShield = attackingCard.type === CardType.SHIELD;

    let slashImg = VFX.FIRE_SLASH;
    let burstImg = VFX.FIRE_BURST;

    if (el === Element.ICE) {
      slashImg = VFX.ICE_SLASH;
      burstImg = VFX.ICE_BURST;
    } else if (el === Element.WIND) {
      slashImg = VFX.WIND_SLASH;
      burstImg = VFX.WIND_BURST;
    } else if (el === Element.EARTH) {
      slashImg = VFX.EARTH_SLASH;
      burstImg = VFX.EARTH_BURST;
    }

    return (
      <>
        {/* Primary Slash & Explosive Burst */}
        <img src={slashImg} className="animate-slash z-20 pointer-events-none" alt="Slash Effect" />
        <img src={burstImg} className="animate-burst z-20 pointer-events-none" alt="Burst Effect" />

        {/* Canvas Organic Volumetric Particle System */}
        <ParticleCanvas element={el} isHero={isHero} isShield={isShield} />
      </>
    );
  };

  // Martial Arts Arena Tournament Screen
  if (currentScreen === 'tournament') {
    const currentTourney = tournamentState || createInitialTournament(playerName, playerProfileImage || DEFAULT_PLAYER_PROFILE);
    if (!tournamentState) {
      setTournamentState(currentTourney);
    }

    return (
      <ArenaTournament
        tournament={currentTourney}
        playerName={playerName || 'Duelist'}
        playerAvatar={playerProfileImage || DEFAULT_PLAYER_PROFILE}
        onStartMatch={(match: TournamentMatch) => {
          setActiveTournamentMatch(match);
          setIsSpectatingTournamentAi(false);
          const opponent = match.fighter1.isPlayer ? match.fighter2 : match.fighter1;
          resetGame(false, opponent.name, opponent.avatar, false, opponent.deck);
          setCurrentScreen('playing');
        }}
        onWatchAiMatch={(match: TournamentMatch) => {
          setActiveTournamentMatch(match);
          setIsSpectatingTournamentAi(true);
          setSpectatorViewingFighter('fighter1');

          const hasSeenClash = viewedVsClashMatchIds.includes(match.id);
          if (!hasSeenClash) {
            setViewedVsClashMatchIds(prev => prev.includes(match.id) ? prev : [...prev, match.id]);
          }

          // Check if match was already in progress
          const savedMatch = ongoingTournamentMatchesRef.current[match.id];
          if (savedMatch) {
            setGameState(savedMatch.gameState);
            setDisplayPlayerHP(savedMatch.displayPlayerHP);
            setDisplayComputerHP(savedMatch.displayComputerHP);
            setIsClashing(false);
            setClashStage('none');
            setHighlightedCardId(null);
            setFlungCard(null);
            setFlingRect(null);
            isTurnProcessingRef.current = false;
            setIsBattleIntroActive(!hasSeenClash);
            setIsDrawingOpeningHand(false);
            setIsOpeningClashActive(false);
            setIsLogOpen(false);
            startBackgroundMusic();
          } else {
            resetGame(false, match.fighter2.name, match.fighter2.avatar, true, match.fighter2.deck, match.fighter1.deck);
            setIsBattleIntroActive(!hasSeenClash);
            setIsDrawingOpeningHand(false);
            setIsOpeningClashActive(false);
          }

          setCurrentScreen('playing');
        }}
        onSimulateMatch={(match: TournamentMatch) => {
          const winner = simulateAiMatch(match.fighter1, match.fighter2);
          const updated = advanceTournamentMatch(currentTourney, match.id, winner);
          setTournamentState(updated);
          if (match.id) {
            delete ongoingTournamentMatchesRef.current[match.id];
          }
          playSound(SOUNDS.TIE_CLASH);
        }}
        onSimulateToPlayerMatch={() => {
          let tourney = currentTourney;
          while (true) {
            const nextMatch = tourney.matches.find(
              m => m.status !== 'completed' && m.fighter1.id !== 'tbd' && m.fighter2.id !== 'tbd'
            );
            if (!nextMatch) break;
            if (nextMatch.fighter1.isPlayer || nextMatch.fighter2.isPlayer) break;
            const winner = simulateAiMatch(nextMatch.fighter1, nextMatch.fighter2);
            tourney = advanceTournamentMatch(tourney, nextMatch.id, winner);
            delete ongoingTournamentMatchesRef.current[nextMatch.id];
          }
          setTournamentState(tourney);
          playSound(SOUNDS.TIE_CLASH);
        }}
        onNewTournament={() => {
          const tourney = createInitialTournament(playerName, playerProfileImage || DEFAULT_PLAYER_PROFILE);
          setTournamentState(tourney);
          setActiveTournamentMatch(null);
          setIsSpectatingTournamentAi(false);
          ongoingTournamentMatchesRef.current = {};
          setViewedVsClashMatchIds([]);
          playSound(SOUNDS.CARD_SWIPE);
        }}
        onReturnToMenu={() => {
          setCurrentScreen('menu');
          playSound(SOUNDS.CARD_SWIPE);
        }}
        playSound={playSound}
      />
    );
  }

  // Player & Opponent 3D Deck Box Skins for Cinematic VS Intro
  const playerDeckBoxSkin = deckBoxSkins[equippedDeckIndex] || DEFAULT_DECK_BOX_SKINS[equippedDeckIndex] || DEFAULT_DECK_BOX_SKINS[0];
  const opponentDeckBoxSkin = getOpponentDeckBoxSkin(
    currentEnvElement || Element.FIRE,
    gameState.currentOpponentName || 'Opponent'
  );

  // 1. Cinematic 3D Deck Box VS Clash Intro (Plays First)
  if (currentScreen === 'playing' && isBattleIntroActive && !gameState.isGameOver) {
    return (
      <BattleDeckBoxClashIntro
        playerSkin={
          isSpectatingTournamentAi && activeTournamentMatch
            ? getOpponentDeckBoxSkin(activeTournamentMatch.fighter1.element, activeTournamentMatch.fighter1.name)
            : playerDeckBoxSkin
        }
        opponentSkin={opponentDeckBoxSkin}
        playerName={isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.name : (playerName || 'Player')}
        opponentName={gameState.currentOpponentName || (activeTournamentMatch ? activeTournamentMatch.fighter2.name : 'Opponent')}
        playerAvatar={isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.avatar : (playerProfileImage || DEFAULT_PLAYER_PROFILE)}
        opponentAvatar={gameState.currentOpponentAvatar || (activeTournamentMatch ? activeTournamentMatch.fighter2.avatar : DEFAULT_OPPONENT_PROFILE)}
        currentEnvElement={currentEnvElement}
        arenaBackdrop={gameState.currentClashBg}
        playSound={playSound}
        isMuted={isMuted}
        onComplete={() => {
          setIsBattleIntroActive(false);
          setIsDrawingOpeningHand(true);
        }}
        onExit={() => {
          setIsBattleIntroActive(false);
          setIsDrawingOpeningHand(false);
          setIsOpeningClashActive(false);
          setIsLogOpen(false);
          stopBackgroundMusic();
          if (activeTournamentMatch) {
            setActiveTournamentMatch(null);
            setIsSpectatingTournamentAi(false);
            setCurrentScreen('tournament');
          } else {
            setCurrentScreen('menu');
          }
        }}
      />
    );
  }

  // Flashy animation clash after the draw phase of the battle with the players' profile pictures
  if (currentScreen === 'playing' && isOpeningClashActive && !gameState.isGameOver) {
    return (
      <DuelOpeningClash
        playerProfileImage={
          isSpectatingTournamentAi && activeTournamentMatch
            ? activeTournamentMatch.fighter1.avatar
            : (playerProfileImage || DEFAULT_PLAYER_PROFILE)
        }
        playerName={
          isSpectatingTournamentAi && activeTournamentMatch
            ? activeTournamentMatch.fighter1.name
            : (playerName || 'YOU')
        }
        opponentImage={
          gameState.currentOpponentAvatar || (activeTournamentMatch ? activeTournamentMatch.fighter2.avatar : DEFAULT_OPPONENT_PROFILE)
        }
        opponentName={
          gameState.currentOpponentName || (activeTournamentMatch ? activeTournamentMatch.fighter2.name : getRandomAiName())
        }
        level={gameState.level}
        currentEnvElement={currentEnvElement}
        playSound={playSound}
        isMuted={isMuted}
        onComplete={() => {
          setIsOpeningClashActive(false);
        }}
        onExit={() => {
          setIsOpeningClashActive(false);
          setIsDrawingOpeningHand(false);
          setIsLogOpen(false);
          stopBackgroundMusic();
          if (activeTournamentMatch) {
            if (!isSpectatingTournamentAi && tournamentState) {
              const opp = activeTournamentMatch.fighter1.isPlayer ? activeTournamentMatch.fighter2 : activeTournamentMatch.fighter1;
              const updated = advanceTournamentMatch(tournamentState, activeTournamentMatch.id, opp);
              setTournamentState(updated);
            }
            setActiveTournamentMatch(null);
            setIsSpectatingTournamentAi(false);
            setCurrentScreen('tournament');
          } else {
            setCurrentScreen('menu');
          }
        }}
      />
    );
  }

  return (
    <div className={`relative w-full h-screen text-white overflow-hidden ${isScreenShaking ? 'animate-shake-heavy' : ''}`}>
      <div className="absolute inset-0 bg-cover bg-center scale-110 opacity-40 transition-opacity duration-1000" style={{ backgroundImage: `url(${ASSETS.BACKDROP})` }} />
      <div className="absolute inset-0 battle-vignette z-10" />

      {/* Combined 3D Deck Box Deploy, Shuffle & Opening Hand Draw Phase (Embedded in Arena) */}
      {isDrawingOpeningHand && !gameState.isGameOver && (
        <ArenaDeckDeployAndDraw
          playerSkin={
            isSpectatingTournamentAi && activeTournamentMatch
              ? getOpponentDeckBoxSkin(activeTournamentMatch.fighter1.element, activeTournamentMatch.fighter1.name)
              : playerDeckBoxSkin
          }
          playerDeckCards={
            isSpectatingTournamentAi && activeTournamentMatch
              ? activeTournamentMatch.fighter1.deck
              : (allDecks[equippedDeckIndex] || [])
          }
          cardsToDraw={gameState.playerHand}
          totalNeeded={5}
          activeSleeve={activeSleeve}
          activeSleeveImage={activeSleeveImage}
          autoDrawInitial={isSpectatingTournamentAi ? true : autoDrawOpeningHand}
          onAutoDrawChange={setAutoDrawOpeningHand}
          playSound={playSound}
          isMuted={isMuted}
          onComplete={() => {
            setIsDrawingOpeningHand(false);
          }}
        />
      )}

      {/* Realm Badge Positioned Up Top Above Player & Opponent Names (Zero Overlap) */}
      {currentEnvElement && (
        <div className="absolute top-1 sm:top-2 left-1/2 -translate-x-1/2 z-[110] pointer-events-none flex items-center gap-1.5 bg-black/85 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full border border-yellow-500/50 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-yellow-400 shadow-[0_0_20px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <img src={ELEMENT_ICONS[currentEnvElement]} className="w-3 h-3 sm:w-3.5 sm:h-3.5 object-contain" alt={currentEnvElement} />
          <span>{currentEnvElement} REALM</span>
        </div>
      )}

      {/* Arena Top Header */}
      <div className="absolute top-2 sm:top-4 lg:top-6 w-full flex justify-between px-2 min-[400px]:px-4 sm:px-6 lg:px-20 z-[100] items-start">
        {/* Player Profile & HP Bar (Interactive Profile to Switch Watching in Spectator Mode) */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div 
            onClick={() => {
              if (isSpectatingTournamentAi) {
                setSpectatorViewingFighter('fighter1');
                playSound(SOUNDS.CARD_SWIPE);
              }
            }}
            className={`relative shrink-0 transition-transform ${isSpectatingTournamentAi ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
            title={isSpectatingTournamentAi ? `Tap to watch ${activeTournamentMatch?.fighter1.name || 'Fighter 1'}'s hand` : undefined}
          >
            <div className={`w-9 h-9 min-[380px]:w-11 min-[380px]:h-11 sm:w-14 sm:h-14 rounded-full p-0.5 sm:p-1 bg-gradient-to-b from-yellow-400 to-amber-600 shadow-[0_0_15px_rgba(234,179,8,0.5)] border ${
              isSpectatingTournamentAi && spectatorViewingFighter === 'fighter1'
                ? 'border-yellow-200 ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.9)]'
                : 'border-yellow-200'
            }`}>
              <img 
                src={
                  isSpectatingTournamentAi && activeTournamentMatch
                    ? activeTournamentMatch.fighter1.avatar
                    : (playerProfileImage || DEFAULT_PLAYER_PROFILE)
                } 
                alt="Player Profile" 
                className="w-full h-full rounded-full object-cover bg-black"
              />
            </div>
            {isSpectatingTournamentAi && spectatorViewingFighter === 'fighter1' && (
              <div className="absolute -top-1.5 -left-1.5 sm:-top-2 sm:-left-2 bg-yellow-400 text-black text-[6px] min-[380px]:text-[7px] sm:text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-0.5 animate-pulse z-10">
                <Eye className="w-2 h-2 shrink-0" />
                <span>VIEWING</span>
              </div>
            )}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[6px] min-[380px]:text-[7px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider whitespace-nowrap shadow-md max-w-[70px] truncate">
              {isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.name.split(' ')[0] : (playerName ? playerName.split(' ')[0] : 'YOU')}
            </div>
          </div>
          <div className="flex flex-col items-start min-w-0">
            {renderHPBar('player', displayPlayerHP, 'w-[105px] min-[380px]:w-[125px] sm:w-[250px] lg:w-[380px]')}
            <div className="flex items-center gap-1.5 sm:gap-3 mt-[-10px] min-[380px]:mt-[-14px] sm:mt-[-22px] ml-2 sm:ml-12">
              <span className="font-black text-base min-[380px]:text-lg sm:text-2xl text-yellow-500 drop-shadow-md">{Math.ceil(displayPlayerHP)}</span>
              <span className="text-[7px] min-[380px]:text-[9px] sm:text-[11px] text-white/70 font-bold uppercase tracking-widest truncate max-w-[80px] sm:max-w-[160px]">
                {isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.name : (playerName || 'Player HP')}
              </span>
            </div>
          </div>
        </div>

        {/* Center Section: VS Logo and Spectator Control */}
        <div className="self-center mt-2.5 sm:mt-3 flex flex-col items-center gap-1 shrink-0">
          {!isClashing && (
            <img src={ASSETS.VS_LOGO} className="h-7 min-[380px]:h-9 sm:h-12 lg:h-16 animate-vs drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
          )}
          {isSpectatingTournamentAi && activeTournamentMatch && (
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={handleLeaveSpectating}
                className="bg-black/80 hover:bg-black/95 text-yellow-400 px-2.5 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 shadow-xl transition-all border border-yellow-500/40 flex items-center gap-1.5"
                title="Leave match and return to tournament bracket (progress saved)"
              >
                <LogOut className="w-3 h-3 text-yellow-400 shrink-0" />
                <span>LEAVE MATCH</span>
              </button>
              <button
                onClick={handleSkipSpectating}
                className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black px-2.5 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 shadow-xl transition-all border border-yellow-300 flex items-center gap-1.5 animate-pulse"
              >
                <FastForward className="w-3 h-3 text-black shrink-0" />
                <span>SKIP TO WINNER</span>
              </button>
            </div>
          )}
        </div>

        {/* Opponent Profile & HP Bar (Interactive Profile to Switch Watching in Spectator Mode) */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="flex flex-col items-end min-w-0">
            {renderHPBar('computer', displayComputerHP, 'w-[105px] min-[380px]:w-[125px] sm:w-[250px] lg:w-[380px]')}
            <div className="flex items-center gap-1.5 sm:gap-3 mt-[-10px] min-[380px]:mt-[-14px] sm:mt-[-22px] mr-2 sm:mr-12">
              <span className="text-[7px] min-[380px]:text-[9px] sm:text-[11px] text-white/70 font-bold uppercase tracking-widest truncate max-w-[80px] sm:max-w-[160px]">
                {gameState.currentOpponentName || 'Opponent'}
              </span>
              <span className="font-black text-base min-[380px]:text-lg sm:text-2xl text-red-500 drop-shadow-md">{Math.ceil(displayComputerHP)}</span>
            </div>
          </div>
          <div 
            onClick={() => {
              if (isSpectatingTournamentAi) {
                setSpectatorViewingFighter('fighter2');
                playSound(SOUNDS.CARD_SWIPE);
              }
            }}
            className={`relative shrink-0 transition-transform ${isSpectatingTournamentAi ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
            title={isSpectatingTournamentAi ? `Tap to watch ${activeTournamentMatch?.fighter2.name || 'Fighter 2'}'s hand` : undefined}
          >
            <div className={`w-9 h-9 min-[380px]:w-11 min-[380px]:h-11 sm:w-14 sm:h-14 rounded-full p-0.5 sm:p-1 bg-gradient-to-b from-red-500 to-purple-800 shadow-[0_0_15px_rgba(239,68,68,0.5)] border ${
              isSpectatingTournamentAi && spectatorViewingFighter === 'fighter2'
                ? 'border-red-300 ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.9)]'
                : 'border-red-300'
            }`}>
              <img 
                src={gameState.currentOpponentAvatar || DEFAULT_OPPONENT_PROFILE} 
                alt="Opponent" 
                className="w-full h-full rounded-full object-cover bg-black"
              />
            </div>
            {isSpectatingTournamentAi && spectatorViewingFighter === 'fighter2' && (
              <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-red-600 text-white text-[6px] min-[380px]:text-[7px] sm:text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-0.5 animate-pulse z-10">
                <Eye className="w-2 h-2 shrink-0" />
                <span>VIEWING</span>
              </div>
            )}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[6px] min-[380px]:text-[7px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider whitespace-nowrap shadow-md max-w-[70px] truncate">
              {activeTournamentMatch ? (gameState.currentOpponentName?.split(' ')[0] || 'OPPONENT') : `LVL ${gameState.level}`}
            </div>
          </div>
        </div>
      </div>

      {/* Clash Stage Overlay */}
      {isClashing && (
        <div className="absolute inset-0 z-[150] flex items-center justify-center animate-in fade-in duration-500 overflow-hidden">
          <div className={`absolute inset-0 bg-cover bg-center brightness-[0.4] animate-bg-sway ${clashStage === 'ascent' ? 'animate-camera-ascent' : ''}`} style={{ backgroundImage: `url(${gameState.currentClashBg})` }} />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          
          {/* Rotating Volumetric Cinematic Light Rays in Backdrop */}
          <div className="absolute top-1/2 left-1/2 w-[120vw] h-[120vw] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-30 blur-xl animate-cinematic-rays bg-[conic-gradient(from_0deg_at_50%_50%,rgba(255,215,0,0.5)_0deg,transparent_30deg,rgba(255,255,255,0.4)_60deg,transparent_90deg,rgba(255,80,0,0.5)_120deg,transparent_150deg,rgba(255,215,0,0.5)_180deg,transparent_210deg,rgba(255,255,255,0.4)_240deg,transparent_270deg,rgba(255,80,0,0.5)_300deg,transparent_330deg)]" />

          {/* Shockwave Burst Ring on Impact */}
          {clashStage === 'impact' && (
            <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full border-4 border-yellow-300/80 pointer-events-none z-30 animate-shockwave-ring shadow-[0_0_100px_rgba(255,215,0,0.9)]" />
          )}

          {clashStage === 'flash' && <div className="absolute inset-0 z-[300] bg-white animate-flash" />}

          {/* Tie Effect Overlay */}
          {clashStage === 'impact' && clashWinner === 'tie' && (
            <img src={VFX.TIE_CLASH_EFFECT} className="animate-tie-clash" alt="Tie Clash Effect" />
          )}

          {/* Ambient Elemental Particle Clash Canvas during VS Fade & Ascent */}
          {(clashStage === 'vs-fade' || clashStage === 'ascent') && gameState.lastPlayedPlayer && clashWinner !== 'tie' && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <ParticleCanvas element={gameState.lastPlayedPlayer.element} isHero={gameState.lastPlayedPlayer.type === CardType.HERO} />
            </div>
          )}

          {/* Floating Combat Stats & Advantage Banner */}
          {(clashStage === 'impact' || clashStage === 'falloff') && (
            <div className="absolute top-12 min-[400px]:top-16 sm:top-24 inset-x-0 z-[200] flex flex-col items-center gap-1.5 pointer-events-none px-4">
              {ELEMENT_ADVANTAGE[gameState.lastPlayedPlayer?.element!] === gameState.lastPlayedComputer?.element && (
                <div className="bg-gradient-to-r from-yellow-500 to-red-600 text-black px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl border border-yellow-300 animate-hero-badge flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>PLAYER ELEMENTAL CRITICAL (+50% ATK)</span>
                </div>
              )}
              {ELEMENT_ADVANTAGE[gameState.lastPlayedComputer?.element!] === gameState.lastPlayedPlayer?.element && (
                <div className="bg-gradient-to-r from-red-600 to-purple-600 text-white px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl border border-red-400 animate-hero-badge flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{(gameState.currentOpponentName || 'OPPONENT').toUpperCase()} ELEMENTAL CRITICAL (+50% ATK)</span>
                </div>
              )}
              {currentEnvElement && (gameState.lastPlayedPlayer?.element === currentEnvElement || gameState.lastPlayedComputer?.element === currentEnvElement) && (
                <div className="bg-yellow-500/30 text-yellow-300 border border-yellow-500/60 px-3 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>REALM AFFINITY BONUS (+5 ATK)</span>
                </div>
              )}
            </div>
          )}

          {/* Battle Swipe Mode Arena during Clash */}
          {clashStage === 'swipe-battle' && gameState.lastPlayedPlayer && gameState.lastPlayedComputer && (
            <BattleSwipeArena
              playerCard={gameState.lastPlayedPlayer}
              computerCard={gameState.lastPlayedComputer}
              currentEnvElement={currentEnvElement}
              arenaBackdrop={gameState.currentClashBg || (currentEnvElement ? ELEMENTAL_BACKDROPS[currentEnvElement] : undefined)}
              level={gameState.level}
              playSound={playSound}
              isMuted={isMuted}
              isSpectating={isSpectatingTournamentAi}
              fighter1Name={isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.name : (playerName || 'Player')}
              fighter2Name={isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter2.name : (gameState.currentOpponentName || 'Opponent')}
              fighter1Avatar={isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.avatar : (playerProfileImage || DEFAULT_PLAYER_PROFILE)}
              fighter2Avatar={isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter2.avatar : (gameState.currentOpponentAvatar || DEFAULT_OPPONENT_PROFILE)}
              tournamentRound={activeTournamentMatch ? activeTournamentMatch.round : undefined}
              preDuelResult={currentPreDuelResult || undefined}
              isMultiplayer={isMultiplayerActive}
              onSendScore={(score) => {
                if (isMultiplayerActive) {
                  multiplayerService.sendSwipeScore(score, gameState.level);
                }
              }}
              remoteScore={multiplayerRemoteScore}
              onOpen3DCard={(card) => setActive3DCard(card)}
              onComplete={(res) => {
                if (swipeBattleResolverRef.current) {
                  swipeBattleResolverRef.current(res);
                  swipeBattleResolverRef.current = null;
                }
              }}
            />
          )}

          <div className={`relative w-full h-full flex flex-row items-center justify-center gap-2 min-[400px]:gap-4 sm:gap-8 lg:gap-24 px-2 sm:px-10 transition-all duration-300 ${clashStage === 'swipe-battle' ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}>
            {/* Player Played Card */}
            <div className={`transition-all duration-300 z-20 relative 
              ${clashStage === 'intro' ? 'animate-spin-in-l' : ''} 
              ${clashStage === 'ascent' ? 'animate-hero-ascent z-50' : ''} 
              ${clashStage === 'impact' && clashWinner === 'player' ? 'animate-hero-descent z-50' : ''} 
              ${clashStage === 'impact' && (clashWinner === 'computer' || clashWinner === 'tie') ? 'animate-impact-hit' : ''} 
              ${clashStage === 'falloff' && clashWinner === 'computer' ? 'animate-die opacity-0' : ''}`}
            >
              {/* Floating Damage Taken or Blocked by Player */}
              {clashWinner === 'computer' && (clashStage === 'impact' || clashStage === 'falloff') && activeDamageDisplay && (
                activeDamageDisplay.pDmg > 0 ? (
                  <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center pointer-events-none animate-bounce">
                    <span className="text-xl min-[380px]:text-3xl sm:text-5xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,1)] whitespace-nowrap">
                      -{activeDamageDisplay.pDmg} HP
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-red-200 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-500 shadow-md">
                      DAMAGE TAKEN
                    </span>
                  </div>
                ) : (
                  <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center pointer-events-none animate-bounce">
                    <span className="text-lg min-[380px]:text-2xl sm:text-4xl font-black text-cyan-400 drop-shadow-[0_0_20px_rgba(56,189,248,1)] whitespace-nowrap">
                      BLOCKED!
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-cyan-200 bg-cyan-950/90 px-2.5 py-0.5 rounded-full border border-cyan-400 shadow-md">
                      DEFENSE HELD (0 HP)
                    </span>
                  </div>
                )
              )}
              {renderCardSelfVisuals(gameState.lastPlayedPlayer)}
              {clashWinner === 'computer' && (clashStage === 'impact' || clashStage === 'falloff') && renderImpactEffect(gameState.lastPlayedComputer)}
              {(() => {
                const pCard = gameState.lastPlayedPlayer;
                const pRarity = pCard?.rarity || Rarity.COMMON;
                const pConfig = RARITY_CONFIGS[pRarity];
                return (
                  <div 
                    className="relative p-1 sm:p-2 rounded-xl sm:rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] z-10 cursor-pointer"
                    onClick={() => {
                      const now = Date.now();
                      if (pCard) {
                        if (lastCardTapRef.current?.id === pCard.id && (now - lastCardTapRef.current.time) < 350) {
                          setActive3DCard(pCard);
                          lastCardTapRef.current = null;
                          return;
                        }
                        lastCardTapRef.current = { id: pCard.id, time: now };
                      }
                    }}
                    onDoubleClick={() => pCard && setActive3DCard(pCard)}
                    title="Double tap to inspect 3D"
                  >
                    <img 
                      src={pCard?.image} 
                      className={`w-24 min-[380px]:w-32 sm:w-56 lg:w-72 aspect-[640/880] rounded-lg sm:rounded-xl border-4 ${pConfig.borderClass} bg-black object-contain`}
                      style={{ borderColor: pConfig.color }}
                    />
                    <div className="absolute -top-2 -left-2 min-[380px]:-top-3 min-[380px]:-left-3 sm:-top-4 sm:-left-4 bg-black border-2 border-yellow-500 rounded-full w-7 h-7 min-[380px]:w-9 min-[380px]:h-9 sm:w-14 sm:h-14 flex items-center justify-center shadow-lg">
                       <span className="text-[10px] min-[380px]:text-xs sm:text-xl font-black text-yellow-500">{pCard?.attack}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center gap-1.5 sm:gap-4 z-30 shrink-0">
              <img 
                src={ASSETS.VS_LOGO} 
                className={`w-16 min-[380px]:w-24 sm:w-40 lg:w-56 transition-all duration-500 
                  ${clashStage === 'intro' ? 'animate-vs' : ''} 
                  ${clashStage === 'vs-fade' ? 'animate-vs-fade opacity-0' : ''} 
                  ${clashStage === 'ascent' || clashStage === 'impact' || clashStage === 'falloff' ? 'opacity-0 scale-0 pointer-events-none' : ''}`} 
              />
              {(clashStage === 'impact' || clashStage === 'falloff') && (
                 <div className="text-lg min-[380px]:text-xl sm:text-4xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] animate-realm-text">
                   {clashWinner === 'tie' ? 'CLASH!' : clashWinner === 'player' ? 'VICTORY' : 'DEFEAT'}
                 </div>
              )}
            </div>

            {/* Computer Played Card */}
            <div className={`transition-all duration-300 z-20 relative 
              ${clashStage === 'intro' ? 'animate-spin-in-r' : ''} 
              ${clashStage === 'ascent' && clashWinner === 'computer' ? 'animate-hero-ascent z-50' : ''} 
              ${clashStage === 'impact' && clashWinner === 'computer' ? 'animate-hero-descent z-50' : ''} 
              ${clashStage === 'impact' && (clashWinner === 'player' || clashWinner === 'tie') ? 'animate-impact-hit' : ''} 
              ${clashStage === 'falloff' && clashWinner === 'player' ? 'animate-die opacity-0' : ''}`}
            >
               {/* Floating Damage Taken or Blocked by Computer */}
               {clashWinner === 'player' && (clashStage === 'impact' || clashStage === 'falloff') && activeDamageDisplay && (
                 activeDamageDisplay.cDmg > 0 ? (
                   <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center pointer-events-none animate-bounce">
                     <span className="text-xl min-[380px]:text-3xl sm:text-5xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,1)] whitespace-nowrap">
                       -{activeDamageDisplay.cDmg} HP
                     </span>
                     <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-yellow-200 bg-yellow-950/80 px-2 py-0.5 rounded-full border border-yellow-500 shadow-md">
                       DAMAGE TAKEN
                     </span>
                   </div>
                 ) : (
                   <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center pointer-events-none animate-bounce">
                     <span className="text-lg min-[380px]:text-2xl sm:text-4xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,1)] whitespace-nowrap">
                       BLOCKED!
                     </span>
                     <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-yellow-200 bg-yellow-950/90 px-2.5 py-0.5 rounded-full border border-yellow-500 shadow-md">
                       DEFENSE HELD (0 HP)
                     </span>
                   </div>
                 )
               )}
               {renderCardSelfVisuals(gameState.lastPlayedComputer)}
               {clashWinner === 'player' && (clashStage === 'impact' || clashStage === 'falloff') && renderImpactEffect(gameState.lastPlayedPlayer)}
               {(() => {
                 const cCard = gameState.lastPlayedComputer;
                 const cRarity = cCard?.rarity || Rarity.COMMON;
                 const cConfig = RARITY_CONFIGS[cRarity];
                 return (
                   <div 
                    className="relative p-1 sm:p-2 rounded-xl sm:rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] z-10 cursor-pointer"
                    onClick={() => {
                      const now = Date.now();
                      if (cCard) {
                        if (lastCardTapRef.current?.id === cCard.id && (now - lastCardTapRef.current.time) < 350) {
                          setActive3DCard(cCard);
                          lastCardTapRef.current = null;
                          return;
                        }
                        lastCardTapRef.current = { id: cCard.id, time: now };
                      }
                    }}
                    onDoubleClick={() => cCard && setActive3DCard(cCard)}
                    title="Double tap to inspect 3D"
                   >
                     <img 
                      src={cCard?.image} 
                      className={`w-24 min-[380px]:w-32 sm:w-56 lg:w-72 aspect-[640/880] rounded-lg sm:rounded-xl border-4 ${cConfig.borderClass} bg-black object-contain`}
                      style={{ borderColor: cConfig.color }}
                     />
                     <div className="absolute -top-2 -right-2 min-[380px]:-top-3 min-[380px]:-right-3 sm:-top-4 sm:-right-4 bg-black border-2 border-red-500 rounded-full w-7 h-7 min-[380px]:w-9 min-[380px]:h-9 sm:w-14 sm:h-14 flex items-center justify-center shadow-lg">
                        <span className="text-[10px] min-[380px]:text-xs sm:text-xl font-black text-red-500">{cCard?.attack}</span>
                     </div>
                   </div>
                 );
               })()}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Player Hand & Control Bar */}
      <div className={`absolute bottom-2 sm:bottom-6 w-full flex flex-col items-center gap-1.5 sm:gap-2.5 transition-all duration-500 z-50 ${isClashing ? 'translate-y-[600px] opacity-0' : isDrawingOpeningHand ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Multiplayer Turn Status Cues */}
        {isMultiplayerActive && isWaitingForOpponentCard && (
          <div className="animate-in fade-in zoom-in-95 duration-200 px-4 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.4)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>CARD LOCKED IN • WAITING FOR OPPONENT...</span>
          </div>
        )}
        {isMultiplayerActive && opponentHasSelectedCard && !isWaitingForOpponentCard && (
          <div className="animate-in fade-in zoom-in-95 duration-200 px-4 py-1.5 rounded-full bg-amber-950/90 border border-amber-400 text-amber-300 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-bounce flex items-center gap-2">
            <span>⚡ OPPONENT HAS SELECTED A CARD! PLAY YOURS!</span>
          </div>
        )}

        {/* Spectator Mode: Interactive Fighter Hand Switcher */}
        {isSpectatingTournamentAi && activeTournamentMatch && (
          <div className="flex items-center gap-1.5 sm:gap-2.5 bg-black/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1 rounded-full border border-yellow-500/40 shadow-xl z-10 animate-in fade-in duration-300">
            <span className="text-[7px] sm:text-[8.5px] font-black uppercase tracking-wider text-yellow-400/90 flex items-center gap-1">
              <Eye className="w-3 h-3 text-yellow-400 shrink-0" />
              <span>HAND VIEW:</span>
            </span>
            <button
              onClick={() => {
                setSpectatorViewingFighter('fighter1');
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                spectatorViewingFighter === 'fighter1'
                  ? 'bg-yellow-500 text-black shadow-[0_0_12px_rgba(234,179,8,0.8)] scale-105'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
              }`}
              title={`Switch hand view to ${activeTournamentMatch.fighter1.name}`}
            >
              <img src={activeTournamentMatch.fighter1.avatar} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
              <span className="truncate max-w-[70px] sm:max-w-[110px]">{activeTournamentMatch.fighter1.name}</span>
              <span className="bg-black/30 text-current px-1 rounded text-[7px] sm:text-[8px] font-mono">
                {gameState.playerHand.length}
              </span>
            </button>

            <span className="text-[8px] text-white/40 font-black">VS</span>

            <button
              onClick={() => {
                setSpectatorViewingFighter('fighter2');
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                spectatorViewingFighter === 'fighter2'
                  ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-105'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
              }`}
              title={`Switch hand view to ${activeTournamentMatch.fighter2.name}`}
            >
              <img src={activeTournamentMatch.fighter2.avatar} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
              <span className="truncate max-w-[70px] sm:max-w-[110px]">{activeTournamentMatch.fighter2.name}</span>
              <span className="bg-black/30 text-current px-1 rounded text-[7px] sm:text-[8px] font-mono">
                {gameState.computerHand.length}
              </span>
            </button>
          </div>
        )}

        {/* Hand 3D Ring Carousel (Fits into standard game position & sizing perfectly) */}
        <div className="w-full relative max-w-full overflow-visible px-2 sm:px-4">
          <BattleHandCarousel
            cards={
              isSpectatingTournamentAi
                ? (spectatorViewingFighter === 'fighter2' ? gameState.computerHand : gameState.playerHand)
                : gameState.playerHand
            }
            onPlayCard={(card, customEl) => {
              if (isSpectatingTournamentAi && spectatorViewingFighter === 'fighter2') {
                handleFlingCardAsOpponent(card, customEl);
              } else {
                handleFlingCard(card, customEl);
              }
            }}
            onOpen3DCard={(card) => setActive3DCard(card)}
            playSound={playSound}
            isClashing={isClashing}
            isGameOver={gameState.isGameOver}
            isTurnProcessing={isTurnProcessingRef.current}
            flungCardId={flungCard?.id}
          />
        </div>
        
        <div className="flex gap-2 sm:gap-4 items-center">
          <div className="bg-black/70 px-3.5 py-1 sm:px-4 sm:py-1 rounded-full border border-white/10 text-[8px] sm:text-[9px] font-black text-white/50 tracking-widest uppercase">
            RESERVES: {
              isSpectatingTournamentAi && spectatorViewingFighter === 'fighter2'
                ? gameState.computerDrawPile.length
                : gameState.playerDrawPile.length
            }
          </div>
          {isSpectatingTournamentAi && (
            <div className="bg-yellow-500/15 text-yellow-300 px-3 py-0.5 rounded-full border border-yellow-500/30 text-[7px] sm:text-[8px] font-black tracking-wider uppercase">
              TAP CARD TO PLAY AS {spectatorViewingFighter === 'fighter2' ? 'FIGHTER 2' : 'FIGHTER 1'}
            </div>
          )}
        </div>
      </div>

      {/* Game Over Modal Overlay */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-700 p-4">
          <div className="text-center p-6 sm:p-12 lg:p-16 rounded-3xl sm:rounded-[4rem] border-2 sm:border-4 border-yellow-600/30 bg-[#0d0906] shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden max-w-sm sm:max-w-xl w-full">
            <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/10 to-transparent pointer-events-none" />
            {isSpectatingTournamentAi && activeTournamentMatch ? (
              <div className="space-y-2 mb-6 sm:mb-8 flex flex-col items-center">
                <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-yellow-400">
                  {gameState.winner === 'player' ? activeTournamentMatch.fighter1.name : activeTournamentMatch.fighter2.name} Wins!
                </h3>
              </div>
            ) : (
              <img src={gameState.winner === 'player' ? ASSETS.YOU_WIN : ASSETS.YOU_LOSE} className="w-[220px] sm:w-[320px] lg:w-[480px] mx-auto mb-6 sm:mb-12 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] animate-vs max-w-full" />
            )}
            
            <div className="flex flex-col gap-3 sm:gap-6 w-full max-w-xs mx-auto relative z-10">
              {activeTournamentMatch ? (
                <>
                  <button 
                    onClick={() => {
                      if (activeTournamentMatch) {
                        delete ongoingTournamentMatchesRef.current[activeTournamentMatch.id];
                      }
                      setIsLogOpen(false);
                      setActiveTournamentMatch(null);
                      setIsSpectatingTournamentAi(false);
                      setSpectatorViewingFighter('fighter1');
                      setCurrentScreen('tournament');
                    }} 
                    className="bg-gradient-to-b from-yellow-400 to-yellow-700 text-black py-3.5 sm:py-5 rounded-2xl font-black text-xl sm:text-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl tracking-tighter"
                  >
                    RETURN TO BRACKET
                  </button>
                  <button 
                    onClick={() => {
                      if (activeTournamentMatch) {
                        delete ongoingTournamentMatchesRef.current[activeTournamentMatch.id];
                      }
                      setIsLogOpen(false);
                      setActiveTournamentMatch(null);
                      setIsSpectatingTournamentAi(false);
                      setSpectatorViewingFighter('fighter1');
                      setCurrentScreen('menu');
                    }} 
                    className="bg-white/5 text-white/50 py-2.5 sm:py-3 rounded-2xl font-black text-base sm:text-lg hover:text-white hover:bg-white/10 transition-all"
                  >
                    EXIT TO MENU
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => resetGame(gameState.winner === 'player')} className="bg-gradient-to-b from-yellow-400 to-yellow-700 text-black py-3.5 sm:py-5 rounded-2xl font-black text-xl sm:text-3xl hover:scale-105 active:scale-95 transition-all shadow-2xl tracking-tighter">
                    {gameState.winner === 'player' ? 'NEXT CHALLENGE' : 'RETRY DUEL'}
                  </button>
                  <button onClick={() => { setIsLogOpen(false); setCurrentScreen('menu'); }} className="bg-white/5 text-white/50 py-2.5 sm:py-3 rounded-2xl font-black text-base sm:text-xl hover:text-white hover:bg-white/10 transition-all">EXIT TO MENU</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flying Fling Card Overlay */}
      {flungCard && flingRect && (
        <div
          className="fixed z-[9999] pointer-events-none animate-battle-fling"
          style={{
            left: `${flingRect.left}px`,
            top: `${flingRect.top}px`,
            width: `${flingRect.width}px`,
            height: `${flingRect.height}px`,
          }}
        >
          <div className="relative w-full h-full border-2 border-yellow-400 rounded-lg sm:rounded-xl overflow-hidden shadow-[0_0_50px_rgba(234,179,8,1)] ring-2 ring-yellow-400 bg-black">
            <img src={flungCard.image} className="w-full h-full object-contain bg-black" />
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 w-3.5 h-3.5 sm:w-6 sm:h-6 bg-black/70 rounded-full p-0.5 sm:p-1 shadow-md border border-white/20">
              <img src={ELEMENT_ICONS[flungCard.element]} className="w-full h-full object-contain" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent p-1 sm:p-2 pt-2.5 sm:pt-6 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[6px] sm:text-[8px] font-black text-yellow-500">ATK</span>
                <span className="text-[10px] sm:text-sm font-black text-white">{flungCard?.attack ?? 0}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[6px] sm:text-[8px] font-black text-blue-400">DEF</span>
                <span className="text-[10px] sm:text-sm font-black text-white">{flungCard?.defense ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Battle Chronicle Side Drawer - Always visible & accessible after versus clash */}
      <div className={`fixed inset-y-0 left-0 z-[500] flex items-center transition-transform duration-500 pointer-events-auto ${isLogOpen ? 'translate-x-0' : '-translate-x-[220px] sm:-translate-x-[270px]'}`}>
        <div className="h-[62%] sm:h-[68%] w-[220px] sm:w-[270px] bg-neutral-950/95 backdrop-blur-xl border-r border-yellow-600/50 shadow-[0_0_40px_rgba(0,0,0,0.9)] p-3 sm:p-4 flex flex-col rounded-r-2xl">
          <div className="border-b border-yellow-600/30 pb-2 mb-2 sm:mb-3 shrink-0">
            <div className="flex items-center justify-between">
              <h4 className="text-[9px] sm:text-[10px] font-black uppercase text-yellow-400 tracking-[0.2em]">Battle Chronicle</h4>
              <span className="text-[7px] font-bold text-yellow-500/70 uppercase tracking-wider">Live Log</span>
            </div>
            <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white/80 truncate mt-1">
              <span className="text-yellow-300">
                {isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter1.name : (playerName || 'Player')}
              </span>
              <span className="text-yellow-500 font-black mx-1.5">VS</span>
              <span className="text-red-400">
                {isSpectatingTournamentAi && activeTournamentMatch ? activeTournamentMatch.fighter2.name : (gameState.currentOpponentName || 'Opponent')}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 space-y-2">
            {gameState.battleLog.map((log, i) => {
              const oppDisplayName = isSpectatingTournamentAi && activeTournamentMatch 
                ? activeTournamentMatch.fighter2.name 
                : (gameState.currentOpponentName || 'Opponent');
              const sanitizedLog = log
                .replace(/AI\.\s*Core/gi, oppDisplayName)
                .replace(/AI\s*Core/gi, oppDisplayName)
                .replace(/AI\./gi, oppDisplayName);
              return (
                <div key={i} className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-white/90 leading-tight">
                  <span className="text-yellow-500/70 mr-1 font-black">»</span> {sanitizedLog}
                </div>
              );
            })}
          </div>

          {/* Chronicle Actions: Audio Controls (Volume & Mute) & Forfeit/Exit */}
          <div className="mt-2.5 pt-2.5 border-t border-yellow-600/30 flex flex-col gap-2 shrink-0">
            {/* Volume Slider & Mute Toggle */}
            <div className="flex flex-col gap-1.5 bg-black/70 p-2 rounded-xl border border-yellow-600/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" /> : <Volume2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  <span className="text-[9px] font-black uppercase tracking-wider text-yellow-300">Sound</span>
                </div>
                <button
                  onClick={toggleMute}
                  className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    isMuted 
                      ? 'bg-red-950/80 text-red-400 border border-red-700/50 hover:bg-red-900/80' 
                      : 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-900/80'
                  }`}
                  title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                >
                  {isMuted ? 'MUTED' : `${gameVolume}%`}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : gameVolume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                title={`Game Volume: ${gameVolume}%`}
              />
            </div>

            {/* Forfeit Battle / Leave Match */}
            <button 
              onClick={() => {
                setIsLogOpen(false);
                setIsClashing(false);
                setClashStage('none');
                stopBackgroundMusic();
                if (activeTournamentMatch) {
                  if (!isSpectatingTournamentAi && tournamentState) {
                    const opp = activeTournamentMatch.fighter1.isPlayer ? activeTournamentMatch.fighter2 : activeTournamentMatch.fighter1;
                    const updated = advanceTournamentMatch(tournamentState, activeTournamentMatch.id, opp);
                    setTournamentState(updated);
                  }
                  setActiveTournamentMatch(null);
                  setIsSpectatingTournamentAi(false);
                  setCurrentScreen('tournament');
                } else {
                  setCurrentScreen('menu');
                }
              }} 
              className="w-full py-2 px-2.5 bg-red-950/85 hover:bg-red-900 rounded-xl border border-red-700/70 text-red-200 hover:text-white uppercase text-[9px] font-black tracking-widest transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-red-300 shrink-0" />
              <span>{activeTournamentMatch ? 'Leave Match' : 'Forfeit Battle'}</span>
            </button>
          </div>
        </div>

        {/* Tab Toggle Button */}
        <button 
          onClick={() => setIsLogOpen(!isLogOpen)}
          className="bg-black/85 hover:bg-yellow-950/80 backdrop-blur-md border border-l-0 border-yellow-500/50 p-2 sm:p-2.5 rounded-r-xl text-yellow-400 flex flex-col items-center gap-1.5 transition-all group shadow-[0_0_25px_rgba(0,0,0,0.85)] cursor-pointer select-none"
          title="Toggle Battle Chronicle"
        >
          <img 
            src={ASSETS.ARROW} 
            className={`w-3.5 sm:w-5 h-auto transition-transform duration-500 ${isLogOpen ? 'rotate-180' : 'rotate-0'}`} 
            alt="Toggle Log"
          />
          <span className="[writing-mode:vertical-lr] text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] group-hover:tracking-[0.35em] transition-all">Chronicle</span>
        </button>
      </div>

      {/* Shared Modals (Rune Treasury, Mode Selection, Multiplayer Lobby, 3D Cards) */}
      {renderSharedModals()}

      {/* Multiplayer Disconnect / Auto-Pause Banner */}
      {isMultiplayerPaused && (currentScreen === 'playing' || currentScreen === 'tournament') && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 border-2 border-yellow-500/70 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 animate-pulse">
              <Pause className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-yellow-300 uppercase tracking-wider">Duel Paused</h3>
              <p className="text-xs text-neutral-300 mt-1">{multiplayerPauseReason || 'Connection with challenger interrupted'}</p>
              <p className="text-[10px] text-neutral-400 mt-2">Waiting for automatic peer reconnection...</p>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={() => setIsMultiplayerPaused(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/40 text-yellow-300 text-xs font-black uppercase tracking-wider transition-all"
              >
                Resume
              </button>
              <button
                onClick={() => {
                  setIsMultiplayerPaused(false);
                  setIsMultiplayerActive(false);
                  setCurrentScreen('menu');
                  multiplayerService.disconnect();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 text-xs font-black uppercase tracking-wider transition-all"
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
