import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardSleeve, Element, Rarity } from '../../types';
import { ASSETS, ELEMENT_ICONS, SOUNDS } from '../../constants';
import { RARITY_CONFIGS } from '../utils/rarity';
import { Shield, Save, Swords, Check, Lock, ArrowUp, ArrowDown, Search, RotateCcw, Sparkles, X, Flame } from 'lucide-react';

interface DeckRingCarouselProps {
  cards: Card[];
  tempEditingDeck: Card[];
  deckSize: number;
  viewMode: 'collection' | 'deck';
  setViewMode: (mode: 'collection' | 'deck') => void;
  filterElement: Element | 'ALL';
  setFilterElement: (el: Element | 'ALL') => void;
  onAddCard: (card: Card) => boolean;
  onRemoveCard: (card: Card) => boolean;
  onBack: () => void;
  onSave: () => void;
  vaultIndex: number;
  playSound: (soundUrl: string) => void;
  onOpen3DCard?: (card: Card) => void;
  activeSleeve?: CardSleeve;
  cardSleeves?: CardSleeve[];
  onEquipSleeve?: (sleeve: CardSleeve) => void;
  onNavigateToForgeSleeves?: () => void;
}

const ELEMENT_COLORS: Record<Element, { badge: string; text: string; bgActive: string; border: string }> = {
  [Element.FIRE]: {
    badge: 'border-red-500/60 bg-red-950/40 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
    text: 'text-red-400',
    bgActive: 'bg-red-600 text-white border-red-400 shadow-[0_0_14px_rgba(239,68,68,0.45)]',
    border: 'border-red-500',
  },
  [Element.ICE]: {
    badge: 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    text: 'text-cyan-400',
    bgActive: 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.45)]',
    border: 'border-cyan-500',
  },
  [Element.WIND]: {
    badge: 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    text: 'text-emerald-400',
    bgActive: 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.45)]',
    border: 'border-emerald-500',
  },
  [Element.EARTH]: {
    badge: 'border-amber-500/60 bg-amber-950/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    text: 'text-amber-400',
    bgActive: 'bg-amber-500 text-black border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.45)]',
    border: 'border-amber-500',
  },
};

