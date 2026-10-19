import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, DeckBoxSkin, Element } from '../../types';
import { SOUNDS } from '../../constants';
import { RotateCw, Move, Sparkles } from 'lucide-react';

interface DeckBox3DProps {
  boxIndex: number;
  vaultName: string;
  deckCards: Card[];
  deckSize: number;
  isEquipped: boolean;
  skin: DeckBoxSkin;
  isOpen: boolean;
  onToggleOpen: () => void;
  playSound: (soundUrl: string) => void;
  isActiveInCarousel: boolean;
}

// Preset Leather Box Colors matching the Vault X reference
export const BOX_COLOR_PALETTES: Record<string, {
  name: string;
  hex: string;
  stitchHex: string;
  edgeHex: string;
}> = {
  black: {
    name: 'Midnight Onyx',
    hex: '#141519',
    stitchHex: '#383a42',
    edgeHex: '#0a0a0d',
  },
  blue: {
    name: 'Vault Cobalt',
    hex: '#1a365d',
    stitchHex: '#2b6cb0',
    edgeHex: '#0f233d',
  },
  red: {
    name: 'Dragon Crimson',
    hex: '#5c1015',
    stitchHex: '#9b2c2c',
    edgeHex: '#380a0d',
  },
  green: {
    name: 'Forest Emerald',
    hex: '#064e3b',
    stitchHex: '#047857',
    edgeHex: '#022c22',
  },
  purple: {
    name: 'Royal Amethyst',
    hex: '#3b0764',
    stitchHex: '#7e22ce',
    edgeHex: '#24043d',
  },
  gold: {
    name: 'Desert Gold',
    hex: '#78350f',
    stitchHex: '#b45309',
    edgeHex: '#451a03',
  },
};

// Preset Inner Velvet Lining Colors
export const LINING_COLOR_PALETTES: Record<string, {
  name: string;
  hex: string;
  borderHex: string;
}> = {
  yellow: {
    name: 'Sunburst Gold',
    hex: '#eab308',
    borderHex: '#facc15',
  },
  blue: {
    name: 'Royal Velvet',
    hex: '#1e3a8a',
    borderHex: '#3b82f6',
  },
  red: {
    name: 'Ruby Velvet',
    hex: '#991b1b',
    borderHex: '#ef4444',
  },
  green: {
    name: 'Emerald Velvet',
    hex: '#065f46',
    borderHex: '#10b981',
  },
  black: {
    name: 'Midnight Suede',
    hex: '#1e293b',
    borderHex: '#475569',
  },
};

export interface SolidDeckBox3DProps {
  skin: DeckBoxSkin;
  isOpen?: boolean;
  deckCards?: Card[];
  style?: React.CSSProperties;
  className?: string;
  showInsideCards?: boolean;
}

