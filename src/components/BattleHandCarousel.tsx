import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, Rarity } from '../../types';
import { ELEMENT_ICONS, SOUNDS } from '../../constants';
import { RARITY_CONFIGS } from '../utils/rarity';

interface BattleHandCarouselProps {
  cards: Card[];
  onPlayCard: (card: Card, customElement?: HTMLElement | null) => void;
  onOpen3DCard?: (card: Card) => void;
  playSound: (soundUrl: string) => void;
  isClashing?: boolean;
  isGameOver?: boolean;
  isTurnProcessing?: boolean;
  flungCardId?: string | null;
}

export const BattleHandCarousel: React.FC<BattleHandCarouselProps> = ({
  cards = [],
  onPlayCard,
  onOpen3DCard,
  playSound,
  isClashing = false,
  isGameOver = false,
  isTurnProcessing = false,
  flungCardId = null,
}) => {
  const totalCards = cards.length;

  // Step angle between cards on the carousel cylinder
  const stepAngle = useMemo(() => {
    if (totalCards <= 1) return 0;
    if (totalCards === 2) return 36;
    if (totalCards === 3) return 32;
    return 28;
  }, [totalCards]);

  const maxAngle = useMemo(() => {
    return Math.max(0, (totalCards - 1) * (stepAngle || 1));
  }, [totalCards, stepAngle]);

  // Dynamic carousel radius based on container dimensions
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [carouselRadius, setCarouselRadius] = useState(250);

  useEffect(() => {
    const updateSize = () => {
      const w = containerRef.current?.clientWidth || window.innerWidth;
      // Mobile ~220-250px radius, desktop ~300-340px radius
      const r = Math.max(210, Math.min(340, Math.round(w * 0.52)));
      setCarouselRadius(r);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Carousel physical rotation angle (degrees)
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);
  angleRef.current = angle;

  // Center card interactive vertical pull state (dragging card up before flick)
  const [verticalDragY, setVerticalDragY] = useState(0);
  const verticalDragYRef = useRef(0);
  verticalDragYRef.current = verticalDragY;

  // Touch & Pointer physics tracking
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, time: 0 });
  const dragStartAngleRef = useRef(0);
  const dragDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  const lastPosRef = useRef({ x: 0, y: 0, time: 0 });
  const velocityHistoryRef = useRef<{ dx: number; dt: number; dy: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const cardElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Stop any active inertia or snapping animation
  const stopAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Snap smoothly to target angle using ease-out cubic
  const snapToAngle = useCallback((targetAngle: number, playAudio: boolean = true) => {
    stopAnimation();
    const clampedTarget = Math.max(0, Math.min(maxAngle, targetAngle));
    const startAngle = angleRef.current;
    const diff = clampedTarget - startAngle;

    if (Math.abs(diff) < 0.05) {
      setAngle(clampedTarget);
      return;
    }

    if (playAudio) {
      playSound(SOUNDS.CARD_SWIPE);
    }

    const startTime = performance.now();
    const duration = Math.min(320, Math.max(160, Math.abs(diff) * 5.5));

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      const cur = startAngle + diff * ease;
      setAngle(cur);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setAngle(clampedTarget);
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [maxAngle, playSound, stopAnimation]);

  // Rotate smoothly to specific card index
  const rotateToIndex = useCallback((targetIndex: number) => {
    if (totalCards <= 0) return;
    const clampedIdx = Math.max(0, Math.min(totalCards - 1, targetIndex));
    snapToAngle(clampedIdx * stepAngle, true);
  }, [totalCards, stepAngle, snapToAngle]);

  // Current center card index calculation
  const centerIndex = useMemo(() => {
    if (totalCards <= 1 || stepAngle <= 0) return 0;
    const rawIdx = Math.round(angle / stepAngle);
    return Math.max(0, Math.min(totalCards - 1, rawIdx));
  }, [totalCards, angle, stepAngle]);

  const centerCard = cards[centerIndex] || null;

  // Auto-clamp when cards change (e.g. card played from hand)
  useEffect(() => {
    if (totalCards === 0) return;
    const maxAllowedAngle = Math.max(0, (totalCards - 1) * stepAngle);
    if (angleRef.current > maxAllowedAngle) {
      snapToAngle(maxAllowedAngle, false);
    }
  }, [totalCards, stepAngle, snapToAngle]);

  // Center initial hand on entrance or when hand count resets to opening size
  const prevCountRef = useRef(totalCards);
  useEffect(() => {
    if (totalCards > 0 && prevCountRef.current === 0) {
      const mid = Math.floor((totalCards - 1) / 2);
      setAngle(mid * stepAngle);
    }
    prevCountRef.current = totalCards;
  }, [totalCards, stepAngle]);

  // Play the center card
  const handlePlayCenterCard = useCallback(() => {
    if (isClashing || isGameOver || isTurnProcessing || !centerCard) return;
    const el = cardElementsRef.current[centerCard.id];
    setVerticalDragY(0);
    onPlayCard(centerCard, el);
  }, [centerCard, isClashing, isGameOver, isTurnProcessing, onPlayCard]);

  // Pointer Down handler
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isClashing || isGameOver || isTurnProcessing) return;
    stopAnimation();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    lastPosRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    dragStartAngleRef.current = angleRef.current;
    dragDirectionRef.current = null;
    velocityHistoryRef.current = [];
    setVerticalDragY(0);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  // Pointer Move handler
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || isClashing || isGameOver || isTurnProcessing) return;
    const now = performance.now();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const dt = now - lastPosRef.current.time;
    const stepDx = e.clientX - lastPosRef.current.x;
    const stepDy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY, time: now };

    if (dt > 0) {
      velocityHistoryRef.current.push({ dx: stepDx, dt, dy: stepDy });
      if (velocityHistoryRef.current.length > 5) {
        velocityHistoryRef.current.shift();
      }
    }

    // Determine gesture lock direction
    if (!dragDirectionRef.current) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.1) {
        // User is pulling/flicking vertically on the card
        dragDirectionRef.current = 'vertical';
      } else if (Math.abs(dx) > 7) {
        // User is scrolling the carousel horizontally
        dragDirectionRef.current = 'horizontal';
      }
    }

    if (dragDirectionRef.current === 'vertical') {
      // Pull upward (dy < 0)
      if (dy < 0) {
        setVerticalDragY(dy * 0.9);
      } else {
        setVerticalDragY(dy * 0.25);
      }
      return;
    }

    if (dragDirectionRef.current === 'horizontal' || !dragDirectionRef.current) {
      // Rotation angle translation
      const sensitivity = 0.19;
      let nextAngle = dragStartAngleRef.current - dx * sensitivity;

      // Rubber-band resistance at boundaries
      if (nextAngle < 0) {
        nextAngle = nextAngle * 0.35;
      } else if (nextAngle > maxAngle) {
        nextAngle = maxAngle + (nextAngle - maxAngle) * 0.35;
      }

      setAngle(nextAngle);
    }
  };

  // Pointer Up handler
  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const totalDx = e.clientX - dragStartRef.current.x;
    const totalDy = e.clientY - dragStartRef.current.y;
    const totalDist = Math.hypot(totalDx, totalDy);
    const direction = dragDirectionRef.current;
    dragDirectionRef.current = null;

    // Check vertical flick / release
    if (direction === 'vertical') {
      let upwardVelocity = 0;
      if (velocityHistoryRef.current.length > 0) {
        const recent = velocityHistoryRef.current.slice(-3);
        const totalStepDy = recent.reduce((sum, v) => sum + v.dy, 0);
        const totalDt = recent.reduce((sum, v) => sum + v.dt, 0);
        upwardVelocity = totalDt > 0 ? totalStepDy / totalDt : 0;
      }

      // Upward flick threshold (dy < -25px or fast flick speed)
      if (verticalDragYRef.current < -26 || upwardVelocity < -0.32) {
        handlePlayCenterCard();
        return;
      } else {
        // Smoothly return vertical pull to resting position
        setVerticalDragY(0);
        return;
      }
    }

    // Check horizontal swipe inertia and snapping
    if (direction === 'horizontal') {
      let flickVelocityX = 0;
      if (velocityHistoryRef.current.length > 0) {
        const recent = velocityHistoryRef.current.slice(-3);
        const totalStepDx = recent.reduce((sum, v) => sum + v.dx, 0);
        const totalDt = recent.reduce((sum, v) => sum + v.dt, 0);
        flickVelocityX = totalDt > 0 ? totalStepDx / totalDt : 0;
      }

      // Project target angle based on flick momentum
      const momentumDegrees = -flickVelocityX * 45;
      const projectedAngle = angleRef.current + momentumDegrees;
      const targetIdx = Math.max(0, Math.min(totalCards - 1, Math.round(projectedAngle / (stepAngle || 1))));
      snapToAngle(targetIdx * stepAngle, true);
      return;
    }

    // Tap detected (small movement)
    if (totalDist < 12) {
      setVerticalDragY(0);
      snapToAngle(centerIndex * stepAngle, false);
    }
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    dragDirectionRef.current = null;
    setVerticalDragY(0);
    snapToAngle(centerIndex * stepAngle, false);
  };

  // Mouse wheel scroll to cycle cards
  const lastWheelTimeRef = useRef(0);
  const handleWheel = (e: React.WheelEvent) => {
    if (totalCards <= 1) return;
    const now = performance.now();
    if (now - lastWheelTimeRef.current < 160) return; // Debounce wheel
    lastWheelTimeRef.current = now;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta > 10) {
      rotateToIndex(centerIndex + 1);
    } else if (delta < -10) {
      rotateToIndex(centerIndex - 1);
    }
  };

  if (totalCards === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      className="relative w-full max-w-2xl mx-auto h-[160px] min-[380px]:h-[185px] sm:h-[225px] lg:h-[245px] flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing perspective-carousel overflow-visible"
      style={{
        perspective: '1200px',
        perspectiveOrigin: '50% 50%',
      }}
    >
      {/* Navigation Arrow Buttons: Left */}
      {totalCards > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            rotateToIndex(centerIndex - 1);
          }}
          disabled={centerIndex <= 0}
          aria-label="Previous card"
          className={`absolute left-2 min-[380px]:left-4 sm:left-6 z-[600] w-7 h-7 min-[380px]:w-8 min-[380px]:h-8 sm:w-10 sm:h-10 rounded-full bg-black/80 hover:bg-black/95 active:scale-90 border border-white/20 hover:border-yellow-500/70 text-white flex items-center justify-center shadow-lg transition-all ${
            centerIndex <= 0 ? 'opacity-25 pointer-events-none' : 'opacity-85 hover:opacity-100'
          }`}
        >
          <span className="text-[10px] sm:text-xs font-black">◀</span>
        </button>
      )}

      {/* Navigation Arrow Buttons: Right */}
      {totalCards > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            rotateToIndex(centerIndex + 1);
          }}
          disabled={centerIndex >= totalCards - 1}
          aria-label="Next card"
          className={`absolute right-2 min-[380px]:right-4 sm:right-6 z-[600] w-7 h-7 min-[380px]:w-8 min-[380px]:h-8 sm:w-10 sm:h-10 rounded-full bg-black/80 hover:bg-black/95 active:scale-90 border border-white/20 hover:border-yellow-500/70 text-white flex items-center justify-center shadow-lg transition-all ${
            centerIndex >= totalCards - 1 ? 'opacity-25 pointer-events-none' : 'opacity-85 hover:opacity-100'
          }`}
        >
          <span className="text-[10px] sm:text-xs font-black">▶</span>
        </button>
      )}

      {/* 3D Carousel Cylinder Ring */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
        }}
      >
        {cards.map((card, idx) => {
          const diff = idx * stepAngle - angle;

          // Cull cards on the back/outer edges of the cylinder arc
          if (Math.abs(diff) > 92) {
            return null;
          }

          const isCenter = Math.abs(diff) < (stepAngle > 0 ? stepAngle / 2 : 1);
          const rad = (diff * Math.PI) / 180;
          const x = Math.sin(rad) * carouselRadius;
          const z = Math.cos(rad) * carouselRadius - carouselRadius + (isCenter ? 26 : 0);
          const rotY = -diff * 0.72;
          const scale = isCenter ? 1.08 : Math.max(0.74, 1 - Math.abs(diff) / 190);
          const zIndex = Math.round(500 - Math.abs(diff) * 5);
          const opacity = isCenter ? 1 : Math.max(0.42, 1 - Math.abs(diff) / 80);

          const cardRarity = card.rarity || Rarity.COMMON;
          const rConfig = RARITY_CONFIGS[cardRarity];
          const isFlung = flungCardId === card.id;

          // Interactive vertical pull on the center card
          const currentY = isCenter ? verticalDragY - 6 : 0;

          return (
            <div
              key={card.id}
              ref={(el) => {
                cardElementsRef.current[card.id] = el;
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCenter) {
                  // Tapping a non-center card smoothly spins it to the center!
                  rotateToIndex(idx);
                } else {
                  // Center card tapped: check for double tap for 3D modal
                  const now = Date.now();
                  if (lastTapRef.current.id === card.id && now - lastTapRef.current.time < 380) {
                    lastTapRef.current = { id: '', time: 0 };
                    if (onOpen3DCard) {
                      onOpen3DCard(card);
                    }
                    return;
                  }
                  lastTapRef.current = { id: card.id, time: now };
                }
              }}
              className={`absolute cursor-pointer transition-opacity duration-200 select-none ${
                isFlung ? 'opacity-0 pointer-events-none' : ''
              }`}
              style={{
                transform: `translate3d(${x}px, ${currentY}px, ${z}px) rotateY(${rotY}deg) scale(${scale})`,
                zIndex,
                opacity: isFlung ? 0 : opacity,
                transition: isDraggingRef.current
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease-out',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Card Face */}
              <div
                className={`relative rounded-xl sm:rounded-2xl border-2 overflow-hidden bg-black transition-all ${
                  rConfig.borderSimpleClass
                } ${
                  isCenter
                    ? 'ring-2 ring-white/90 shadow-[0_0_30px_rgba(255,255,255,0.45)]'
                    : 'shadow-xl'
                }`}
                style={{
                  borderColor: rConfig.color,
                }}
              >
                {/* Uncut Card Artwork */}
                <img
                  src={card.image}
                  alt={card.name}
                  className="w-16 min-[360px]:w-18 min-[400px]:w-20 sm:w-28 lg:w-32 aspect-[640/880] object-contain bg-black pointer-events-none select-none"
                  draggable={false}
                />

                {/* Element Badge in Corner */}
                <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-4 h-4 sm:w-6 sm:h-6 bg-black/75 rounded-full p-0.5 sm:p-1 shadow-md border border-white/20">
                  <img src={ELEMENT_ICONS[card.element]} alt={card.element} className="w-full h-full object-contain" />
                </div>

                {/* Stats Bar at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-1 sm:p-2 pt-2 sm:pt-4 flex justify-between items-center">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[6px] sm:text-[8px] font-black text-yellow-500">ATK</span>
                    <span className="text-[9px] min-[360px]:text-[10px] sm:text-sm font-black text-white">{card?.attack ?? 0}</span>
                  </div>
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-[6px] sm:text-[8px] font-black text-blue-400">DEF</span>
                    <span className="text-[9px] min-[360px]:text-[10px] sm:text-sm font-black text-white">{card?.defense ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