export const DeckRingCarousel: React.FC<DeckRingCarouselProps> = ({
  cards,
  tempEditingDeck,
  deckSize,
  viewMode,
  setViewMode,
  filterElement,
  setFilterElement,
  onAddCard,
  onRemoveCard,
  onBack,
  onSave,
  vaultIndex,
  playSound,
  onOpen3DCard,
  activeSleeve,
  cardSleeves = [],
  onEquipSleeve,
  onNavigateToForgeSleeves,
}) => {
  // Physical carousel angle (degrees)
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);
  angleRef.current = angle;

  // Sleeves Modal state
  const [isSleevesModalOpen, setIsSleevesModalOpen] = useState(false);

  // Double tap tracking for 3D inspect
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Dragging and inertia physics state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, time: 0 });
  const pointerDownPosRef = useRef({ x: 0, y: 0, time: 0 });
  const lastPosRef = useRef({ x: 0, time: 0 });
  const velocityHistoryRef = useRef<{ dx: number; dt: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const dragDirectionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Center card interactive vertical pull state
  const [verticalDragY, setVerticalDragY] = useState(0);
  const verticalDragYRef = useRef(0);
  verticalDragYRef.current = verticalDragY;

  // Preload card back template and active sleeve so 3D flip never stutters or lags
  useEffect(() => {
    const img = new Image();
    img.src = activeSleeve?.image || ASSETS.CARD_TEMPLATE;
  }, [activeSleeve?.image]);

  // Peek tilt on horizontal drag (degrees)
  const [peekTilt, setPeekTilt] = useState(0);

  // 3D Flip/spin effect state: locked to specific card ID so no other card flips
  const [flippingCardId, setFlippingCardId] = useState<string | null>(null);
  const [flipDirection, setFlipDirection] = useState<1 | -1>(1);
  const [isFlipping, setIsFlipping] = useState(false);
  const [showFoilSweep, setShowFoilSweep] = useState(false);
  const flipTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stats panel toggle state (when center card or inspect button is tapped)
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const dragMovedRef = useRef(false);
  const dragStartAngleRef = useRef(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Shooting card animation state
  const [shootingCardInfo, setShootingCardInfo] = useState<{
    card: Card;
    direction: 'up' | 'down';
    startY?: number;
  } | null>(null);

  // Toast / Feedback message
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotice = useCallback((text: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setFeedbackNotice(text);
    noticeTimerRef.current = setTimeout(() => {
      setFeedbackNotice(null);
    }, 1800);
  }, []);

  const totalCards = cards.length;
  // Step angle per card in the 3D ring - comfortable spacing and generous separation
  const stepAngle = 36;
  // Only loop when there are 10+ cards so small sets (like 4 Fire cards) are neatly bounded without warping
  const isLooping = totalCards >= 10;
  const totalSpan = totalCards * stepAngle;

  // Determine current active center card with 100% mathematical precision
  let activeCenterIndex = 0;
  if (totalCards > 0) {
    const rawStep = Math.round(angle / stepAngle);
    if (isLooping && totalSpan > 0) {
      activeCenterIndex = ((rawStep % totalCards) + totalCards) % totalCards;
    } else {
      activeCenterIndex = Math.max(0, Math.min(totalCards - 1, rawStep));
    }
  }

  const centerCard = totalCards > 0 ? cards[activeCenterIndex] : null;
  const isCenterInDeck = centerCard ? tempEditingDeck.some(c => c.id === centerCard.id) : false;

  // Stop any running inertia or snap loop
  const stopInertia = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Smoothly snap to target angle using custom spring easing
  const snapToAngle = useCallback((target: number, onDone?: () => void) => {
    stopInertia();
    const startTime = performance.now();
    const fromAngle = angleRef.current;
    const diff = target - fromAngle;
    if (Math.abs(diff) < 0.05) {
      let finalTarget = target;
      if (isLooping && totalSpan > 0) {
        finalTarget = ((target % totalSpan) + totalSpan) % totalSpan;
      } else if (!isLooping && totalCards > 0) {
        finalTarget = Math.max(0, Math.min((totalCards - 1) * stepAngle, target));
      }
      setAngle(finalTarget);
      onDone?.();
      return;
    }

    // Adaptive duration: smooth, accurate, physical card transitions
    const duration = Math.max(200, Math.min(360, Math.abs(diff) * 3.8 + 140));
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Quartic ease-out for ultra smooth physical feel
      const ease = 1 - Math.pow(1 - progress, 4);
      const nextAngle = fromAngle + diff * ease;
      setAngle(nextAngle);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        let finalAngle = target;
        if (isLooping && totalSpan > 0) {
          finalAngle = ((target % totalSpan) + totalSpan) % totalSpan;
        } else if (!isLooping && totalCards > 0) {
          finalAngle = Math.max(0, Math.min((totalCards - 1) * stepAngle, target));
        }
        setAngle(finalAngle);
        animFrameRef.current = null;
        onDone?.();
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [stopInertia, isLooping, totalSpan, totalCards, stepAngle]);

  // Rotate to specific card index via the shortest path in the ring
  const rotateToIndex = useCallback((targetIdx: number) => {
    if (totalCards === 0) return;
    if (!isLooping) {
      const clampedIdx = Math.max(0, Math.min(totalCards - 1, targetIdx));
      snapToAngle(clampedIdx * stepAngle);
      playSound(SOUNDS.CARD_SWIPE);
      return;
    }
    const currentStep = angleRef.current / stepAngle;
    const currentWrappedIdx = ((Math.round(currentStep) % totalCards) + totalCards) % totalCards;
    let stepDiff = targetIdx - currentWrappedIdx;
    if (stepDiff > totalCards / 2) stepDiff -= totalCards;
    if (stepDiff < -totalCards / 2) stepDiff += totalCards;
    const targetAngle = (Math.round(currentStep) + stepDiff) * stepAngle;
    snapToAngle(targetAngle);
    playSound(SOUNDS.CARD_SWIPE);
  }, [totalCards, isLooping, stepAngle, snapToAngle, playSound]);

  // Card Flip / Spin Trigger: strictly locks to the center card ID
  const triggerFlipSpin = useCallback((direction: 1 | -1 = 1) => {
    if (isFlipping) return;
    const target = centerCard;
    if (!target) return;
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);

    setFlippingCardId(target.id);
    setFlipDirection(direction);
    setIsFlipping(true);
    playSound(SOUNDS.CARD_SWIPE);

    setTimeout(() => {
      setShowFoilSweep(true);
      setTimeout(() => setShowFoilSweep(false), 700);
    }, 980);

    flipTimerRef.current = setTimeout(() => {
      setIsFlipping(false);
      setFlippingCardId(null);
    }, 1120);
  }, [isFlipping, centerCard, playSound]);

  // Card Shoot Up (Add to Deck) Action
  const handleShootUp = useCallback((cardToShoot?: Card | null) => {
    const target = cardToShoot || centerCard;
    if (!target) return;

    if (tempEditingDeck.length >= deckSize) {
      showNotice(`Vault is Full (${deckSize}/${deckSize})!`);
      setVerticalDragY(0);
      return;
    }

    const alreadyInDeck = tempEditingDeck.some(c => c.id === target.id);
    if (alreadyInDeck && viewMode === 'collection') {
      showNotice('Already in your Vault!');
      setVerticalDragY(0);
      return;
    }

    // Capture starting drag offset so animation launches seamlessly with zero jerk
    const startY = verticalDragYRef.current;
    setShootingCardInfo({ card: target, direction: 'up', startY });
    playSound(SOUNDS.CARD_SWIPE);
    setVerticalDragY(0);

    // Smooth soaring launch over 520ms
    setTimeout(() => {
      onAddCard(target);
      showNotice(`Added ${target.name} to Vault!`);
      setTimeout(() => {
        setShootingCardInfo(null);
      }, 100);
    }, 480);
  }, [centerCard, tempEditingDeck, deckSize, viewMode, onAddCard, playSound, showNotice]);

  // Card Shoot Down (Remove from Deck) Action
  const handleShootDown = useCallback((cardToShoot?: Card | null) => {
    const target = cardToShoot || centerCard;
    if (!target) return;

    const inDeck = tempEditingDeck.some(c => c.id === target.id);
    if (!inDeck && viewMode === 'collection') {
      showNotice('Card is not in Vault!');
      setVerticalDragY(0);
      return;
    }

    // Capture starting drag offset so animation launches seamlessly with zero jerk
    const startY = verticalDragYRef.current;
    setShootingCardInfo({ card: target, direction: 'down', startY });
    playSound(SOUNDS.CARD_SWIPE);
    setVerticalDragY(0);

    // Smooth gliding release downward over 520ms
    setTimeout(() => {
      onRemoveCard(target);
      showNotice(`Removed ${target.name} from Vault`);
      setTimeout(() => {
        setShootingCardInfo(null);
      }, 100);
    }, 480);
  }, [centerCard, tempEditingDeck, viewMode, onRemoveCard, playSound, showNotice]);

  // Pointer Down handler
  const handlePointerDown = (e: React.PointerEvent) => {
    stopInertia();
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragDirectionLockedRef.current = null;
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    dragStartAngleRef.current = angleRef.current;
    lastPosRef.current = { x: e.clientX, time: performance.now() };
    velocityHistoryRef.current = [];
    setPeekTilt(0);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // Pointer Move handler
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const now = performance.now();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const dist = Math.hypot(deltaX, deltaY);
    if (dist > 6) {
      dragMovedRef.current = true;
    }

    const dt = now - lastPosRef.current.time;
    const dx = e.clientX - lastPosRef.current.x;

    if (dt > 0) {
      velocityHistoryRef.current.push({ dx, dt });
      if (velocityHistoryRef.current.length > 5) {
        velocityHistoryRef.current.shift();
      }
    }
    lastPosRef.current = { x: e.clientX, time: now };

    // Direction lock detection: only locks to vertical if movement is decisively vertical
    if (!dragDirectionLockedRef.current) {
      if (Math.abs(deltaY) > 16 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        dragDirectionLockedRef.current = 'vertical';
      } else if (Math.abs(deltaX) > 6) {
        dragDirectionLockedRef.current = 'horizontal';
      }
    }

    // Handle vertical swipe on center card (pulling up/down before release)
    if (dragDirectionLockedRef.current === 'vertical') {
      const clampedY = Math.max(-140, Math.min(140, deltaY * 0.85));
      setVerticalDragY(clampedY);
      return;
    }

    // Handle horizontal slide: 1:1 direct smooth tracking from dragStartAngleRef
    // "once you start sliding it will keep sliding as long as there is movement and touch"
    const rotSensitivity = 0.28;
    let nextAngle = dragStartAngleRef.current - deltaX * rotSensitivity;

    // Elastic rubberband resistance if not looping and dragged beyond ends
    if (!isLooping && totalCards > 0) {
      const minAngle = 0;
      const maxAngle = (totalCards - 1) * stepAngle;
      if (nextAngle < minAngle) {
        nextAngle = minAngle - Math.sqrt(Math.abs(nextAngle - minAngle)) * 1.4;
      } else if (nextAngle > maxAngle) {
        nextAngle = maxAngle + Math.sqrt(Math.abs(nextAngle - maxAngle)) * 1.4;
      }
    }

    setAngle(nextAngle);

    // Subtle peek tilt while sliding
    const tilt = Math.max(-14, Math.min(14, deltaX * 0.08));
    setPeekTilt(tilt);
  };

  // Pointer Up handler: handles taps, quick-swipe middle card twirl, and smooth closest-card locking
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    // If vertical action was locked:
    if (dragDirectionLockedRef.current === 'vertical') {
      const vY = verticalDragYRef.current;
      const totalDy = e.clientY - dragStartRef.current.y;
      if (vY < -35 || totalDy < -35) {
        // Swiped UP -> Add to deck
        handleShootUp();
      } else if (vY > 35 || totalDy > 35) {
        // Swiped DOWN -> Remove from deck
        handleShootDown();
      } else {
        // Snap back to 0
        setVerticalDragY(0);
      }
      return;
    }

    // Reset peek tilt smoothly
    setPeekTilt(0);

    const now = performance.now();
    const totalDt = now - dragStartRef.current.time;
    const totalDx = e.clientX - dragStartRef.current.x;
    const totalDy = e.clientY - dragStartRef.current.y;
    const moveDist = Math.hypot(totalDx, totalDy);

    // Tap detection (< 12px movement and < 260ms duration)
    if (moveDist < 12 && totalDt < 260) {
      if (centerCard) {
        setIsStatsOpen(prev => !prev);
        playSound(SOUNDS.CARD_SWIPE);
      }
      return;
    }

    // Calculate release velocity (pixels per ms)
    const timeSinceLastMove = now - lastPosRef.current.time;
    let releaseVelocity = 0;
    if (timeSinceLastMove < 75) {
      let sumDx = 0;
      let sumDt = 0;
      for (const item of velocityHistoryRef.current) {
        sumDx += item.dx;
        sumDt += item.dt;
      }
      releaseVelocity = sumDt > 0 ? sumDx / sumDt : 0;
    }
    const absV = Math.abs(releaseVelocity);
    const currentAngle = angleRef.current;

    // 1. QUICK SWIPE: "if quick swipe twirl just the middle card"
    // Rapid flick gesture across the middle card (short duration < 280ms, brisk speed)
    const isQuickSwipe = totalDt < 280 && (absV >= 0.42 || (Math.abs(totalDx) > 30 && totalDt < 200));

    if (isQuickSwipe) {
      // Twirl JUST the middle card in 360 degrees showing the back card image then front face
      const flickDir = totalDx > 0 || releaseVelocity > 0 ? 1 : -1;
      triggerFlipSpin(flickDir);

      // Carousel stays locked directly to the current middle card
      const currentStepFloat = currentAngle / stepAngle;
      const nearestStep = Math.round(currentStepFloat);
      let targetAngle = nearestStep * stepAngle;
      if (!isLooping && totalCards > 0) {
        targetAngle = Math.max(0, Math.min((totalCards - 1) * stepAngle, targetAngle));
      }
      snapToAngle(targetAngle);
      return;
    }

    // 2. SLOW DRAG / CONTINUOUS SLIDE RELEASE:
    // "once you start sliding it will keep sliding as long as there is movement and touch"
    // "if no touch it will lock in the closest card to the middle to the middle"
    const currentStepFloat = currentAngle / stepAngle;
    const closestStep = Math.round(currentStepFloat);
    let targetAngle = closestStep * stepAngle;
    if (!isLooping && totalCards > 0) {
      targetAngle = Math.max(0, Math.min((totalCards - 1) * stepAngle, targetAngle));
    }
    snapToAngle(targetAngle);
    playSound(SOUNDS.CARD_SWIPE);
  };

  // Reset angle when switching view mode or filter
  useEffect(() => {
    stopInertia();
    setAngle(0);
    setVerticalDragY(0);
    setPeekTilt(0);
    setIsStatsOpen(false);
  }, [viewMode, filterElement, stopInertia]);

  // Clamp angle safely whenever cards list changes so no card is ever out of reach
  useEffect(() => {
    if (!isLooping && totalCards > 0) {
      const maxAllowed = (totalCards - 1) * stepAngle;
      setAngle(prev => Math.max(0, Math.min(maxAllowed, prev)));
    }
  }, [totalCards, isLooping, stepAngle]);

  // Preload card backing image so flip twirling has zero texture stutter
  useEffect(() => {
    const img = new Image();
    img.src = ASSETS.CARD_TEMPLATE;
  }, []);

  // Radius for 3D cylinder - spacious radius to spread out cards with ample breathing room
  const [carouselRadius, setCarouselRadius] = useState(480);
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      if (w < 480) {
        setCarouselRadius(370);
      } else if (w < 768) {
        setCarouselRadius(460);
      } else {
        setCarouselRadius(560);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden flex flex-col justify-between font-cinzel text-yellow-100 bg-black select-none z-30">
      {/* Mystical Space Backdrop */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px] pointer-events-none"
        style={{ backgroundImage: `url(${ASSETS.BACKDROP})` }} 
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-black/95 pointer-events-none" />

      {/* Rotating 3D Pedestal Runes on the Floor */}
      <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 w-[480px] sm:w-[680px] aspect-square rounded-full border border-yellow-500/20 pointer-events-none opacity-40 animate-pedestal-spin">
        <div className="absolute inset-4 rounded-full border border-yellow-600/30 border-dashed" />
        <div className="absolute inset-16 rounded-full border border-red-500/20" />
        <div className="absolute inset-0 bg-radial from-yellow-500/10 via-transparent to-transparent" />
      </div>

      {/* Top Header Controls - Fully Outside the Ring */}
      <header className="relative z-30 w-full px-2.5 sm:px-6 py-2 sm:py-2.5 border-b border-yellow-600/30 bg-neutral-950/95 backdrop-blur-md flex flex-col gap-1.5 shadow-xl">
        {/* Row 1: Return, Vault Title & Count, Save Deck */}
        <div className="w-full flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left: Back to Archive */}
          <button 
            id="deck-back-button"
            onClick={onBack}
            className="min-h-[40px] px-2.5 sm:px-4 rounded-xl bg-black/80 hover:bg-yellow-950/40 text-yellow-400 border border-yellow-600/40 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-md shrink-0"
            title="Return to Deck Archive"
          >
            <span>←</span>
            <span>ARCHIVE</span>
          </button>
          
          {/* Center: Vault Name & Count Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h1 className="text-xs sm:text-base font-black uppercase tracking-wider text-yellow-400 truncate">
              Vault {vaultIndex + 1}
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black border tracking-wider transition-all shrink-0 ${
              tempEditingDeck.length === deckSize 
                ? 'bg-yellow-500/20 border-yellow-400 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                : 'bg-white/5 border-white/20 text-white/60'
            }`}>
              {tempEditingDeck.length} / {deckSize}
            </span>
          </div>

          {/* Right: Sleeves Vault & Save to Archive Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="btn-deck-sleeves-modal"
              onClick={() => {
                setIsSleevesModalOpen(true);
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className="min-h-[40px] px-2 sm:px-3 rounded-xl bg-black/80 hover:bg-yellow-950/40 text-yellow-300 border border-yellow-500/50 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
              title="Equip and manage card sleeves"
            >
              <Shield className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden sm:inline">SLEEVES</span>
            </button>

            <button
              id="save-deck-button"
              onClick={onSave}
              className={`min-h-[40px] px-2.5 sm:px-4 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 shrink-0 ${
                tempEditingDeck.length === deckSize
                  ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black hover:scale-105 shadow-yellow-500/40 border border-yellow-300'
                  : 'bg-yellow-950/60 hover:bg-yellow-900/80 text-yellow-300 border border-yellow-500/60 hover:border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
              }`}
              title="Save your vault cards to the Deck Archive"
            >
              <Save className="w-3.5 h-3.5" />
              <span>SAVE</span>
            </button>
          </div>
        </div>

        {/* Row 2: Mode Switcher (COLLECTION vs DECK) */}
        <div className="w-full max-w-sm mx-auto flex items-center bg-black/90 p-1 rounded-2xl border border-yellow-600/40 shadow-inner">
          <button
            id="tab-collection-button"
            onClick={() => {
              setViewMode('collection');
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className={`flex-1 min-h-[38px] rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center ${
              viewMode === 'collection'
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]'
                : 'text-white/50 hover:text-white'
            }`}
          >
            COLLECTION ({cards.length})
          </button>
          <button
            id="tab-deck-button"
            onClick={() => {
              setViewMode('deck');
              playSound(SOUNDS.CARD_SWIPE);
            }}
            className={`flex-1 min-h-[38px] rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center ${
              viewMode === 'deck'
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]'
                : 'text-white/50 hover:text-white'
            }`}
          >
            VAULT ({tempEditingDeck.length})
          </button>
        </div>

        {/* Row 3: Collection Elemental Filter Chips (horizontal touch-scrollable on mobile) */}
        {!isStatsOpen && viewMode === 'collection' && (
          <div className="w-full overflow-x-auto touch-pan-x no-scrollbar py-0.5">
            <nav 
              aria-label="Elemental filter" 
              className="flex items-center gap-1.5 sm:gap-2 min-w-max mx-auto px-2 justify-start sm:justify-center"
            >
              {['ALL', Element.FIRE, Element.ICE, Element.WIND, Element.EARTH].map(el => {
                const isSelected = filterElement === el;
                const elementStyle = el !== 'ALL' ? ELEMENT_COLORS[el as Element] : null;

                return (
                  <button
                    key={el}
                    id={`filter-element-${el.toLowerCase()}`}
                    onClick={() => {
                      setFilterElement(el as any);
                      playSound(SOUNDS.CARD_SWIPE);
                    }}
                    className={`min-h-[36px] px-3 sm:px-3.5 rounded-xl text-[10px] sm:text-xs font-black tracking-wider transition-all border shrink-0 flex items-center gap-1.5 active:scale-95 select-none ${
                      isSelected
                        ? elementStyle
                          ? `${elementStyle.bgActive} shadow-[0_0_14px_rgba(234,179,8,0.45)]`
                          : 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_14px_rgba(234,179,8,0.45)]'
                        : 'bg-black/80 text-white/60 border-white/15 hover:border-white/35 hover:text-white'
                    }`}
                  >
                    {el !== 'ALL' && (
                      <img 
                        src={ELEMENT_ICONS[el as Element]} 
                        className="w-3.5 h-3.5 object-contain" 
                        alt={el} 
                      />
                    )}
                    <span>{el}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Central Feedback Notice Toast */}
      {feedbackNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-black/80 border border-yellow-500/60 px-5 py-2 rounded-full backdrop-blur-md shadow-2xl flex items-center gap-2 pointer-events-none animate-vs">
          <span className="text-yellow-400 text-xs sm:text-sm font-black tracking-wider uppercase">
            {feedbackNotice}
          </span>
        </div>
      )}

      {/* Main Wheel Carousel Stage */}
      <main 
        className="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center perspective-carousel cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Card Counter Badge - Clearly communicates active position */}
        {totalCards > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-yellow-400/90 bg-black/80 px-3 py-1 rounded-full border border-yellow-500/25 backdrop-blur-sm shadow-md">
              CARD {activeCenterIndex + 1} OF {totalCards}
            </span>
          </div>
        )}

        {/* Left / Right Chevron Nav Helpers */}
        {totalCards > 1 && (
          <>
            <button
              id="carousel-nav-prev"
              type="button"
              aria-label="Previous card"
              onClick={(e) => {
                e.stopPropagation();
                const currentStep = Math.round(angleRef.current / stepAngle);
                let targetAngle = (currentStep - 1) * stepAngle;
                if (!isLooping && totalCards > 0) {
                  targetAngle = Math.max(0, Math.min((totalCards - 1) * stepAngle, targetAngle));
                }
                snapToAngle(targetAngle);
                playSound(SOUNDS.CARD_SWIPE);
              }}
              disabled={!isLooping && activeCenterIndex <= 0}
              className={`absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/80 border border-yellow-500/30 text-yellow-400 flex items-center justify-center text-lg sm:text-xl font-black transition-all shadow-xl backdrop-blur-md ${
                !isLooping && activeCenterIndex <= 0
                  ? 'opacity-20 cursor-not-allowed'
                  : 'hover:bg-yellow-950/50 hover:border-yellow-500 hover:scale-110 active:scale-95'
              }`}
            >
              ‹
            </button>
            <button
              id="carousel-nav-next"
              type="button"
              aria-label="Next card"
              onClick={(e) => {
                e.stopPropagation();
                const currentStep = Math.round(angleRef.current / stepAngle);
                let targetAngle = (currentStep + 1) * stepAngle;
                if (!isLooping && totalCards > 0) {
                  targetAngle = Math.max(0, Math.min((totalCards - 1) * stepAngle, targetAngle));
                }
                snapToAngle(targetAngle);
                playSound(SOUNDS.CARD_SWIPE);
              }}
              disabled={!isLooping && activeCenterIndex >= totalCards - 1}
              className={`absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/80 border border-yellow-500/30 text-yellow-400 flex items-center justify-center text-lg sm:text-xl font-black transition-all shadow-xl backdrop-blur-md ${
                !isLooping && activeCenterIndex >= totalCards - 1
                  ? 'opacity-20 cursor-not-allowed'
                  : 'hover:bg-yellow-950/50 hover:border-yellow-500 hover:scale-110 active:scale-95'
              }`}
            >
              ›
            </button>
          </>
        )}

        {/* Empty State for Deck View */}
        {totalCards === 0 && (
          <div className="relative z-20 flex flex-col items-center text-center p-6 max-w-sm">
            <div className="w-20 h-20 rounded-full border-2 border-yellow-600/30 border-dashed flex items-center justify-center mb-4 text-yellow-500 animate-pulse">
              <Swords className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-yellow-400 uppercase tracking-widest mb-2">
              Vault Is Empty
            </h2>
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              No cards are currently equipped. Switch to your Collection and swipe cards <span className="text-yellow-400 font-bold">UP</span> to fill your 20-card deck!
            </p>
            <button
              id="empty-deck-browse-button"
              onClick={() => {
                setViewMode('collection');
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className="bg-yellow-500 text-black px-6 py-2.5 rounded-full font-black text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              BROWSE COLLECTION
            </button>
          </div>
        )}

        {/* 3D Ring Container */}
        {totalCards > 0 && (
          <div 
            className="relative w-full h-full flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {cards.map((card, idx) => {
              // Calculate relative angle to current view
              let diff = 0;
              if (isLooping) {
                const rawDiff = idx * stepAngle - angle;
                diff = ((rawDiff % totalSpan) + totalSpan) % totalSpan;
                if (diff > totalSpan / 2) {
                  diff -= totalSpan;
                }
              } else {
                diff = idx * stepAngle - angle;
              }

              // Cull cards behind the view (cards in back hemisphere)
              if (Math.abs(diff) > 95) {
                return null;
              }

              const isCenter = Math.abs(diff) < stepAngle / 2;
              const rad = (diff * Math.PI) / 180;
              const x = Math.sin(rad) * carouselRadius;
              // Back the cards up so the full card is completely visible with breathing room
              const zPushback = -100;
              const z = Math.cos(rad) * carouselRadius - carouselRadius + zPushback + (isCenter ? 25 : 0);
              const rotY = -diff * 0.70;
              const scale = isCenter ? 1.04 : Math.max(0.70, 1 - Math.abs(diff) / 220);
              const zIndex = Math.round(1000 - Math.abs(diff) * 8);

              const inDeck = tempEditingDeck.some(c => c.id === card.id);
              const isShootingThis = shootingCardInfo?.card.id === card.id;

              // Center card interactive vertical pull offset & peek tilt
              const isCenterCard = centerCard?.id === card.id;
              const isFlippingThis = flippingCardId === card.id && isFlipping;
              const currentY = isCenterCard ? verticalDragY : 0;
              const currentTilt = isCenterCard ? peekTilt : 0;

              return (
                <div
                  key={card.id}
                  id={`carousel-card-${card.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const clickDist = Math.hypot(
                      e.clientX - pointerDownPosRef.current.x,
                      e.clientY - pointerDownPosRef.current.y
                    );
                    if (clickDist < 20) {
                      const now = Date.now();
                      if (lastTapRef.current.id === card.id && (now - lastTapRef.current.time) < 450) {
                        if (singleTapTimerRef.current) {
                          clearTimeout(singleTapTimerRef.current);
                          singleTapTimerRef.current = null;
                        }
                        lastTapRef.current = { id: '', time: 0 };
                        if (onOpen3DCard) {
                          onOpen3DCard(card);
                        }
                        return;
                      }
                      lastTapRef.current = { id: card.id, time: now };

                      if (isCenter) {
                        // Delay single-tap stats toggle slightly so double click/tap can intercept smoothly
                        if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
                        singleTapTimerRef.current = setTimeout(() => {
                          setIsStatsOpen(prev => !prev);
                          playSound(SOUNDS.CARD_SWIPE);
                        }, 250);
                      } else {
                        rotateToIndex(idx);
                      }
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (singleTapTimerRef.current) {
                      clearTimeout(singleTapTimerRef.current);
                      singleTapTimerRef.current = null;
                    }
                    lastTapRef.current = { id: '', time: 0 };
                    if (onOpen3DCard) onOpen3DCard(card);
                  }}
                  className="absolute w-[130px] min-[360px]:w-[145px] sm:w-[185px] md:w-[215px] aspect-[640/880] select-none cursor-pointer"
                  style={{
                    transform: `translate3d(${x}px, ${isShootingThis ? 0 : currentY}px, ${z}px) rotateY(${rotY}deg) scale(${scale})`,
                    opacity: 1,
                    zIndex: isShootingThis ? 9999 : zIndex,
                    transformStyle: 'preserve-3d',
                    WebkitTransformStyle: 'preserve-3d',
                    pointerEvents: isShootingThis ? 'none' : undefined,
                  }}
                >
                  {/* Flight Wrapper: handles ultra-smooth takeoff for adding/removing without resetting 3D carousel cylinder coordinates */}
                  <div
                    className={`w-full h-full ${
                      isShootingThis 
                        ? shootingCardInfo?.direction === 'up' 
                        ? 'animate-shoot-up' 
                        : 'animate-shoot-down'
                        : ''
                    }`}
                    style={{
                      transformStyle: 'preserve-3d',
                      WebkitTransformStyle: 'preserve-3d',
                      ['--shoot-start-y' as any]: `${shootingCardInfo?.startY || 0}px`,
                    }}
                  >
                    {/* 3D Flipper Child (Only flips if this exact card was targeted) */}
                    <div 
                      className={`relative w-full h-full rounded-2xl ${
                        isFlippingThis
                          ? flipDirection === 1
                            ? 'animate-card-twirl-right'
                            : 'animate-card-twirl-left'
                          : ''
                      }`}
                      style={{
                        transformStyle: 'preserve-3d',
                        WebkitTransformStyle: 'preserve-3d',
                        transform: isFlippingThis ? undefined : `rotateY(${currentTilt}deg)`,
                        transition: isFlippingThis ? undefined : 'transform 0.08s ease-out',
                      }}
                    >
                      {/* FRONT FACE OF CARD - Full card image completely visible */}
                      {(() => {
                        const cardRarity = card.rarity || Rarity.COMMON;
                        const rConfig = RARITY_CONFIGS[cardRarity];
                        return (
                          <div 
                            className={`absolute inset-0 rounded-2xl border-2 bg-black shadow-2xl transition-all ${
                              rConfig.borderSimpleClass
                            } ${
                              isCenter
                                ? 'shadow-[0_0_35px_rgba(255,255,255,0.3)] ring-2 ring-white/70'
                                : inDeck
                                ? 'opacity-90'
                                : 'opacity-80'
                            }`}
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(0deg)',
                              borderColor: rConfig.color,
                            }}
                          >
                            <div className="w-full h-full rounded-2xl overflow-hidden relative bg-black flex items-center justify-center">
                              {/* Full Uncut Card Image */}
                              <img 
                                src={card.image} 
                                alt={card.name} 
                                className="w-full h-full object-contain bg-black select-none pointer-events-none"
                                loading="eager"
                                decoding="async"
                                draggable={false}
                              />
                              {/* Subtle in-deck corner indicator */}
                              {inDeck && (
                                <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border border-yellow-300 flex items-center gap-1 z-10">
                                  <Check className="w-3 h-3 text-black" />
                                  <span className="hidden xs:inline">VAULT</span>
                                </div>
                              )}

                              {/* Foil Shine Sweep Effect (Triggers when flick spin lands) */}
                              {isCenter && showFoilSweep && (
                                <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-2xl">
                                  <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-foil-sweep" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* BACK FACE OF CARD (Shown clearly during 360-degree twirl & peek tilt) */}
                      {(() => {
                        const cardRarity = card.rarity || Rarity.COMMON;
                        const rConfig = RARITY_CONFIGS[cardRarity];
                        return (
                          <div 
                            className={`absolute inset-0 rounded-2xl border-2 ${rConfig.borderSimpleClass} bg-black shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center`}
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                              borderColor: rConfig.color,
                            }}
                          >
                            <div className="w-full h-full rounded-2xl overflow-hidden relative flex items-center justify-center bg-black">
                              <img 
                                src={activeSleeve?.image || ASSETS.CARD_TEMPLATE} 
                                className="w-full h-full object-contain bg-black select-none pointer-events-none" 
                                alt="Card Back" 
                                loading="eager"
                                decoding="sync"
                                onError={(e) => {
                                  e.currentTarget.src = ASSETS.CARD_TEMPLATE;
                                }}
                                draggable={false}
                              />
                              <div className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Section - Clean, Mobile-Friendly, Zero Cramping */}
      <footer className="relative z-30 w-full bg-neutral-950/95 border-t border-yellow-600/30 backdrop-blur-md px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col gap-1.5 shadow-2xl">
        {centerCard && (
          <div className="w-full max-w-xl mx-auto flex flex-col gap-1.5">
            {/* Card Overview Banner */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-yellow-500/40 bg-black/60 shrink-0">
                  <img 
                    src={ELEMENT_ICONS[centerCard.element]} 
                    className="w-3.5 h-3.5 object-contain" 
                    alt={centerCard.element} 
                  />
                  <span className="text-[10px] sm:text-xs font-black uppercase text-yellow-400">
                    {centerCard.element}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-black text-white truncate max-w-[120px] min-[380px]:max-w-[170px] sm:max-w-[260px] tracking-wide">
                  {centerCard.name}
                </span>
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 hidden xs:inline-block ${
                  RARITY_CONFIGS[centerCard.rarity || Rarity.COMMON]?.borderClass || 'border-white/20'
                }`}>
                  {centerCard.rarity || Rarity.COMMON}
                </span>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shrink-0 border flex items-center gap-1 ${
                isCenterInDeck
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50 shadow-[0_0_10px_rgba(234,179,8,0.25)]'
                  : 'bg-white/5 text-white/50 border-white/10'
              }`}>
                {isCenterInDeck && <Check className="w-3 h-3 text-yellow-400" />}
                <span>{isCenterInDeck ? 'IN VAULT' : 'AVAILABLE'}</span>
              </span>
            </div>

            {/* Row 1: Primary Action Button (Big, High Contrast, Crystal Clear) */}
            <div>
              {isCenterInDeck ? (
                <button
                  id="btn-bottom-remove"
                  onClick={() => handleShootDown(centerCard)}
                  className="w-full min-h-[44px] rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border border-red-400/80 shadow-lg shadow-red-900/30 active:scale-98"
                  title="Remove this card from your active vault"
                >
                  <ArrowDown className="w-4 h-4 shrink-0" />
                  <span>REMOVE FROM VAULT</span>
                </button>
              ) : (
                <button
                  id="btn-bottom-add"
                  onClick={() => handleShootUp(centerCard)}
                  disabled={tempEditingDeck.length >= deckSize}
                  className={`w-full min-h-[44px] rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    tempEditingDeck.length < deckSize
                      ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black border border-yellow-200 shadow-lg shadow-yellow-500/30 active:scale-98'
                      : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                  }`}
                  title={tempEditingDeck.length >= deckSize ? 'Vault is full (20/20)' : 'Add this card to your active vault'}
                >
                  {tempEditingDeck.length >= deckSize ? (
                    <Lock className="w-4 h-4 shrink-0" />
                  ) : (
                    <ArrowUp className="w-4 h-4 shrink-0" />
                  )}
                  <span>{tempEditingDeck.length >= deckSize ? `VAULT FULL (${deckSize}/${deckSize})` : 'ADD TO VAULT'}</span>
                </button>
              )}
            </div>

            {/* Row 2: Secondary Tool Controls (3 equal, spacious buttons) */}
            <div className="grid grid-cols-3 gap-2">
              {/* Stats Button */}
              <button
                id="btn-bottom-stats"
                onClick={() => {
                  setIsStatsOpen(true);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className="min-h-[40px] px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-black/80 text-yellow-300 border border-yellow-600/40 hover:bg-yellow-950/40 active:scale-95 shadow-md"
                title="Inspect Card Stats & Lore"
              >
                <Search className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                <span>STATS</span>
              </button>

              {/* Flip Button */}
              <button
                id="btn-bottom-flip"
                onClick={() => triggerFlipSpin(1)}
                className="min-h-[40px] px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-black/80 text-yellow-300 border border-yellow-600/40 hover:bg-yellow-950/40 active:scale-95 shadow-md"
                title="Flip card to preview backing sleeve"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                <span>FLIP</span>
              </button>

              {/* 3D View Button */}
              <button
                id="btn-bottom-3d-view"
                onClick={() => onOpen3DCard?.(centerCard)}
                className="min-h-[40px] px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-yellow-500/15 text-yellow-300 border border-yellow-500/50 hover:bg-yellow-500/25 active:scale-95 shadow-md"
                title="Open 3D interactive viewer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                <span>3D VIEW</span>
              </button>
            </div>
          </div>
        )}
      </footer>

      {/* Stats Modal (Dedicated floating modal so it never cramps the layout or cuts off) */}
      {centerCard && isStatsOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Card Details"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsStatsOpen(false);
              playSound(SOUNDS.CARD_SWIPE);
            }
          }}
        >
          <div className="relative w-full max-w-md bg-neutral-950 border-2 border-yellow-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3 font-cinzel text-yellow-100 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-yellow-600/30 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-yellow-300 uppercase tracking-wider truncate">
                    {centerCard.name}
                  </h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${
                    RARITY_CONFIGS[centerCard.rarity || Rarity.COMMON]?.borderClass || 'border-white/20'
                  }`}>
                    {centerCard.rarity || Rarity.COMMON}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                    ELEMENT_COLORS[centerCard.element]?.badge || 'bg-black/80 border-white/15 text-white/90'
                  }`}>
                    <img 
                      src={ELEMENT_ICONS[centerCard.element]} 
                      alt={centerCard.element} 
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>{centerCard.element}</span>
                  </div>
                  <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">
                    {centerCard.type}
                  </span>
                </div>
              </div>

              <button
                id="btn-close-stats-panel"
                onClick={() => {
                  setIsStatsOpen(false);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold active:scale-95 transition-all shrink-0"
                title="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Lore Description */}
            <p className="text-xs text-yellow-100/80 italic bg-black/40 p-2.5 rounded-xl border border-white/10">
              "{centerCard?.description || 'A mythical battle warrior forged in elemental power.'}"
            </p>

            {/* Attack & Defense Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-2.5 text-center shadow-inner">
                <span className="text-[10px] text-red-400 font-black uppercase tracking-wider block">ATTACK</span>
                <span className="text-2xl font-black text-red-200 flex items-center justify-center gap-1.5">
                  <Swords className="w-5 h-5 text-red-400 inline" />
                  <span>{centerCard?.attack ?? 0}</span>
                </span>
              </div>
              <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-2.5 text-center shadow-inner">
                <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider block">DEFENSE</span>
                <span className="text-2xl font-black text-cyan-200 flex items-center justify-center gap-1.5">
                  <Shield className="w-5 h-5 text-cyan-400 inline" />
                  <span>{centerCard?.defense ?? 0}</span>
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col gap-2 pt-1">
              {isCenterInDeck ? (
                <button
                  id="btn-stats-remove-card"
                  onClick={() => {
                    handleShootDown(centerCard);
                    setIsStatsOpen(false);
                  }}
                  className="w-full min-h-[44px] rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <ArrowDown className="w-4 h-4 shrink-0" />
                  <span>REMOVE FROM VAULT</span>
                </button>
              ) : (
                <button
                  id="btn-stats-add-card"
                  onClick={() => {
                    handleShootUp(centerCard);
                    setIsStatsOpen(false);
                  }}
                  disabled={tempEditingDeck.length >= deckSize}
                  className={`w-full min-h-[44px] rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 ${
                    tempEditingDeck.length < deckSize
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black border border-yellow-300 shadow-md'
                      : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 shrink-0" />
                  <span>{tempEditingDeck.length >= deckSize ? `VAULT FULL (${deckSize}/${deckSize})` : 'ADD TO VAULT'}</span>
                </button>
              )}

              <button
                id="btn-stats-3d-view"
                onClick={() => {
                  setIsStatsOpen(false);
                  onOpen3DCard?.(centerCard);
                }}
                className="w-full min-h-[42px] rounded-xl font-black text-xs uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 hover:bg-yellow-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>3D INTERACTIVE VIEW</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Sleeves Selection Modal */}
      {isSleevesModalOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Choose Card Sleeve"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSleevesModalOpen(false);
              playSound(SOUNDS.CARD_SWIPE);
            }
          }}
        >
          <div className="relative w-full max-w-2xl bg-neutral-950/95 border-2 border-yellow-600/50 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 my-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-yellow-600/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-base sm:text-xl font-black uppercase tracking-widest text-yellow-400">
                    Card Sleeve Vault
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-yellow-200/70 mt-1">
                  Select your active card sleeve. This artwork is displayed on the back of all cards across your vaults, in 3D inspection, and in battle!
                </p>
              </div>
              <button
                id="btn-close-sleeves-modal"
                onClick={() => {
                  setIsSleevesModalOpen(false);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold active:scale-95 transition-all shrink-0"
                title="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Currently Active Sleeve Banner */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-14 rounded-lg overflow-hidden border border-yellow-400 shadow shrink-0 bg-black">
                  <img
                    src={activeSleeve?.image || ASSETS.CARD_TEMPLATE}
                    alt="Active Sleeve"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-xs text-yellow-400/80 font-black uppercase tracking-wider">
                    Equipped Backing
                  </div>
                  <div className="text-sm sm:text-base font-black text-yellow-300 truncate">
                    {activeSleeve?.name || 'Primal Relic'}
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-400/40 shrink-0">
                ACTIVE ON ALL CARDS
              </span>
            </div>

            {/* Sleeves Grid */}
            <div className="overflow-y-auto max-h-[50vh] custom-scrollbar pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* 1. Default Classic Sleeve */}
                {(() => {
                  const isCurrent = !activeSleeve || activeSleeve.id === 'default';
                  return (
                    <div
                      key="sleeve-default"
                      className={`relative flex flex-col rounded-2xl p-2.5 sm:p-3 border-2 transition-all ${
                        isCurrent
                          ? 'border-yellow-400 bg-yellow-950/40 shadow-[0_0_20px_rgba(234,179,8,0.25)] scale-[1.02]'
                          : 'border-white/15 bg-black/60 hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-[640/880] w-full rounded-xl overflow-hidden border border-yellow-500/40 shadow-inner bg-black mb-2 relative">
                        <img
                          src={ASSETS.CARD_TEMPLATE}
                          alt="Primal Relic"
                          className="w-full h-full object-contain"
                        />
                        {isCurrent && (
                          <div className="absolute top-2 right-2 bg-yellow-500 text-black font-black text-[9px] px-1.5 py-0.5 rounded-full shadow">
                            EQUIPPED
                          </div>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm font-black text-white truncate mb-1">
                        Primal Relic
                      </div>
                      <div className="text-[10px] text-white/50 mb-2">
                        Classic Stone Template
                      </div>
                      <button
                        id="btn-equip-sleeve-default"
                        onClick={() => {
                          onEquipSleeve?.({
                            id: 'default',
                            name: 'Primal Relic',
                            image: ASSETS.CARD_TEMPLATE,
                            element: Element.EARTH,
                            rarity: Rarity.COMMON,
                            createdAt: 0,
                            isCustom: false,
                          });
                          playSound(SOUNDS.SHIELD_BLOCK);
                        }}
                        disabled={isCurrent}
                        className={`w-full min-h-[38px] rounded-xl text-xs font-black uppercase tracking-wider transition-all mt-auto flex items-center justify-center gap-1.5 ${
                          isCurrent
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/40 cursor-default'
                            : 'bg-yellow-500 hover:bg-yellow-400 text-black active:scale-95 shadow-md shadow-yellow-500/20'
                        }`}
                      >
                        {isCurrent && <Check className="w-3.5 h-3.5 text-yellow-400" />}
                        <span>{isCurrent ? 'EQUIPPED' : 'EQUIP SLEEVE'}</span>
                      </button>
                    </div>
                  );
                })()}

                {/* 2. Custom Player Forged Sleeves */}
                {cardSleeves.map((sleeve) => {
                  const isCurrent = activeSleeve?.id === sleeve.id;
                  const rarityConfig = RARITY_CONFIGS[sleeve.rarity] || RARITY_CONFIGS[Rarity.COMMON];
                  return (
                    <div
                      key={sleeve.id}
                      className={`relative flex flex-col rounded-2xl p-2.5 sm:p-3 border-2 transition-all ${
                        isCurrent
                          ? 'border-yellow-400 bg-yellow-950/40 shadow-[0_0_20px_rgba(234,179,8,0.25)] scale-[1.02]'
                          : 'border-white/15 bg-black/60 hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-[640/880] w-full rounded-xl overflow-hidden border border-yellow-500/40 shadow-inner bg-black mb-2 relative">
                        <img
                          src={sleeve.image}
                          alt={sleeve.name}
                          className="w-full h-full object-contain"
                        />
                        {isCurrent && (
                          <div className="absolute top-2 right-2 bg-yellow-500 text-black font-black text-[9px] px-1.5 py-0.5 rounded-full shadow">
                            EQUIPPED
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1">
                          {ELEMENT_ICONS[sleeve.element] && (
                            <img
                              src={ELEMENT_ICONS[sleeve.element]}
                              alt={sleeve.element}
                              className="w-4 h-4 rounded-full bg-black/60 p-0.5"
                            />
                          )}
                          <span
                            className="text-[9px] font-black uppercase px-1 rounded shadow"
                            style={{ backgroundColor: rarityConfig.borderHex, color: '#000' }}
                          >
                            {sleeve.rarity}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-yellow-300 truncate mb-1">
                        {sleeve.name}
                      </div>
                      <div className="text-[10px] text-white/50 mb-2">
                        {sleeve.element} • Custom Forged
                      </div>
                      <button
                        id={`btn-equip-sleeve-${sleeve.id}`}
                        onClick={() => {
                          onEquipSleeve?.(sleeve);
                          playSound(SOUNDS.SHIELD_BLOCK);
                        }}
                        disabled={isCurrent}
                        className={`w-full min-h-[38px] rounded-xl text-xs font-black uppercase tracking-wider transition-all mt-auto flex items-center justify-center gap-1.5 ${
                          isCurrent
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/40 cursor-default'
                            : 'bg-yellow-500 hover:bg-yellow-400 text-black active:scale-95 shadow-md shadow-yellow-500/20'
                        }`}
                      >
                        {isCurrent && <Check className="w-3.5 h-3.5 text-yellow-400" />}
                        <span>{isCurrent ? 'EQUIPPED' : 'EQUIP SLEEVE'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-yellow-600/30">
              <button
                id="btn-modal-forge-new-sleeve"
                onClick={() => {
                  setIsSleevesModalOpen(false);
                  onNavigateToForgeSleeves?.();
                }}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <Flame className="w-4 h-4 text-black" />
                <span>FORGE NEW SLEEVE IN FORGE</span>
              </button>
              <button
                id="btn-modal-done-sleeves"
                onClick={() => {
                  setIsSleevesModalOpen(false);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className="w-full sm:w-auto min-h-[44px] px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs sm:text-sm uppercase tracking-wider active:scale-95 transition-all"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
