import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Rarity } from '../../types';
import { ASSETS, SOUNDS } from '../../constants';
import { RARITY_CONFIGS } from '../utils/rarity';
import { compositeCardBack } from '../utils/cardCompositor';
import { Sparkles, X, Move, RotateCw } from 'lucide-react';

interface Card3DViewerModalProps {
  card: Card | null;
  onClose: () => void;
  playSound?: (soundUrl: string) => void;
  activeSleeveImage?: string;
}

/**
 * Normalizes an angle in degrees into [-180, 180] range
 * to find the shortest angular distance back to 0.
 */
function normalizeAngle180(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

export const Card3DViewerModal: React.FC<Card3DViewerModalProps> = ({
  card,
  onClose,
  playSound,
  activeSleeveImage,
}) => {
  const [rotation, setRotation] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [cardBackUrl, setCardBackUrl] = useState<string>('');

  // Composite matching card backing image matching the exact canvas size and rarity border
  useEffect(() => {
    let isMounted = true;
    if (card) {
      compositeCardBack(card.rarity || Rarity.COMMON, activeSleeveImage).then((url) => {
        if (isMounted) setCardBackUrl(url);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [card?.id, card?.rarity, activeSleeveImage]);

  // Drag tracking refs
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; baseRotX: number; baseRotY: number }>({
    x: 0,
    y: 0,
    baseRotX: 0,
    baseRotY: 0,
  });
  const recentPointsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const currentRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep ref synchronized
  useEffect(() => {
    currentRotRef.current = rotation;
  }, [rotation]);

  // Reset when card changes
  useEffect(() => {
    if (card) {
      setRotation({ x: 0, y: 0 });
      currentRotRef.current = { x: 0, y: 0 };
      setIsAnimating(false);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }
  }, [card?.id]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  /**
   * Snaps the card smoothly back to its original front pose (x: 0, y: 0)
   */
  const triggerSnapBack = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const currentX = currentRotRef.current.x;
    const currentY = currentRotRef.current.y;
    const normStartX = normalizeAngle180(currentX);
    const normStartY = normalizeAngle180(currentY);

    if (Math.abs(normStartX) < 0.2 && Math.abs(normStartY) < 0.2) {
      setRotation({ x: 0, y: 0 });
      currentRotRef.current = { x: 0, y: 0 };
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    if (Math.abs(normStartX) > 20 || Math.abs(normStartY) > 20) {
      playSound?.(SOUNDS.CARD_SWIPE);
    }

    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const nextX = normStartX * (1 - easeOut);
      const nextY = normStartY * (1 - easeOut);

      setRotation({ x: nextX, y: nextY });
      currentRotRef.current = { x: nextX, y: nextY };

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setRotation({ x: 0, y: 0 });
        currentRotRef.current = { x: 0, y: 0 };
        setIsAnimating(false);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [playSound]);

  /**
   * Performs full spin(s) following flick momentum and decelerates
   * back to its exact original front pose (x: 0, y: 0).
   */
  const triggerFlickSpin = useCallback((vx: number, vy: number, speed: number) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsAnimating(true);
    playSound?.(SOUNDS.CARD_SWIPE);

    const isHorizontal = Math.abs(vx) >= Math.abs(vy) || (vx === 0 && vy === 0);
    const spinCount = speed > 1.3 ? 2 : 1;
    const duration = spinCount === 2 ? 800 : 580;
    const startTime = performance.now();

    const currentX = currentRotRef.current.x;
    const currentY = currentRotRef.current.y;
    const normStartX = normalizeAngle180(currentX);
    const normStartY = normalizeAngle180(currentY);

    if (isHorizontal) {
      const dir = vx >= 0 ? 1 : -1;
      const targetDeltaY = (dir * 360 * spinCount) - normStartY;
      const targetDeltaX = 0 - normStartX;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Decelerating quartic curve for authentic flick physics
        const easeOut = 1 - Math.pow(1 - progress, 3.5);

        const nextX = normStartX + targetDeltaX * easeOut;
        const nextY = normStartY + targetDeltaY * easeOut;

        setRotation({ x: nextX, y: nextY });
        currentRotRef.current = { x: nextX, y: nextY };

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Returned back to exact original front pose
          setRotation({ x: 0, y: 0 });
          currentRotRef.current = { x: 0, y: 0 };
          setIsAnimating(false);
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      const dir = vy >= 0 ? -1 : 1;
      const targetDeltaX = (dir * 360) - normStartX;
      const targetDeltaY = 0 - normStartY;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeOut = 1 - Math.pow(1 - progress, 3.5);

        const nextX = normStartX + targetDeltaX * easeOut;
        const nextY = normStartY + targetDeltaY * easeOut;

        setRotation({ x: nextX, y: nextY });
        currentRotRef.current = { x: nextX, y: nextY };

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          setRotation({ x: 0, y: 0 });
          currentRotRef.current = { x: 0, y: 0 };
          setIsAnimating(false);
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    }
  }, [playSound]);

  // Pointer Handlers for 3D Drag Rotation & Flick Detection
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsAnimating(false);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseRotX: currentRotRef.current.x,
      baseRotY: currentRotRef.current.y,
    };
    recentPointsRef.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const now = performance.now();
    recentPointsRef.current.push({ x: e.clientX, y: e.clientY, t: now });
    if (recentPointsRef.current.length > 7) {
      recentPointsRef.current.shift();
    }

    const rotSpeed = 0.55;
    const newRotY = dragStartRef.current.baseRotY + deltaX * rotSpeed;
    const newRotX = dragStartRef.current.baseRotX - deltaY * rotSpeed;

    setRotation({ x: newRotX, y: newRotY });
    currentRotRef.current = { x: newRotX, y: newRotY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Check recent points to detect flick momentum
    const points = recentPointsRef.current;
    if (points.length >= 2) {
      const first = points[0];
      const last = points[points.length - 1];
      const dt = last.t - first.t;

      if (dt > 10 && dt < 280) {
        const vx = (last.x - first.x) / dt;
        const vy = (last.y - first.y) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 0.42) {
          // Flick detected: spin and return to original front pose!
          triggerFlickSpin(vx, vy, speed);
          return;
        }
      }
    }

    // No flick: let go after dragging -> snap back to original front pose!
    triggerSnapBack();
  };

  if (!card) return null;

  const cardRarity = card.rarity || Rarity.COMMON;
  const rarityConfig = RARITY_CONFIGS[cardRarity] || RARITY_CONFIGS[Rarity.COMMON];

  // Subtle lighting glare calculation based on rotation
  const glareOpacity = Math.max(0, Math.min(0.4, Math.cos((rotation.y * Math.PI) / 180) * 0.3));

  return (
    <div 
      id="card-3d-viewer-overlay"
      className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none touch-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Bar: Title & Controls */}
      <div className="w-full max-w-lg flex items-center justify-between pointer-events-auto z-10">
        <div className="flex flex-col">
          <h2 className="text-base sm:text-xl font-black text-yellow-400 tracking-wider uppercase drop-shadow-md">
            {card.name}
          </h2>
          <span className="text-[10px] sm:text-xs text-white/50 font-serif italic">
            3D Card Viewer
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerFlickSpin(1.5, 0, 1.5)}
            className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-yellow-300 text-xs font-black uppercase tracking-wider border border-white/15 transition-all flex items-center gap-1.5 shadow-lg"
            title="Quick Spin"
          >
            <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
            <span>SPIN</span>
          </button>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-red-600/80 active:scale-95 text-white text-base font-black flex items-center justify-center border border-white/15 transition-all shadow-lg"
            title="Close Viewer"
          >
            <X className="w-5 h-5 text-white shrink-0" />
          </button>
        </div>
      </div>

      {/* Center 3D Interactive Stage */}
      <div 
        className="w-full flex-1 flex items-center justify-center relative cursor-grab active:cursor-grabbing overflow-visible my-2 touch-none select-none"
        style={{ perspective: 1200 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* The 3D Rotating Card Container: Exact matching size and aspect ratio for front & back */}
        <div
          id="interactive-3d-card"
          className="relative w-[200px] min-[360px]:w-[220px] min-[400px]:w-[260px] sm:w-[320px] md:w-[360px] max-h-[58vh] aspect-[640/880] will-change-transform select-none"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* FRONT FACE OF CARD */}
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl border-4 ${rarityConfig.borderClass} bg-black shadow-2xl overflow-hidden select-none pointer-events-none`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)',
              borderColor: rarityConfig.color,
            }}
          >
            {/* Full Card Image */}
            <img
              src={card.image}
              alt={card.name}
              className="w-full h-full object-contain pointer-events-none select-none bg-black"
              draggable={false}
            />

            {/* Dynamic Glass / Foil Light Sheen */}
            <div
              className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white to-transparent"
              style={{
                opacity: glareOpacity,
                transform: `translateX(${(rotation.y / 180) * 100}%)`,
              }}
            />
          </div>

          {/* BACK FACE OF CARD: Exactly same size as front with authentic back card image & NO extras */}
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl border-4 ${rarityConfig.borderClass} bg-black shadow-2xl overflow-hidden select-none pointer-events-none`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderColor: rarityConfig.color,
            }}
          >
            {/* Authentic Back Card Image - 1:1 identical dimensions, border, and aspect ratio */}
            <img
              src={cardBackUrl || activeSleeveImage || ASSETS.CARD_TEMPLATE}
              onError={(e) => {
                e.currentTarget.src = ASSETS.CARD_TEMPLATE;
              }}
              alt="Card Back"
              className="w-full h-full object-contain pointer-events-none select-none bg-black"
              draggable={false}
            />

            {/* Matching Sheen on back */}
            <div
              className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white to-transparent"
              style={{
                opacity: glareOpacity,
                transform: `translateX(${((rotation.y + 180) / 180) * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Controls & Interaction Guidance */}
      <div className="w-full max-w-md flex flex-col items-center gap-2 pointer-events-auto z-10">
        <div className="flex items-center gap-3 text-center text-[10px] sm:text-xs text-white/75 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md shadow-lg">
          <span className="flex items-center gap-1.5"><Move className="w-3.5 h-3.5 shrink-0 text-yellow-400" /> Drag to inspect</span>
          <span className="text-white/30">•</span>
          <span className="flex items-center gap-1.5"><RotateCw className="w-3.5 h-3.5 shrink-0 text-yellow-400" /> Flick to spin</span>
        </div>

        <button
          onClick={triggerSnapBack}
          className="text-[10px] sm:text-xs text-yellow-400/80 hover:text-yellow-300 underline underline-offset-4 tracking-wider uppercase font-bold py-1 transition-colors"
        >
          Reset Orientation
        </button>
      </div>
    </div>
  );
};
