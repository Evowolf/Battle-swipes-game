import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, DeckBoxSkin, Element, CardSleeve, Rarity, CardType } from '../../types';
import { ASSETS, SOUNDS, ELEMENT_ICONS } from '../../constants';
import { RARITY_CONFIGS } from '../utils/rarity';
import { SolidDeckBox3D } from './DeckBox3D';
import { Zap, FastForward, Swords, Shield, Sparkles } from 'lucide-react';

interface ArenaDeckDeployAndDrawProps {
  playerSkin: DeckBoxSkin;
  playerDeckCards: Card[];
  cardsToDraw?: Card[];
  totalNeeded?: number;
  activeSleeve?: CardSleeve;
  activeSleeveImage?: string;
  autoDrawInitial?: boolean;
  onAutoDrawChange?: (enabled: boolean) => void;
  playSound: (soundUrl: string) => void;
  isMuted?: boolean;
  onComplete: () => void;
}

interface FlyingCardInstance {
  id: number;
  card: Card;
  startX: number;
  startY: number;
  startRotZ: number;
  targetX: number;
  targetRotZ: number;
}

export const ArenaDeckDeployAndDraw: React.FC<ArenaDeckDeployAndDrawProps> = ({
  playerSkin,
  playerDeckCards = [],
  cardsToDraw,
  totalNeeded = 5,
  activeSleeve,
  activeSleeveImage,
  autoDrawInitial,
  onAutoDrawChange,
  playSound,
  onComplete,
}) => {
  // Phases:
  // 1. 'box-drop'     : Player's 3D deck box drops down onto the altar pedestal
  // 2. 'box-open'     : Deck box lid opens smoothly
  // 3. 'cards-deploy' : Full deck stack emerges from the box with whooshing sound onto the altar
  // 4. 'box-exit'     : Empty deck box elevates into distance, leaving deck stack on altar
  // 5. 'deck-shuffle' : Cards split into packets, riffle together with authentic card shuffle sound, and square up
  // 6. 'draw-hand'    : Fluid, smooth opening hand draw phase with authentic card drawing sound
  const [phase, setPhase] = useState<
    'box-drop' | 'box-open' | 'cards-deploy' | 'box-exit' | 'deck-shuffle' | 'draw-hand'
  >('box-drop');

  const [isBoxOpen, setIsBoxOpen] = useState(false);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [isBoxExiting, setIsBoxExiting] = useState(false);
  const [deployedCardsCount, setDeployedCardsCount] = useState(0);

  // Draw Phase states
  const [drawnCards, setDrawnCards] = useState<Card[]>([]);
  const [flyingCards, setFlyingCards] = useState<FlyingCardInstance[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  // Auto-draw state
  const [autoDraw, setAutoDraw] = useState<boolean>(() => {
    if (autoDrawInitial !== undefined) return autoDrawInitial;
    try {
      return localStorage.getItem('battle_swipes_auto_draw') === 'true';
    } catch {
      return false;
    }
  });

  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isFlickingRef = useRef(false);
  const autoDrawTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shuffleTimersRef = useRef<NodeJS.Timeout[]>([]);

  const currentDrawnCount = drawnCards.length;
  const isAllDrawn = currentDrawnCount >= totalNeeded;

  const drawnCountRef = useRef(currentDrawnCount);
  drawnCountRef.current = currentDrawnCount;
  const isFinishingRef = useRef(isFinishing);
  isFinishingRef.current = isFinishing;
  const autoDrawRef = useRef(autoDraw);
  autoDrawRef.current = autoDraw;

  // Full 20-card deck list
  const totalDeckSize = 20;
  const cardsToDeploy: Card[] = React.useMemo(() => {
    if (playerDeckCards.length >= totalDeckSize) {
      return playerDeckCards.slice(0, totalDeckSize);
    }
    const padded = [...playerDeckCards];
    while (padded.length < totalDeckSize) {
      padded.push(playerDeckCards[padded.length % Math.max(1, playerDeckCards.length)] || {
        id: `arena-card-${padded.length}`,
        name: `Deck Card ${padded.length + 1}`,
        element: Element.FIRE,
        type: CardType.SWORD,
        attack: 10,
        defense: 10,
        image: activeSleeveImage || ASSETS.CARD_TEMPLATE,
        rarity: Rarity.COMMON,
        description: 'Battle Deck Card',
      });
    }
    return padded;
  }, [playerDeckCards, activeSleeveImage]);

  const sleeveSrc = activeSleeveImage || (activeSleeve?.id === 'default' ? ASSETS.CARD_TEMPLATE : activeSleeve?.image) || ASSETS.CARD_TEMPLATE;

  // Deck Split & Riffle Shuffle Sequence (Dedicated ~3.2s flow with authentic Card shuffling.mp3)
  const startShuffleSequence = useCallback(() => {
    const timers: NodeJS.Timeout[] = [];

    // Play user's authentic Card shuffling sound right as cards split & shuffle together!
    playSound(SOUNDS.CARD_SHUFFLE);
    try {
      const directAudio = new Audio(SOUNDS.CARD_SHUFFLE);
      directAudio.volume = 1.0;
      directAudio.play().catch(() => {});
    } catch {}

    // Transition smoothly to interactive opening hand draw phase at 3200ms
    timers.push(
      setTimeout(() => {
        setPhase('draw-hand');
      }, 3200)
    );

    shuffleTimersRef.current = timers;
  }, [playSound]);

  // Deployment Animation Timeline
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    // 1. Box drop impact onto altar at 450ms
    timeouts.push(
      setTimeout(() => {
        setIsScreenShaking(true);
        setTimeout(() => setIsScreenShaking(false), 120);
      }, 450)
    );

    // 2. Box lid opening smoothly at 750ms
    timeouts.push(
      setTimeout(() => {
        setPhase('box-open');
        setIsBoxOpen(true);
      }, 750)
    );

    // 3. Full card stack comes out of the box at 1100ms WITH WHOOSHING SOUND!
    timeouts.push(
      setTimeout(() => {
        setPhase('cards-deploy');
        // Whooshing sound for cards coming out of the box!
        playSound(SOUNDS.WOOSHING);
      }, 1100)
    );

    // 4. Box ascends into the background sky at 1950ms
    timeouts.push(
      setTimeout(() => {
        setDeployedCardsCount(totalDeckSize);
        setPhase('box-exit');
        setIsBoxExiting(true);
      }, 1950)
    );

    // 5. Card shuffle begins smoothly as deck rests on altar at 2450ms
    timeouts.push(
      setTimeout(() => {
        setPhase('deck-shuffle');
        startShuffleSequence();
      }, 2450)
    );

    return () => {
      timeouts.forEach(t => clearTimeout(t));
      shuffleTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, [playSound, totalDeckSize, startShuffleSequence]);

  // Fluid & Smooth Card Draw Logic
  const drawCard = useCallback((isAuto: boolean = false, customStartX?: number, customStartY?: number, customRotZ?: number) => {
    const nextIndex = drawnCountRef.current;
    if (nextIndex >= totalNeeded || isFinishingRef.current) return false;
    if (!isAuto && isFlickingRef.current) return false;

    isFlickingRef.current = true;
    const sourceCards = cardsToDraw && cardsToDraw.length >= totalNeeded
      ? cardsToDraw
      : cardsToDeploy.slice(0, totalNeeded);
    const nextCard: Card = sourceCards[nextIndex] || {
      id: `drawn-${nextIndex}-${Date.now()}`,
      name: `Elemental Ally ${nextIndex + 1}`,
      element: Element.FIRE,
      type: CardType.SWORD,
      attack: 25,
      defense: 20,
      image: sleeveSrc,
      rarity: Rarity.COMMON,
      description: 'Opening hand draw.',
    };

    // Authentic Card drawing sound!
    playSound(SOUNDS.CARD_DRAW);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } catch {}

    const startX = customStartX !== undefined ? customStartX : dragX;
    const startY = customStartY !== undefined ? customStartY : dragY;
    const startRotZ = customRotZ !== undefined ? customRotZ : (startX * 0.12);

    const slotSpacing = typeof window !== 'undefined' && window.innerWidth < 640 ? 68 : 88;
    const targetSlotX = (nextIndex - 2) * slotSpacing;
    const targetSlotRot = (nextIndex - 2) * 2;

    const flyInstance: FlyingCardInstance = {
      id: Date.now() + Math.random(),
      card: nextCard,
      startX,
      startY,
      startRotZ,
      targetX: targetSlotX,
      targetRotZ: targetSlotRot,
    };

    setFlyingCards(prev => [...prev, flyInstance]);
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
    setShowSwipeHint(false);

    // Card touches down smoothly in hand slot after completing 3D flip-around (520ms)
    setTimeout(() => {
      setDrawnCards(prev => [...prev, nextCard]);
    }, 520);

    // Release flick lock early (320ms) for responsive, fluid sequential drawing
    setTimeout(() => {
      isFlickingRef.current = false;
    }, 320);

    // Smooth graceful flight cleanup (580ms)
    setTimeout(() => {
      setFlyingCards(prev => prev.filter(f => f.id !== flyInstance.id));
    }, 580);

    // If final card drawn, commence duel smoothly
    if (nextIndex + 1 >= totalNeeded) {
      isFinishingRef.current = true;
      setIsFinishing(true);
      setTimeout(() => {
        playSound(SOUNDS.CARD_SWIPE);
      }, 480);
      setTimeout(() => {
        onComplete();
      }, 820);
    }
    return true;
  }, [totalNeeded, cardsToDraw, cardsToDeploy, sleeveSrc, dragX, dragY, playSound, onComplete]);

  // Fast-Forward / Skip Draw button
  const handleSkipDraw = useCallback(() => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    setIsFinishing(true);
    isFlickingRef.current = true;

    if (autoDrawTimeoutRef.current) clearTimeout(autoDrawTimeoutRef.current);
    shuffleTimersRef.current.forEach(t => clearTimeout(t));

    const sourceCards = cardsToDraw && cardsToDraw.length >= totalNeeded
      ? cardsToDraw
      : cardsToDeploy.slice(0, totalNeeded);
    setDrawnCards(sourceCards.slice(0, totalNeeded));
    setFlyingCards([]);
    setDragX(0);
    setDragY(0);

    playSound(SOUNDS.CARD_SWIPE);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 40]);
      }
    } catch {}

    setTimeout(() => {
      onComplete();
    }, 350);
  }, [cardsToDraw, totalNeeded, cardsToDeploy, playSound, onComplete]);

  // Auto-draw runner: fluid pacing
  useEffect(() => {
    if (phase !== 'draw-hand' || !autoDraw || isAllDrawn || isFinishing) {
      if (autoDrawTimeoutRef.current) {
        clearTimeout(autoDrawTimeoutRef.current);
        autoDrawTimeoutRef.current = null;
      }
      return;
    }

    const delay = currentDrawnCount === 0 ? 300 : 580;
    autoDrawTimeoutRef.current = setTimeout(() => {
      if (!autoDrawRef.current || isFinishingRef.current || drawnCountRef.current >= totalNeeded) {
        return;
      }
      drawCard(true, 0, -15, 0);
    }, delay);

    return () => {
      if (autoDrawTimeoutRef.current) {
        clearTimeout(autoDrawTimeoutRef.current);
        autoDrawTimeoutRef.current = null;
      }
    };
  }, [phase, autoDraw, currentDrawnCount, totalNeeded, isFinishing, isAllDrawn, drawCard]);

  // Toggle Auto-Draw
  const handleToggleAutoDraw = (checked: boolean) => {
    setAutoDraw(checked);
    onAutoDrawChange?.(checked);
    try {
      localStorage.setItem('battle_swipes_auto_draw', checked ? 'true' : 'false');
    } catch {}
  };

  // Drag handlers for flicking cards up
  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== 'draw-hand' || isAllDrawn || isFinishing || isFlickingRef.current) return;
    setShowSwipeHint(false);
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    setIsDragging(true);
    setDragX(0);
    setDragY(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !pointerStartRef.current || isAllDrawn || isFinishing) return;
    const dy = e.clientY - pointerStartRef.current.y;
    const dx = e.clientX - pointerStartRef.current.x;

    if (dy < 0) {
      setDragY(Math.max(-80, dy));
      setDragX(Math.max(-40, Math.min(40, dx * 0.4)));

      if (dy < -48) {
        const currentX = Math.max(-40, Math.min(40, dx * 0.4));
        const currentY = Math.max(-80, dy);
        const currentRot = currentX * 0.15;
        pointerStartRef.current = null;
        drawCard(false, currentX, currentY, currentRot);
      }
    } else {
      setDragY(dy * 0.15);
      setDragX(dx * 0.15);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || !pointerStartRef.current) {
      setIsDragging(false);
      setDragX(0);
      setDragY(0);
      return;
    }

    const dy = e.clientY - pointerStartRef.current.y;
    const dx = e.clientX - pointerStartRef.current.x;
    const dt = Date.now() - pointerStartRef.current.time;
    const upwardVelocity = (pointerStartRef.current.y - e.clientY) / (dt || 1);

    const curX = dragX;
    const curY = dragY;
    const curRot = dragX * 0.15;

    pointerStartRef.current = null;
    setIsDragging(false);

    if (dy < -16 || upwardVelocity > 0.22 || (Math.abs(dy) < 12 && Math.abs(dx) < 12 && dt < 280)) {
      drawCard(false, curX, curY, curRot);
    } else {
      setDragX(0);
      setDragY(0);
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
  };

  const currentRotX = Math.min(28, Math.max(0, -dragY * 0.35));
  const currentRotZ = Math.max(-16, Math.min(16, dragX * 0.15 + dragY * 0.04));

  return (
    <div
      className={`absolute inset-0 z-40 overflow-hidden select-none flex flex-col items-center justify-between pointer-events-none transition-opacity duration-500 ${
        isFinishing ? 'opacity-0' : 'opacity-100'
      } ${isScreenShaking ? 'animate-clash-shake' : ''}`}
    >
      <style>{`
        /* 3D Box Drop from sky onto altar */
        @keyframes boxDropFromSky {
          0% {
            transform: translate3d(0, -95vh, 120px) rotateX(-50deg) rotateY(15deg) scale3d(0.7, 0.7, 0.7);
            opacity: 0;
          }
          60% {
            transform: translate3d(0, 15px, 0px) rotateX(12deg) rotateY(-3deg) scale3d(1.04, 1.04, 1.04);
            opacity: 1;
          }
          82% {
            transform: translate3d(0, -8px, 0px) rotateX(-6deg) rotateY(1deg) scale3d(0.98, 0.98, 0.98);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 0px, 0px) rotateX(0deg) scale3d(1, 1, 1);
            opacity: 1;
          }
        }

        /* Box tilts back at negative Z to reveal cavity without front lip clipping cards */
        @keyframes boxTiltDownAndReveal {
          0% {
            transform: translate3d(0, 0px, -45px) rotateX(0deg) scale3d(1, 1, 1);
          }
          40% {
            transform: translate3d(0, -6px, -45px) rotateX(-20deg) scale3d(1.04, 1.04, 1.04);
          }
          100% {
            transform: translate3d(0, 10px, -45px) rotateX(-14deg) scale3d(1, 1, 1);
          }
        }

        /* Box ascends into distant sky */
        @keyframes boxExitFlyUp {
          0% {
            transform: translate3d(0, 10px, -45px) rotateX(-14deg) scale3d(1, 1, 1);
            opacity: 1;
          }
          20% {
            transform: translate3d(0, 45px, -240px) rotateX(-8deg) scale3d(0.92, 0.92, 0.92);
            opacity: 0.95;
          }
          45% {
            transform: translate3d(0, 25px, -420px) rotateX(6deg) scale3d(0.76, 0.76, 0.76);
            opacity: 0.85;
          }
          75% {
            transform: translate3d(0, -45vh, -560px) rotateX(20deg) scale3d(0.45, 0.45, 0.45);
            opacity: 0.45;
          }
          100% {
            transform: translate3d(0, -125vh, -700px) rotateX(28deg) scale3d(0.2, 0.2, 0.2);
            opacity: 0;
          }
        }

        /* FULL DECK STACK EMERGES CONTINUOUSLY OUT OF BOX CAVITY */
        @keyframes fullStackDeployFromBox {
          0% {
            transform: translate3d(0, -75px, 85px) rotateX(-10deg) scale3d(0.95, 0.95, 0.95);
            opacity: 1;
          }
          22% {
            transform: translate3d(0, -150px, 115px) rotateX(-5deg) scale3d(1.0, 1.0, 1.0);
            opacity: 1;
          }
          48% {
            transform: translate3d(0, -195px, 135px) rotateX(0deg) scale3d(1.05, 1.05, 1.05);
            opacity: 1;
          }
          75% {
            transform: translate3d(0, -35px, 145px) rotateX(4deg) scale3d(1.02, 1.02, 1.02);
            opacity: 1;
          }
          90% {
            transform: translate3d(0, 25px, 142px) rotateX(1deg) scale3d(1.01, 1.01, 1.01);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 45px, 140px) rotateX(0deg) scale3d(1, 1, 1);
            opacity: 1;
          }
        }

        /* CARD SHUFFLE ANIMATION (Tactile split, visible interleaving riffle, square-up) */
        @keyframes shuffleStackCutLeft {
          0% {
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 1;
          }
          15% {
            /* Cuts cleanly to the left */
            transform: translate3d(-135px, -6px, 8px) rotateZ(-5deg);
            opacity: 1;
          }
          70% {
            transform: translate3d(-135px, -6px, 8px) rotateZ(-5deg);
            opacity: 1;
          }
          88% {
            /* Glides into center as shuffle completes */
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 0.3;
          }
          100% {
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 0;
          }
        }

        @keyframes shuffleStackCutRight {
          0% {
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 1;
          }
          15% {
            /* Cuts cleanly to the right */
            transform: translate3d(135px, -6px, 8px) rotateZ(5deg);
            opacity: 1;
          }
          70% {
            transform: translate3d(135px, -6px, 8px) rotateZ(5deg);
            opacity: 1;
          }
          88% {
            /* Glides into center as shuffle completes */
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 0.3;
          }
          100% {
            transform: translate3d(0, 0, 0) rotateZ(0deg);
            opacity: 0;
          }
        }

        @keyframes shuffleCardWeaveLeft {
          0% {
            transform: translate3d(-135px, -6px, 10px) rotateZ(-5deg);
            opacity: 0.95;
          }
          35% {
            /* Arches upward into center */
            transform: translate3d(-50px, -24px, 28px) rotateZ(-3deg);
            opacity: 1;
          }
          70% {
            /* Slides smoothly into center stack */
            transform: translate3d(var(--fan-x, 0px), var(--fan-y, 0px), var(--card-z, 0px)) rotateZ(var(--fan-rot, -2deg));
            opacity: 1;
          }
          88%, 100% {
            /* Squares cleanly into center deck */
            transform: translate3d(0, 0, var(--card-z, 0px)) rotateZ(0deg);
            opacity: 1;
          }
        }

        @keyframes shuffleCardWeaveRight {
          0% {
            transform: translate3d(135px, -6px, 10px) rotateZ(5deg);
            opacity: 0.95;
          }
          35% {
            /* Arches upward into center */
            transform: translate3d(50px, -24px, 28px) rotateZ(3deg);
            opacity: 1;
          }
          70% {
            /* Slides smoothly into center stack */
            transform: translate3d(var(--fan-x, 0px), var(--fan-y, 0px), var(--card-z, 0px)) rotateZ(var(--fan-rot, 2deg));
            opacity: 1;
          }
          88%, 100% {
            /* Squares cleanly into center deck */
            transform: translate3d(0, 0, var(--card-z, 0px)) rotateZ(0deg);
            opacity: 1;
          }
        }

        @keyframes centerDeckGlowPulse {
          0%, 75% {
            opacity: 0;
            transform: scale(0.98);
          }
          85% {
            opacity: 1;
            transform: scale(1.03);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* High-Impact 3D Card Draw: Smooth, continuous aerodynamic arc into player hand */
        @keyframes cardDrawUpFlipAndPlace {
          0% {
            transform: translate3d(var(--start-x, 0px), calc(var(--start-y, 0px) + 20px), 60px) rotateZ(var(--start-rot, 0deg)) scale(0.95);
            opacity: 1;
          }
          40% {
            /* Smooth graceful lift toward player */
            transform: translate3d(calc(var(--target-x, 0px) * 0.45), -90px, 200px) rotateZ(calc(var(--target-rot, 0deg) * 0.4)) scale(1.18);
            opacity: 1;
          }
          100% {
            /* Drops directly into player hand slot with smooth decelerating curve */
            transform: translate3d(var(--target-x, 0px), calc(34vh + 15px), 25px) rotateZ(var(--target-rot, 0deg)) scale(0.76);
            opacity: 0.96;
          }
        }

        /* 3D Flip Around Rotation: Continuous silky smooth 180-degree flip */
        @keyframes cardInnerFlipAround {
          0% {
            transform: rotateY(0deg);
          }
          20% {
            transform: rotateY(0deg);
          }
          80% {
            transform: rotateY(180deg);
          }
          100% {
            transform: rotateY(180deg);
          }
        }

        /* Gentle Hand Slot Receive Bounce */
        @keyframes handSlotReceive {
          0% {
            transform: scale(1.08) translateY(-6px);
          }
          100% {
            transform: scale(1) translateY(0);
          }
        }
        .animate-hand-slot-receive {
          animation: handSlotReceive 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes clashShake {
          0%, 100% { transform: translate(0, 0); }
          15% { transform: translate(-6px, 5px); }
          30% { transform: translate(5px, -5px); }
          45% { transform: translate(-4px, 3px); }
          60% { transform: translate(4px, -2px); }
        }
        .animate-clash-shake {
          animation: clashShake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      {/* Top Floating Controls: Status & Skip Draw */}
      <div className="relative z-50 w-full flex items-center justify-between px-3 sm:px-8 pt-14 sm:pt-16 pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/40 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
          <span className="text-[9px] sm:text-xs font-black uppercase tracking-[0.16em] text-yellow-300">
            {phase === 'box-drop' || phase === 'box-open'
              ? 'DECK BOX LANDING'
              : phase === 'cards-deploy'
              ? 'DEPLOYING DECK'
              : phase === 'box-exit'
              ? 'VAULT READY'
              : phase === 'deck-shuffle'
              ? 'SHUFFLING DECK'
              : `DRAW OPENING HAND (${currentDrawnCount}/${totalNeeded})`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSkipDraw}
            className="px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black/95 text-yellow-300 border border-yellow-500/50 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-all active:scale-95 hover:border-yellow-400"
          >
            <FastForward className="w-3.5 h-3.5 text-yellow-400" />
            <span>SKIP DRAW</span>
          </button>
        </div>
      </div>

      {/* Center Stage: Altar Pedestal, 3D Deck Box, Full Stack Emergence & Card Draw */}
      <div
        className="relative w-full flex-1 flex flex-col items-center justify-center my-auto"
        style={{
          perspective: '1200px',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Draw Instructions & Glowing Pips */}
        {phase === 'draw-hand' && (
          <div className="flex flex-col items-center text-center -mt-8 mb-3 z-30 pointer-events-none animate-in fade-in duration-300">
            <h2 className="text-sm sm:text-lg font-black uppercase tracking-[0.2em] text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">
              Draw Opening Hand
            </h2>
            <span className="text-[9.5px] sm:text-xs font-bold tracking-wider text-yellow-200/80 uppercase mt-0.5">
              {isAllDrawn
                ? 'Battle Hand Ready!'
                : autoDraw
                ? `Drawing cards... (${currentDrawnCount} / ${totalNeeded})`
                : `${currentDrawnCount} / ${totalNeeded} Cards Drawn`}
            </span>
            <div className="flex items-center gap-2 sm:gap-2.5 mt-1.5">
              {Array.from({ length: totalNeeded }).map((_, i) => {
                const isFilled = i < currentDrawnCount;
                return (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border-2 transition-all duration-300 ${
                      isFilled
                        ? 'bg-yellow-400 border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,1)] scale-110'
                        : 'bg-black/60 border-yellow-600/40 opacity-50 scale-95'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* 3D Altar Pedestal Base */}
        <div
          className="relative flex items-center justify-center my-auto transition-all duration-600 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            opacity: isFinishing ? 0 : 1,
            transform: isFinishing ? 'scale(0.7) translateY(40px)' : 'scale(1) translateY(0)',
          }}
        >
          {/* Altar Rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] sm:w-[380px] h-[260px] sm:h-[380px] rounded-full border-2 border-yellow-500/30 pointer-events-none [transform:rotateX(72deg)] shadow-[0_0_60px_rgba(234,179,8,0.35)] bg-gradient-to-t from-yellow-950/30 to-black/80" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] sm:w-[320px] h-[220px] sm:h-[320px] rounded-full border border-dashed border-yellow-400/40 pointer-events-none [transform:rotateX(72deg)] animate-spin-slow" />

          {/* 1. PLAYER'S 3D DECK BOX */}
          {(phase === 'box-drop' || phase === 'box-open' || phase === 'cards-deploy' || phase === 'box-exit') && (
            <div
              className="relative will-change-transform z-20"
              style={{
                width: '160px',
                height: '120px',
                transformStyle: 'preserve-3d',
                animation: isBoxExiting
                  ? 'boxExitFlyUp 0.72s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards'
                  : isBoxOpen
                  ? 'boxTiltDownAndReveal 0.62s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                  : 'boxDropFromSky 0.85s cubic-bezier(0.2, 0.9, 0.3, 1.25) forwards',
              }}
            >
              <div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[180px] h-[26px] rounded-full blur-xl bg-black/90 pointer-events-none transition-transform duration-500"
                style={{
                  transform: isBoxOpen ? 'scale(1.15) translateY(4px)' : 'scale(1)',
                }}
              />

              <div style={{ transformStyle: 'preserve-3d' }}>
                <SolidDeckBox3D
                  skin={playerSkin}
                  isOpen={isBoxOpen}
                  deckCards={cardsToDeploy}
                  showInsideCards={!isBoxExiting && deployedCardsCount === 0 && phase !== 'cards-deploy'}
                />
              </div>

              {isBoxOpen && !isBoxExiting && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-300">
                  <div className="w-24 h-36 bg-gradient-to-t from-yellow-400/40 via-yellow-200/20 to-transparent blur-md -translate-y-14 rounded-full" />
                </div>
              )}
            </div>
          )}

          {/* 2. FULL DECK STACK EMERGING OUT OF DECK BOX (WITH WHOOSHING SOUND!) */}
          {phase === 'cards-deploy' && deployedCardsCount === 0 && (
            <div
              className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center"
              style={{
                transformStyle: 'preserve-3d',
                transform: 'translateZ(90px)',
              }}
            >
              <div
                className="relative w-[130px] sm:w-[155px] aspect-[640/880] will-change-transform"
                style={{
                  transformStyle: 'preserve-3d',
                  animation: 'fullStackDeployFromBox 0.95s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                }}
              >
                {Array.from({ length: 8 }).map((_, idx) => {
                  const zOffset = -(idx + 1) * 2.5;
                  const yOffset = (idx + 1) * 1.8;
                  return (
                    <div
                      key={`emerging-layer-${idx}`}
                      className="absolute inset-0 rounded-xl border border-amber-900/80 bg-[#120e0a] shadow-md pointer-events-none"
                      style={{
                        transform: `translateZ(${zOffset}px) translateY(${yOffset}px)`,
                      }}
                    >
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-900 via-yellow-600 to-amber-900 rounded-b-xl opacity-60" />
                    </div>
                  );
                })}
                <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.9)] bg-black">
                  <img
                    src={sleeveSrc}
                    alt="Full Deck Stack"
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                  <div className="absolute inset-0 bg-yellow-400/20 mix-blend-overlay" />
                </div>
              </div>
            </div>
          )}

          {/* 2b. FULL DECK STACK RESTING ON ALTAR AFTER DEPLOYMENT AND DURING BOX EXIT */}
          {(phase === 'box-exit' || (phase === 'cards-deploy' && deployedCardsCount > 0)) && (
            <div
              className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center"
              style={{
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                className="relative w-[130px] sm:w-[155px] aspect-[640/880]"
                style={{
                  transform: 'translate3d(0, 45px, 140px)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {Array.from({ length: 8 }).map((_, idx) => {
                  const zOffset = -(idx + 1) * 2.5;
                  const yOffset = (idx + 1) * 1.8;
                  return (
                    <div
                      key={`resting-layer-${idx}`}
                      className="absolute inset-0 rounded-xl border border-amber-900/80 bg-[#120e0a] shadow-md pointer-events-none"
                      style={{
                        transform: `translateZ(${zOffset}px) translateY(${yOffset}px)`,
                      }}
                    >
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-900 via-yellow-600 to-amber-900 rounded-b-xl opacity-60" />
                    </div>
                  );
                })}
                <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.5)] bg-black">
                  <img
                    src={sleeveSrc}
                    alt="Resting Deck Stack"
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. TACTILE, PROMINENT DECK SHUFFLE SEQUENCE (Splits in two, riffles together, and squares up with Card shuffling.mp3) */}
          {phase === 'deck-shuffle' && (
            <div
              className="relative flex items-center justify-center z-40"
              style={{
                transform: 'translate3d(0, 45px, 140px)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Left Cut Stack */}
              <div
                className="absolute w-[125px] sm:w-[145px] aspect-[640/880] will-change-transform z-10"
                style={{
                  animation: 'shuffleStackCutLeft 2.8s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                }}
              >
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={`left-cut-base-${idx}`}
                    className="absolute inset-0 rounded-xl border border-amber-900/80 bg-[#120e0a]"
                    style={{
                      transform: `translateZ(-${(idx + 1) * 3}px) translateY(${(idx + 1) * 1.5}px)`,
                    }}
                  />
                ))}
                <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.7)] bg-black">
                  <img src={sleeveSrc} alt="Shuffle Left Cut" className="w-full h-full object-contain pointer-events-none select-none" />
                </div>
              </div>

              {/* Right Cut Stack */}
              <div
                className="absolute w-[125px] sm:w-[145px] aspect-[640/880] will-change-transform z-10"
                style={{
                  animation: 'shuffleStackCutRight 2.8s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                }}
              >
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={`right-cut-base-${idx}`}
                    className="absolute inset-0 rounded-xl border border-amber-900/80 bg-[#120e0a]"
                    style={{
                      transform: `translateZ(-${(idx + 1) * 3}px) translateY(${(idx + 1) * 1.5}px)`,
                    }}
                  />
                ))}
                <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.7)] bg-black">
                  <img src={sleeveSrc} alt="Shuffle Right Cut" className="w-full h-full object-contain pointer-events-none select-none" />
                </div>
              </div>

              {/* Interleaving Riffle Cards */}
              {Array.from({ length: 8 }).map((_, i) => {
                const isLeft = i % 2 === 0;
                const delay = 0.35 + (i * 0.12);
                const cardZ = (i + 1) * 2.4;
                const fanRot = isLeft ? (-2.5 + i * 0.35) : (2.5 - i * 0.35);
                const fanX = isLeft ? (-10 + i * 2.5) : (10 - i * 2.5);
                const fanY = (i - 3.5) * 1.2;

                return (
                  <div
                    key={`interleave-card-${i}`}
                    className="absolute w-[125px] sm:w-[145px] aspect-[640/880] rounded-xl overflow-hidden border-2 border-yellow-300 shadow-md bg-black pointer-events-none will-change-transform"
                    style={{
                      zIndex: 20 + i,
                      ['--card-z' as string]: `${cardZ}px`,
                      ['--fan-rot' as string]: `${fanRot}deg`,
                      ['--fan-x' as string]: `${fanX}px`,
                      ['--fan-y' as string]: `${fanY}px`,
                      animation: `${isLeft ? 'shuffleCardWeaveLeft' : 'shuffleCardWeaveRight'} 1.85s cubic-bezier(0.25, 0.9, 0.35, 1) ${delay}s both`,
                    }}
                  >
                    <img src={sleeveSrc} alt="Weaving Card" className="w-full h-full object-contain select-none" />
                  </div>
                );
              })}

              {/* Final Ready Deck Stack */}
              <div
                className="absolute w-[125px] sm:w-[145px] aspect-[640/880] rounded-xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_35px_rgba(250,204,21,0.95)] bg-black pointer-events-none z-30"
                style={{
                  animation: 'centerDeckGlowPulse 2.8s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                }}
              >
                <img src={sleeveSrc} alt="Squared Deck" className="w-full h-full object-contain select-none" />
              </div>
            </div>
          )}

          {/* 4. INTERACTIVE 3D DRAW DECK */}
          {phase === 'draw-hand' && !isAllDrawn && (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              className="relative w-[150px] sm:w-[185px] aspect-[640/880] select-none touch-none cursor-grab active:cursor-grabbing z-40 pointer-events-auto"
              style={{
                transform: 'translate3d(0, 45px, 140px)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Stack Depth Layers */}
              {Array.from({ length: 8 }).map((_, idx) => {
                const zOffset = -(idx + 1) * 2.8;
                const yOffset = (idx + 1) * 2;
                return (
                  <div
                    key={`deck-under-${idx}`}
                    className="absolute inset-0 rounded-xl border border-amber-900/80 bg-[#120e0a] shadow-md pointer-events-none"
                    style={{
                      transform: `translateZ(${zOffset}px) translateY(${yOffset}px)`,
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-900 via-yellow-600 to-amber-900 rounded-b-xl opacity-60" />
                  </div>
                );
              })}

              {/* Top Interactive Card on Deck */}
              <div
                className="relative w-full h-full rounded-xl overflow-hidden border-2 border-yellow-400/90 shadow-[0_0_25px_rgba(234,179,8,0.6)] bg-black"
                style={{
                  transform: `translate3d(${dragX}px, ${dragY}px, 15px) rotateX(${currentRotX}deg) rotateZ(${currentRotZ}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <img
                  src={sleeveSrc}
                  alt="Draw Deck Sleeve"
                  className="w-full h-full object-contain pointer-events-none select-none"
                />
                <div className="absolute inset-0 bg-yellow-400/10 pointer-events-none mix-blend-overlay" />

                {/* Swipe Up Hint Pulsing Arrow */}
                {showSwipeHint && !autoDraw && (
                  <div className="absolute inset-x-0 bottom-3 flex flex-col items-center justify-center pointer-events-none animate-bounce">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] bg-black/70 px-2.5 py-0.5 rounded-full border border-yellow-400/40">
                      ↑ SWIPE UP ↑
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Draw Phase Action Controls (Auto Draw Toggle) */}
        {phase === 'draw-hand' && !isAllDrawn && !isFinishing && (
          <div className="flex flex-col items-center gap-1.5 mt-2 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => handleToggleAutoDraw(!autoDraw)}
              className={`px-5 sm:px-7 py-2 rounded-full border text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center gap-2 shadow-lg backdrop-blur-md ${
                autoDraw
                  ? 'bg-yellow-500/25 border-yellow-400 text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.5)]'
                  : 'bg-black/80 hover:bg-neutral-900 border-yellow-500/50 hover:border-yellow-400 text-yellow-400 hover:text-yellow-200'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${autoDraw ? 'text-yellow-300 animate-pulse' : 'text-yellow-400'}`} />
              <span>{autoDraw ? 'Auto-Drawing Active' : 'Auto Draw'}</span>
            </button>
            <span className="text-[8.5px] sm:text-[9.5px] text-white/50 font-bold uppercase tracking-widest">
              {autoDraw ? 'Drawing cards in sequence' : 'Swipe card up or tap Auto Draw'}
            </span>
          </div>
        )}

        {/* Duel Starting Completion Banner */}
        {isFinishing && (
          <div className="my-2 bg-black/90 border-2 border-yellow-400 text-yellow-300 px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_35px_rgba(234,179,8,0.9)] animate-pulse flex items-center gap-2 z-40">
            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>OPENING HAND ASSEMBLED! COMMENCING DUEL...</span>
            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
          </div>
        )}
      </div>

      {/* Bottom Tray: Player Battle Hand Receiving Slots */}
      <div className="relative z-30 w-full bg-black/80 backdrop-blur-lg border-t border-yellow-600/30 px-2 sm:px-6 py-2 sm:py-3 flex flex-col items-center pointer-events-auto">
        <div className="flex items-center justify-between w-full max-w-xl mb-1.5 px-2">
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">
            Player Battle Hand
          </span>
          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/60">
            {currentDrawnCount} of {totalNeeded} Cards Drawn
          </span>
        </div>

        {/* Hand Slots Row */}
        <div className="flex items-center justify-center gap-2 sm:gap-3.5 max-w-full overflow-x-auto pb-0.5">
          {Array.from({ length: totalNeeded }).map((_, slotIdx) => {
            const card = drawnCards[slotIdx];
            if (card) {
              const cardRarity = card.rarity || Rarity.COMMON;
              const rConfig = RARITY_CONFIGS[cardRarity] || RARITY_CONFIGS[Rarity.COMMON];
              return (
                <div
                  key={card.id || slotIdx}
                  className={`relative w-14 min-[380px]:w-16 sm:w-20 lg:w-24 aspect-[640/880] rounded-lg sm:rounded-xl border-2 overflow-hidden bg-black shadow-xl animate-hand-slot-receive shrink-0 transition-all duration-300 ${
                    isAllDrawn ? 'shadow-[0_0_25px_rgba(250,204,21,0.95)] scale-105' : ''
                  }`}
                  style={{ borderColor: rConfig.color }}
                >
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-black/80 rounded-full p-0.5 border border-white/30 shadow-md">
                    <img src={ELEMENT_ICONS[card.element]} className="w-full h-full object-contain" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 to-transparent p-0.5 sm:p-1 flex justify-between items-center text-[7px] sm:text-[8.5px] font-black">
                    <span className="text-yellow-400 flex items-center gap-0.5">
                      <Swords className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
                      <span>{card.attack}</span>
                    </span>
                    <span className="text-blue-400 flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                      <span>{card.defense}</span>
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={slotIdx}
                className="w-14 min-[380px]:w-16 sm:w-20 lg:w-24 aspect-[640/880] rounded-lg sm:rounded-xl border-2 border-dashed border-yellow-500/30 bg-black/40 flex flex-col items-center justify-center text-yellow-500/40 shrink-0"
              >
                <span className="text-xs sm:text-sm font-black">#{slotIdx + 1}</span>
                <span className="text-[6px] sm:text-[7.5px] uppercase tracking-widest font-bold mt-0.5">Card</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FLYING DRAWN CARDS (Fluid 3D Arc from Deck to Hand Slot) */}
      {flyingCards.map(fc => {
        const cardRarity = fc.card.rarity || Rarity.COMMON;
        const rConfig = RARITY_CONFIGS[cardRarity] || RARITY_CONFIGS[Rarity.COMMON];
        return (
          <div
            key={fc.id}
            className="fixed inset-0 pointer-events-none z-[250] flex items-center justify-center"
            style={{
              perspective: '1200px',
            }}
          >
            <div
              className="relative w-[135px] sm:w-[165px] aspect-[640/880] will-change-transform"
              style={{
                ['--start-x' as string]: `${fc.startX}px`,
                ['--start-y' as string]: `${fc.startY}px`,
                ['--start-rot' as string]: `${fc.startRotZ}deg`,
                ['--target-x' as string]: `${fc.targetX}px`,
                ['--target-rot' as string]: `${fc.targetRotZ}deg`,
                animation: 'cardDrawUpFlipAndPlace 0.58s cubic-bezier(0.18, 0.89, 0.32, 1) forwards',
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                className="w-full h-full relative will-change-transform"
                style={{
                  transformStyle: 'preserve-3d',
                  animation: 'cardInnerFlipAround 0.58s cubic-bezier(0.22, 0.9, 0.35, 1) forwards',
                }}
              >
                {/* BACK OF CARD (Sleeve) */}
                <div
                  className="absolute inset-0 rounded-xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.9)] bg-black"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)',
                  }}
                >
                  <img src={sleeveSrc} alt="Card Back" className="w-full h-full object-contain pointer-events-none select-none" />
                  <div className="absolute inset-0 bg-yellow-400/20 mix-blend-overlay" />
                </div>

                {/* FRONT OF CARD (Card Art, Attack, Defense) */}
                <div
                  className="absolute inset-0 rounded-xl overflow-hidden border-2 shadow-[0_0_40px_rgba(250,204,21,1)] bg-black"
                  style={{
                    borderColor: rConfig.color,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <img src={fc.card.image} alt={fc.card.name} className="w-full h-full object-contain pointer-events-none select-none" />
                  <div className="absolute top-1 right-1 w-4 h-4 bg-black/85 rounded-full p-0.5 border border-white/40 shadow">
                    <img src={ELEMENT_ICONS[fc.card.element]} alt="elem" className="w-full h-full object-contain" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-1 sm:p-1.5 flex justify-between items-center text-[8px] sm:text-[9.5px] font-black">
                    <span className="text-yellow-400 flex items-center gap-0.5">
                      <Swords className="w-3 h-3 text-yellow-400 shrink-0" />
                      <span>{fc.card.attack}</span>
                    </span>
                    <span className="text-blue-400 flex items-center gap-0.5">
                      <Shield className="w-3 h-3 text-blue-400 shrink-0" />
                      <span>{fc.card.defense}</span>
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
