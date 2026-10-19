import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardSleeve, Element, Rarity, CardType } from '../../types';
import { ASSETS, ELEMENT_ICONS, SOUNDS } from '../../constants';
import { RARITY_CONFIGS } from '../utils/rarity';
import { Zap, Swords, Shield } from 'lucide-react';

interface OpeningDeckDrawProps {
  activeSleeveImage: string;
  activeSleeve: CardSleeve;
  cardsToDraw: Card[];
  totalNeeded?: number;
  autoDrawInitial?: boolean;
  onAutoDrawChange?: (enabled: boolean) => void;
  playSound: (soundUrl: string) => void;
  isMuted?: boolean;
  onComplete: () => void;
  onExitToMenu?: () => void;
}

interface FlyingCardInstance {
  id: number;
  card: Card;
  startX: number;
  startY: number;
  startRotZ: number;
}

export const OpeningDeckDraw: React.FC<OpeningDeckDrawProps> = ({
  activeSleeveImage,
  activeSleeve,
  cardsToDraw,
  totalNeeded = 5,
  autoDrawInitial,
  onAutoDrawChange,
  playSound,
  isMuted,
  onComplete,
  onExitToMenu,
}) => {
  const [drawnCards, setDrawnCards] = useState<Card[]>([]);
  const [flyingCards, setFlyingCards] = useState<FlyingCardInstance[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-draw option with persistent memory
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

  const currentDrawnCount = drawnCards.length;
  const isAllDrawn = currentDrawnCount >= totalNeeded;
  const cardsLeftToDraw = Math.max(0, totalNeeded - currentDrawnCount);

  // Fallback safe sleeve image
  const sleeveSrc = activeSleeveImage || ASSETS.CARD_TEMPLATE;

  // Refs to guarantee zero stale closures during automated draw sequence
  const drawnCountRef = useRef(currentDrawnCount);
  drawnCountRef.current = currentDrawnCount;
  const isFinishingRef = useRef(isFinishing);
  isFinishingRef.current = isFinishing;
  const autoDrawRef = useRef(autoDraw);
  autoDrawRef.current = autoDraw;

  // 5-second inactivity hint timer
  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!autoDrawRef.current && drawnCountRef.current < totalNeeded && !isFinishingRef.current) {
      idleTimerRef.current = setTimeout(() => {
        if (!autoDrawRef.current && drawnCountRef.current < totalNeeded && !isFinishingRef.current) {
          setShowSwipeHint(true);
        }
      }, 5000);
    }
  }, [totalNeeded]);

  // Keep autoDraw in sync if prop changes
  useEffect(() => {
    if (autoDrawInitial !== undefined) {
      setAutoDraw(autoDrawInitial);
    }
  }, [autoDrawInitial]);

  // Handle autoDraw state changes and idle hint lifecycle
  useEffect(() => {
    if (autoDraw) {
      setShowSwipeHint(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    } else if (!isAllDrawn && !isFinishing) {
      startIdleTimer();
    }
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [autoDraw, isAllDrawn, isFinishing, startIdleTimer]);

  // Toggle Auto-Draw and persist
  const handleToggleAutoDraw = (checked: boolean) => {
    setAutoDraw(checked);
    onAutoDrawChange?.(checked);
    try {
      localStorage.setItem('battle_swipes_auto_draw', String(checked));
    } catch (e) {
      console.warn('Failed to save auto-draw preference', e);
    }
  };

  // Instant Skip Draw Handler
  const handleSkipDraw = useCallback(() => {
    if (isFinishing || isAllDrawn) return;
    if (autoDrawTimeoutRef.current) {
      clearTimeout(autoDrawTimeoutRef.current);
      autoDrawTimeoutRef.current = null;
    }
    
    setIsFinishing(true);
    isFinishingRef.current = true;
    isFlickingRef.current = true;

    // Fill all remaining cards into hand
    const fullHand = cardsToDraw.slice(0, totalNeeded);
    setDrawnCards(fullHand);
    setFlyingCards([]);
    setDragX(0);
    setDragY(0);

    playSound(SOUNDS.FIRE_EXPLOSION);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 40]);
      }
    } catch {}

    setTimeout(() => {
      onComplete();
    }, 380);
  }, [isFinishing, isAllDrawn, cardsToDraw, totalNeeded, playSound, onComplete]);

  // Core card draw execution engine (supports both manual flick and auto-draw)
  const drawCard = useCallback((isAuto: boolean = false, customStartX?: number, customStartY?: number, customRotZ?: number) => {
    const nextIndex = drawnCountRef.current;
    if (nextIndex >= totalNeeded || isFinishingRef.current) return false;
    // Manual swipe debounce protection
    if (!isAuto && isFlickingRef.current) return false;

    isFlickingRef.current = true;
    const nextCard: Card = cardsToDraw[nextIndex] || {
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

    playSound(SOUNDS.CARD_SWIPE);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } catch {}

    const startX = customStartX !== undefined ? customStartX : dragX;
    const startY = customStartY !== undefined ? customStartY : dragY;
    const startRotZ = customRotZ !== undefined ? customRotZ : (startX * 0.12);

    const flyInstance: FlyingCardInstance = {
      id: Date.now() + Math.random(),
      card: nextCard,
      startX,
      startY,
      startRotZ,
    };

    // Instant seamless handoff from dragged card to flying card with matching start transform
    setFlyingCards(prev => [...prev, flyInstance]);
    setDrawnCards(prev => [...prev, nextCard]);
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
    setShowSwipeHint(false);
    startIdleTimer();

    // Clean up flying card after animation completes
    setTimeout(() => {
      setFlyingCards(prev => prev.filter(f => f.id !== flyInstance.id));
      isFlickingRef.current = false;
    }, 320);

    // If final card drawn, trigger duel entry
    if (nextIndex + 1 >= totalNeeded) {
      isFinishingRef.current = true;
      setIsFinishing(true);
      setTimeout(() => {
        playSound(SOUNDS.FIRE_EXPLOSION);
      }, 260);
      setTimeout(() => {
        onComplete();
      }, 760);
    }
    return true;
  }, [totalNeeded, cardsToDraw, sleeveSrc, dragX, dragY, playSound, onComplete]);

  // Alias for manual flick interactions
  const handleFlick = useCallback((customStartX?: number, customStartY?: number, customRotZ?: number) => {
    drawCard(false, customStartX, customStartY, customRotZ);
  }, [drawCard]);

  // Auto-draw runner: sequentially draws all necessary cards to start the duel
  useEffect(() => {
    if (!autoDraw || isAllDrawn || isFinishing) {
      if (autoDrawTimeoutRef.current) {
        clearTimeout(autoDrawTimeoutRef.current);
        autoDrawTimeoutRef.current = null;
      }
      return;
    }

    // First card starts after an elegant entrance delay; subsequent cards follow at a steady 420ms cadence
    const delay = currentDrawnCount === 0 ? 380 : 420;

    autoDrawTimeoutRef.current = setTimeout(() => {
      if (!autoDrawRef.current || isFinishingRef.current || drawnCountRef.current >= totalNeeded) {
        return;
      }
      drawCard(true, 0, -18, 0);
    }, delay);

    return () => {
      if (autoDrawTimeoutRef.current) {
        clearTimeout(autoDrawTimeoutRef.current);
        autoDrawTimeoutRef.current = null;
      }
    };
  }, [autoDraw, currentDrawnCount, totalNeeded, isFinishing, drawCard]);

  // Keyboard shortcut listener: Space or Enter to flick/skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isAllDrawn && !isFinishing) {
          handleFlick(0, -20, 0);
        }
      } else if (e.key === 'Escape' || e.key === 's' || e.key === 'S') {
        handleSkipDraw();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAllDrawn, isFinishing, handleFlick, handleSkipDraw]);

  // Pointer gesture handlers for ultra-smooth fluid flicking
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isAllDrawn || isFinishing || isFlickingRef.current) return;
    setShowSwipeHint(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
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

    // Upward drag with responsive spring damping
    if (dy < 0) {
      setDragY(Math.max(-95, dy));
      setDragX(Math.max(-50, Math.min(50, dx * 0.5)));

      // If flicked up with authority, immediately trigger departure without waiting for release
      if (dy < -60) {
        const currentX = Math.max(-50, Math.min(50, dx * 0.5));
        const currentY = Math.max(-95, dy);
        const currentRot = currentX * 0.15;
        pointerStartRef.current = null;
        handleFlick(currentX, currentY, currentRot);
      }
    } else {
      // Gentle rubber-band downward
      setDragY(dy * 0.18);
      setDragX(dx * 0.2);
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

    // Flick criteria: dragged up more than 18px OR fast upward swipe speed OR crisp tap
    if (dy < -18 || upwardVelocity > 0.25 || (Math.abs(dy) < 10 && Math.abs(dx) < 10 && dt < 260)) {
      handleFlick(curX, curY, curRot);
    } else {
      setDragX(0);
      setDragY(0);
      startIdleTimer();
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
    startIdleTimer();
  };

  // Computed angles for current drag
  const currentRotX = Math.min(30, Math.max(0, -dragY * 0.38));
  const currentRotZ = Math.max(-18, Math.min(18, dragX * 0.16 + dragY * 0.05));

  return (
    <div className="fixed inset-0 w-full h-[100dvh] text-white overflow-y-auto overscroll-y-contain custom-scrollbar select-none bg-black flex flex-col items-center justify-between font-cinzel p-2 sm:p-4 touch-pan-y z-30">
      {/* Immersive Arena Atmosphere Backdrop */}
      <div 
        className="absolute inset-0 bg-cover bg-center scale-110 opacity-35 transition-opacity duration-1000 pointer-events-none" 
        style={{ backgroundImage: `url(${ASSETS.BACKDROP})` }} 
      />
      <div className="absolute inset-0 battle-vignette z-10 pointer-events-none" />

      {/* Atmospheric Volumetric Light Beam */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[800px] max-h-[800px] pointer-events-none z-10 opacity-25 blur-3xl bg-[radial-gradient(circle,rgba(234,179,8,0.5)_0%,rgba(217,119,6,0.2)_40%,transparent_70%)] animate-pulse" />

      {/* Header Bar - Clean with Controls */}
      <div className="relative z-30 w-full flex items-center justify-between gap-2 px-3 sm:px-8 pt-3 sm:pt-6">
        <div className="flex items-center gap-2 sm:gap-3 bg-black/60 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-yellow-500/30 shadow-lg">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400 animate-ping" />
          <span className="text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
            Opening Hand Draw
          </span>
        </div>

        {onExitToMenu && (
          <button
            onClick={onExitToMenu}
            className="bg-black/50 hover:bg-black/80 active:scale-95 text-white/60 hover:text-white text-[9px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/20 transition-all shadow-md"
          >
            Menu
          </button>
        )}
      </div>

      {/* Center Stage: The 3D Deck Altar */}
      <div className="relative z-20 flex-1 w-full flex flex-col items-center justify-center -mt-2 sm:-mt-5">
        {/* Draw Instructions & Progress Banner */}
        <div className="flex flex-col items-center mb-4 sm:mb-7 text-center px-4">
          <h2 className="text-xl sm:text-3xl font-black uppercase tracking-[0.25em] text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">
            Draw Opening Hand
          </h2>
          <div className="flex items-center gap-2 mt-1 sm:mt-1.5">
            <span className="text-xs sm:text-sm font-bold tracking-wider text-yellow-200/80 uppercase">
              {isAllDrawn 
                ? 'Battle Hand Ready!' 
                : autoDraw 
                  ? `Drawing cards... (${currentDrawnCount} / ${totalNeeded})`
                  : `${currentDrawnCount} / ${totalNeeded} Cards Drawn`
              }
            </span>
          </div>

          {/* Glowing Pips Indicator */}
          <div className="flex items-center gap-2 sm:gap-2.5 mt-2 sm:mt-2.5">
            {Array.from({ length: totalNeeded }).map((_, i) => {
              const isFilled = i < currentDrawnCount;
              return (
                <div
                  key={i}
                  className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 transition-all duration-300 ${
                    isFilled
                      ? 'bg-yellow-400 border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,1)] scale-110'
                      : 'bg-black/60 border-yellow-600/40 opacity-50 scale-95'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* 3D Altar Pedestal Base */}
        <div className="relative flex items-center justify-center">
          {/* Altar Rune Ring Underneath */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] sm:w-[340px] lg:w-[420px] h-[240px] sm:h-[340px] lg:h-[420px] rounded-full border-2 border-yellow-500/25 pointer-events-none [transform:rotateX(72deg)] shadow-[0_0_60px_rgba(234,179,8,0.3)] bg-gradient-to-t from-yellow-950/20 to-black/60" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] sm:w-[280px] lg:w-[350px] h-[200px] sm:h-[280px] lg:h-[350px] rounded-full border border-dashed border-yellow-400/40 pointer-events-none [transform:rotateX(72deg)] animate-spin-slow" />

          {/* 3D Physical Deck Container */}
          <div 
            className="relative w-[185px] sm:w-[215px] aspect-[640/880] [perspective:1200px] select-none touch-none cursor-grab active:cursor-grabbing"
          >
            {/* The Deck with 3D Float and Depth Layers */}
            <div className="relative w-full h-full [transform-style:preserve-3d] animate-deck-float">
              {/* Stacked Under-Cards creating realistic 3D deck thickness */}
              {Array.from({ length: 10 }).map((_, idx) => {
                const zOffset = -(idx + 1) * 2.8;
                const yOffset = (idx + 1) * 2;
                return (
                  <div
                    key={idx}
                    className="absolute inset-0 rounded-xl sm:rounded-2xl border border-amber-950/80 bg-[#120e0a] shadow-lg pointer-events-none"
                    style={{
                      transform: `translateZ(${zOffset}px) translateY(${yOffset}px)`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.85)',
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-amber-900 via-yellow-700 to-amber-900 rounded-b-xl opacity-60" />
                  </div>
                );
              })}

              {/* The Interactive Top Card of the Deck */}
              {!isAllDrawn && (
                <div
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  className={`absolute inset-0 z-30 rounded-xl sm:rounded-2xl border-2 border-yellow-400/80 shadow-[0_0_35px_rgba(234,179,8,0.4)] overflow-hidden bg-black ${
                    !isDragging ? 'transition-transform duration-200 ease-out' : ''
                  }`}
                  style={{
                    transform: `translate3d(${dragX}px, ${dragY}px, 20px) scale(${isDragging ? 1.04 : 1}) rotateX(${currentRotX}deg) rotateZ(${currentRotZ}deg)`,
                    filter: isDragging ? 'drop-shadow(0 0 25px rgba(250,204,21,0.95))' : undefined,
                    willChange: 'transform',
                  }}
                >
                  {/* Equipped Card Sleeve Image */}
                  <img
                    src={sleeveSrc}
                    alt={activeSleeve?.name || 'Card Sleeve'}
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.src = ASSETS.CARD_TEMPLATE;
                    }}
                  />

                  {/* Foil Reflection Sheen */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-300/10 to-transparent pointer-events-none" />

                  {/* Top Edge Highlight */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-yellow-500/30 via-yellow-200 to-yellow-500/30" />

                  {/* Swipe Up Arrow Hint Overlay */}
                  {showSwipeHint && !autoDraw && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none bg-black/30 backdrop-blur-[1px] transition-all duration-300">
                      <div className="flex flex-col items-center gap-2 animate-bounce">
                        <img
                          src={ASSETS.ARROW}
                          alt="Swipe Up"
                          className="w-10 h-10 sm:w-12 sm:h-12 object-contain -rotate-90 drop-shadow-[0_0_20px_rgba(234,179,8,1)] filter brightness-125"
                        />
                        <div className="bg-black/90 px-3 py-1 rounded-full border border-yellow-400/90 text-[10px] sm:text-xs font-black uppercase tracking-widest text-yellow-300 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                          Swipe Up
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Deck Base Card (shown when top card is being flicked) */}
              <div className="absolute inset-0 z-20 rounded-xl sm:rounded-2xl border-2 border-yellow-500/60 shadow-lg overflow-hidden bg-black pointer-events-none">
                <img
                  src={sleeveSrc}
                  alt="Deck Base"
                  className="w-full h-full object-contain pointer-events-none select-none opacity-90"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.src = ASSETS.CARD_TEMPLATE;
                  }}
                />
              </div>

              {/* Flying Card Instances Shooting Off the Deck with zero-jitter start offsets */}
              {flyingCards.map(fc => (
                <div
                  key={fc.id}
                  className="absolute inset-0 z-50 rounded-xl sm:rounded-2xl border-2 border-yellow-300 overflow-hidden bg-black animate-deck-card-fly-off pointer-events-none shadow-[0_0_40px_rgba(250,204,21,1)]"
                  style={{
                    '--fly-start-x': `${fc.startX}px`,
                    '--fly-start-y': `${fc.startY}px`,
                    '--fly-start-rot-z': `${fc.startRotZ}deg`,
                  } as React.CSSProperties}
                >
                  <img
                    src={sleeveSrc}
                    alt="Flying Sleeve"
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-yellow-400/20 mix-blend-overlay" />
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Tactile Action Controls: Single Auto Button */}
        {!isAllDrawn && !isFinishing && (
          <div className="mt-4 sm:mt-6 flex flex-col items-center gap-2 z-30">
            <button
              onClick={() => handleToggleAutoDraw(!autoDraw)}
              className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-full border text-xs sm:text-sm font-black uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center gap-2 shadow-lg backdrop-blur-md ${
                autoDraw
                  ? 'bg-yellow-500/25 border-yellow-400 text-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.5)]'
                  : 'bg-black/80 hover:bg-neutral-900 border-yellow-500/50 hover:border-yellow-400 text-yellow-400 hover:text-yellow-200'
              }`}
            >
              <Zap className={`w-4 h-4 ${autoDraw ? 'text-yellow-300 animate-pulse' : 'text-yellow-400'}`} />
              <span>{autoDraw ? 'Auto-Drawing Active' : 'Auto Draw'}</span>
            </button>
            <span className="text-[9px] sm:text-[10px] text-white/50 font-bold uppercase tracking-widest">
              {autoDraw ? 'Drawing cards in sequence' : 'Swipe card up or tap Auto Draw'}
            </span>
          </div>
        )}

        {/* Duel Starting Completion Banner */}
        {isFinishing && (
          <div className="mt-6 sm:mt-8 bg-black/80 border-2 border-yellow-400 text-yellow-300 px-6 sm:px-10 py-3 sm:py-4 rounded-2xl font-black text-sm sm:text-lg tracking-widest uppercase shadow-[0_0_40px_rgba(234,179,8,0.9)] animate-pulse flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>OPENING HAND ASSEMBLED! COMMENCING DUEL...</span>
            <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
          </div>
        )}
      </div>

      {/* Bottom Tray: The Drawn Hand Slots */}
      <div className="relative z-30 w-full bg-black/60 backdrop-blur-lg border-t border-yellow-600/30 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-xl mb-1.5 sm:mb-2 px-2">
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">
            Player Battle Hand
          </span>
          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/60">
            {currentDrawnCount} of {totalNeeded} Cards Drawn
          </span>
        </div>

        {/* Hand Slots Row */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 max-w-full overflow-x-auto pb-1">
          {Array.from({ length: totalNeeded }).map((_, slotIdx) => {
            const card = drawnCards[slotIdx];
            if (card) {
              const cardRarity = card.rarity || Rarity.COMMON;
              const rConfig = RARITY_CONFIGS[cardRarity];
              return (
                <div
                  key={card.id || slotIdx}
                  className="relative w-14 min-[380px]:w-16 sm:w-24 lg:w-28 aspect-[640/880] rounded-lg sm:rounded-xl border-2 overflow-hidden bg-black shadow-xl animate-hand-slot-receive shrink-0"
                  style={{ borderColor: rConfig.color }}
                >
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 sm:w-5 sm:h-5 bg-black/80 rounded-full p-0.5 border border-white/30 shadow-md">
                    <img src={ELEMENT_ICONS[card.element]} className="w-full h-full object-contain" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 to-transparent p-0.5 sm:p-1.5 flex justify-between items-center text-[7px] sm:text-[9px] font-black">
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

            // Empty Slot waiting for drawn card
            return (
              <div
                key={slotIdx}
                className="w-14 min-[380px]:w-16 sm:w-24 lg:w-28 aspect-[640/880] rounded-lg sm:rounded-xl border-2 border-dashed border-yellow-500/30 bg-black/40 flex flex-col items-center justify-center text-yellow-500/40 shrink-0"
              >
                <span className="text-xs sm:text-base font-black">#{slotIdx + 1}</span>
                <span className="text-[6px] sm:text-[8px] uppercase tracking-widest font-bold mt-0.5">Card</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