export const SolidDeckBox3D = React.forwardRef<HTMLDivElement, SolidDeckBox3DProps>(({
  skin,
  isOpen = false,
  deckCards = [],
  style,
  className = '',
  showInsideCards = true,
}, ref) => {
  // Palette resolution
  const boxColorKey = skin.boxColor || (skin.theme === 'ruby' ? 'red' : skin.theme === 'sapphire' ? 'blue' : skin.theme === 'emerald' ? 'green' : 'black');
  const boxColor = BOX_COLOR_PALETTES[boxColorKey] || BOX_COLOR_PALETTES.black;

  const liningColorKey = skin.liningColor || (boxColorKey === 'blue' ? 'blue' : 'yellow');
  const liningColor = LINING_COLOR_PALETTES[liningColorKey] || LINING_COLOR_PALETTES.yellow;

  // Solid box dimensions:
  // Width: 160px, Height: 120px, Depth: 115px
  const W = 160;
  const H = 120;
  const D = 115;
  const HW = W / 2; // 80
  const HH = H / 2; // 60
  const HD = D / 2; // 57.5

  const leatherTexture: React.CSSProperties = {
    backgroundColor: boxColor.hex,
    backgroundImage: `
      radial-gradient(${boxColor.stitchHex} 15%, transparent 16%),
      radial-gradient(${boxColor.stitchHex} 15%, transparent 16%)
    `,
    backgroundPosition: '0 0, 3px 3px',
    backgroundSize: '6px 6px',
  };

  const isContain = skin.tileMode === 'contain';
  const isTiled = skin.tileMode === 'repeat';

  const isOutsideColorOnly = skin.outsideType === 'color';
  const fullBleedArtStyle: React.CSSProperties = (!isOutsideColorOnly && skin.image)
    ? {
        backgroundColor: '#000000',
        backgroundImage: `url(${skin.image})`,
        backgroundSize: isContain 
          ? 'contain' 
          : isTiled 
            ? `${skin.tileSize || 90}px ${skin.tileSize || 90}px` 
            : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: isTiled ? 'repeat' : 'no-repeat',
      }
    : leatherTexture;

  const isInsideImage = skin.insideType === 'image' && (skin.insideImage || skin.image);
  const insideImageSrc = skin.insideImage || skin.image;
  const insideWallStyle: React.CSSProperties = isInsideImage
    ? {
        backgroundColor: '#000000',
        backgroundImage: `url(${insideImageSrc})`,
        backgroundSize: isContain 
          ? 'contain' 
          : isTiled 
            ? `${skin.tileSize || 90}px ${skin.tileSize || 90}px` 
            : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: isTiled ? 'repeat' : 'no-repeat',
      }
    : {
        backgroundColor: liningColor.hex,
      };

  return (
    <div
      ref={ref}
      className={`relative will-change-transform ${className}`}
      style={{
        width: `${W}px`,
        height: `${H}px`,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {/* 1. INNER BOTTOM FACE */}
      <div
        className="absolute left-0 right-0 rounded-none bg-black shadow-inner pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...insideWallStyle,
          height: `${D}px`,
          top: `${(H - D) / 2}px`,
          transform: `translate3d(0, ${HH}px, 0) rotateX(90deg)`,
          border: `1.5px solid ${isInsideImage ? boxColor.stitchHex : liningColor.borderHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/20 pointer-events-none" />
      </div>

      {/* 2. INNER BACK FACE */}
      <div
        className="absolute inset-0 rounded-none bg-black overflow-hidden shadow-inner pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...insideWallStyle,
          transform: `translate3d(0, 0, -${HD}px)`,
          border: `1.5px solid ${isInsideImage ? boxColor.stitchHex : liningColor.borderHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      </div>

      {/* 3. INNER LEFT FACE */}
      <div
        className="absolute top-0 bottom-0 rounded-none bg-black overflow-hidden shadow-inner pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...insideWallStyle,
          width: `${D}px`,
          left: `${(W - D) / 2}px`,
          transform: `translate3d(-${HW}px, 0, 0) rotateY(90deg)`,
          border: `1.5px solid ${isInsideImage ? boxColor.stitchHex : liningColor.borderHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/35 pointer-events-none" />
      </div>

      {/* 4. INNER RIGHT FACE */}
      <div
        className="absolute top-0 bottom-0 rounded-none bg-black overflow-hidden shadow-inner pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...insideWallStyle,
          width: `${D}px`,
          left: `${(W - D) / 2}px`,
          transform: `translate3d(${HW}px, 0, 0) rotateY(-90deg)`,
          border: `1.5px solid ${isInsideImage ? boxColor.stitchHex : liningColor.borderHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/35 pointer-events-none" />
      </div>

      {/* 5. INNER FRONT FACE */}
      <div
        className="absolute inset-0 rounded-none bg-black overflow-hidden shadow-inner pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...insideWallStyle,
          transform: `translate3d(0, 0, ${HD}px) rotateY(180deg)`,
          border: `1.5px solid ${isInsideImage ? boxColor.stitchHex : liningColor.borderHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      </div>

      {/* CARDS RESTING INSIDE THE CAVITY WHEN LID OPENS */}
      {showInsideCards && isOpen && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in duration-200"
          style={{
            transform: `translate3d(0, 10px, 0)`,
          }}
        >
          <div
            className="w-[112px] h-[80px] rounded-lg shadow-2xl border border-yellow-500/60 flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: '#111',
              backgroundImage: deckCards.length > 0 && deckCards[0].image ? `url(${deckCards[0].image})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: 'rotateX(60deg) translateZ(8px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.9), 0 0 15px rgba(234,179,8,0.5)',
            }}
          >
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* 1. FRONT FACE (OUTSIDE) */}
      <div
        className="absolute inset-0 rounded-none bg-black overflow-hidden shadow-2xl pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...fullBleedArtStyle,
          transform: `translate3d(0, 0, ${HD}px)`,
          border: `1.5px solid ${boxColor.stitchHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 pointer-events-none" />
        <div className="absolute inset-0 border border-black/30 pointer-events-none" />
      </div>

      {/* 2. BACK FACE (OUTSIDE) */}
      <div
        className="absolute inset-0 rounded-none bg-black overflow-hidden shadow-2xl pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...fullBleedArtStyle,
          transform: `translate3d(0, 0, -${HD}px) rotateY(180deg)`,
          border: `1.5px solid ${boxColor.stitchHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      </div>

      {/* 3. LEFT FACE (OUTSIDE) */}
      <div
        className="absolute top-0 bottom-0 rounded-none bg-black overflow-hidden shadow-2xl pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...fullBleedArtStyle,
          width: `${D}px`,
          left: `${(W - D) / 2}px`,
          transform: `translate3d(-${HW}px, 0, 0) rotateY(-90deg)`,
          border: `1.5px solid ${boxColor.stitchHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      </div>

      {/* 4. RIGHT FACE (OUTSIDE) */}
      <div
        className="absolute top-0 bottom-0 rounded-none bg-black overflow-hidden shadow-2xl pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...fullBleedArtStyle,
          width: `${D}px`,
          left: `${(W - D) / 2}px`,
          transform: `translate3d(${HW}px, 0, 0) rotateY(90deg)`,
          border: `1.5px solid ${boxColor.stitchHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      </div>

      {/* 5. BOTTOM FACE (OUTSIDE) */}
      <div
        className="absolute left-0 right-0 rounded-none bg-black shadow-2xl pointer-events-none"
        style={{
          backgroundColor: '#000000',
          ...fullBleedArtStyle,
          height: `${D}px`,
          top: `${(H - D) / 2}px`,
          transform: `translate3d(0, ${HH}px, 0) rotateX(-90deg)`,
          border: `1.5px solid ${boxColor.stitchHex}`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      </div>

      {/* 6. TOP LID */}
      <div
        className="absolute left-0 right-0 z-30 pointer-events-none"
        style={{
          height: `${D}px`,
          top: 0,
          transformOrigin: 'top center',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.42s cubic-bezier(0.25, 1, 0.5, 1)',
          transform: isOpen
            ? `translate3d(0, 0, -${HD}px) rotateX(215deg)`
            : `translate3d(0, 0, -${HD}px) rotateX(90deg)`,
        }}
      >
        {/* Outer Lid Surface */}
        <div
          className="absolute inset-0 rounded-none bg-black overflow-hidden shadow-2xl"
          style={{
            backgroundColor: '#000000',
            ...fullBleedArtStyle,
            border: `1.5px solid ${boxColor.stitchHex}`,
            backfaceVisibility: 'hidden',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />
        </div>

        {/* Inner Lid Surface */}
        <div
          className="absolute inset-0 rounded-none bg-black overflow-hidden shadow-2xl"
          style={{
            backgroundColor: '#000000',
            ...insideWallStyle,
            border: `1.5px solid ${isInsideImage ? boxColor.stitchHex : liningColor.borderHex}`,
            transform: 'rotateX(180deg)',
            backfaceVisibility: 'hidden',
            boxShadow: 'inset 0 0 25px rgba(0,0,0,0.7)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        </div>
      </div>
    </div>
  );
});
SolidDeckBox3D.displayName = 'SolidDeckBox3D';

export const DeckBox3D: React.FC<DeckBox3DProps> = ({
  deckCards,
  skin,
  isOpen,
  onToggleOpen,
  playSound,
}) => {
  // Default showcase pose: slightly tilted down to view top & front faces clearly
  const DEFAULT_ROTATION = { x: 14, y: 0 };
  const currentRotRef = useRef<{ x: number; y: number }>(DEFAULT_ROTATION);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragStartRotRef = useRef(DEFAULT_ROTATION);
  const dragDistanceRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const isSnappingRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Mobile-optimized solid box dimensions:
  const W = 160;
  const H = 120;

  // Directly update DOM transform for 60/120fps hardware acceleration
  const applyTransform = useCallback((x: number, y: number, openState: boolean) => {
    if (boxRef.current) {
      boxRef.current.style.transform = `
        rotateX(${x}deg) 
        rotateY(${y}deg) 
        ${openState ? 'translateY(-6px)' : 'translateY(0)'}
      `;
    }
  }, []);

  // Update transform on mount or when isOpen changes
  useEffect(() => {
    applyTransform(currentRotRef.current.x, currentRotRef.current.y, isOpen);
  }, [isOpen, applyTransform]);

  // Snaps smoothly back to default showcase pose (x: 14, y: 0)
  const snapBackToOriginalPosition = useCallback((onComplete?: () => void) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isSnappingRef.current = true;
    const startX = currentRotRef.current.x;
    const startY = currentRotRef.current.y;
    const targetX = DEFAULT_ROTATION.x;
    const targetY = DEFAULT_ROTATION.y;
    const startTime = performance.now();
    const duration = 240; // 240ms silky smooth snap

    const animate = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      const newX = startX + (targetX - startX) * ease;
      const newY = startY + (targetY - startY) * ease;
      currentRotRef.current = { x: newX, y: newY };
      applyTransform(newX, newY, isOpen);

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        isSnappingRef.current = false;
        animFrameRef.current = null;
        if (onComplete) onComplete();
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, [DEFAULT_ROTATION.x, DEFAULT_ROTATION.y, isOpen, applyTransform]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Pointer drag event handlers for 360 degree 3D rotation & tap detection
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSnappingRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartRotRef.current = { ...currentRotRef.current };
    dragDistanceRef.current = 0;
    if (boxRef.current) {
      boxRef.current.style.transition = 'none';
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;
    dragDistanceRef.current = Math.hypot(dx, dy);

    const sensitivity = 0.55;
    const targetX = dragStartRotRef.current.x - dy * sensitivity;
    const targetY = dragStartRotRef.current.y + dx * sensitivity;
    currentRotRef.current = { x: targetX, y: targetY };

    if (!animFrameRef.current) {
      animFrameRef.current = requestAnimationFrame(() => {
        applyTransform(currentRotRef.current.x, currentRotRef.current.y, isOpen);
        animFrameRef.current = null;
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (dragDistanceRef.current < 8) {
      playSound(SOUNDS.CARD_SWIPE);
      snapBackToOriginalPosition(() => {
        onToggleOpen();
      });
    } else {
      if (boxRef.current) {
        boxRef.current.style.transition = 'transform 0.15s ease-out';
      }
    }
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[280px] mx-auto py-1">
      {/* 3D Spin Hint & Snap/Reset Button */}
      <div className="flex items-center gap-1.5 mb-2 px-3 py-1 rounded-full bg-black/90 border border-yellow-500/40 text-[9.5px] font-black uppercase tracking-wider text-yellow-300 shadow-md">
        <Move className="w-3 h-3 text-yellow-400 shrink-0" />
        <span>DRAG TO ROTATE • TAP TO {isOpen ? 'CLOSE' : 'OPEN'}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            snapBackToOriginalPosition();
            playSound(SOUNDS.CARD_SWIPE);
          }}
          className="p-0.5 hover:text-white transition-colors"
          title="Snap back to front"
        >
          <RotateCw className="w-3 h-3" />
        </button>
      </div>

      {/* 3D Stage Container */}
      <div
        className="relative perspective-[1200px] flex items-center justify-center cursor-grab active:cursor-grabbing pt-8 pb-4 mt-2 mb-1"
        style={{
          width: `${W + 40}px`,
          height: `${H + 130}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Soft Ambient Floor Shadow */}
        <div
          className="absolute bottom-2 w-[190px] h-[28px] rounded-full blur-xl pointer-events-none transition-transform duration-300"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            transform: `scale(${isOpen ? 1.15 : 1})`,
          }}
        />

        {/* 3D Solid Box Anchor (Centered in 3D Space) */}
        <SolidDeckBox3D
          ref={boxRef}
          skin={skin}
          isOpen={isOpen}
          deckCards={deckCards}
          style={{
            transform: `
              rotateX(${DEFAULT_ROTATION.x}deg) 
              rotateY(${DEFAULT_ROTATION.y}deg) 
              ${isOpen ? 'translateY(-6px)' : 'translateY(0)'}
            `,
            transition: 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
};
