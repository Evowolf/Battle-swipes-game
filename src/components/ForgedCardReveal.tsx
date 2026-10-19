import React, { useEffect, useRef, useState } from 'react';
import { Card, Element, CardType, Rarity } from '../../types';
import { RARITY_CONFIGS } from '../utils/rarity';
import { ELEMENT_ICONS, SOUNDS } from '../../constants';
import { Crown, RotateCw, RotateCcw, Zap, Swords, Axe, Shield, Check, Sparkles, X } from 'lucide-react';

interface ForgedCardRevealProps {
  card: Card;
  onInspect3D: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  shape: 'circle' | 'star' | 'rune';
  char?: string;
  rot: number;
  rotSpeed: number;
}

export const ForgedCardReveal: React.FC<ForgedCardRevealProps> = ({
  card,
  onInspect3D,
  onKeep,
  onDiscard,
}) => {
  const [animKey, setAnimKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isHero = card.type === CardType.HERO || Boolean(card.isHero);
  const rarityConfig = RARITY_CONFIGS[card.rarity || Rarity.COMMON];

  // Sound and animation lifecycle
  useEffect(() => {
    setIsSpinning(true);

    // Play card spawning sound when the card is forged and revealed
    const playRevealAudio = () => {
      try {
        const sfx = new Audio(SOUNDS.CARD_SPAWN);
        sfx.volume = 0.75;
        sfx.play().catch(() => {});

        if (isHero) {
          setTimeout(() => {
            const heroSfx = new Audio(SOUNDS.CHIME);
            heroSfx.volume = 0.75;
            heroSfx.play().catch(() => {});
          }, 600);
        }
      } catch {
        // Audio error ignored
      }
    };

    playRevealAudio();

    // The 3D spin lasts 2.2s before settling back into resting placement
    const timer = setTimeout(() => {
      setIsSpinning(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, [animKey, card.id, card.element, isHero]);

  // Particle System
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isMounted = true;

    const W = (canvas.width = 460);
    const H = (canvas.height = 580);
    const cx = W / 2;
    const cy = H / 2;

    const particles: SparkParticle[] = [];

    // Colors matching element and hero
    const getColors = (): string[] => {
      if (isHero) {
        return ['#facc15', '#fef08a', '#fbbf24', '#ffffff', '#f59e0b'];
      }
      switch (card.element) {
        case Element.FIRE:
          return ['#ef4444', '#f97316', '#fbbf24', '#f87171', '#ffedd5'];
        case Element.ICE:
          return ['#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff', '#0284c7'];
        case Element.WIND:
          return ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#ffffff'];
        case Element.EARTH:
          return ['#f59e0b', '#d97706', '#fbbf24', '#b45309', '#fef3c7'];
        default:
          return ['#fbbf24', '#ffffff'];
      }
    };

    const colors = getColors();
    const runes = ['✦', '★', '◆', '▲', '⬥'];

    // Spawn initial burst of 65 particles
    const count = isHero ? 80 : 55;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 3 + Math.random() * 8.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const isRune = Math.random() < 0.35;

      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: isRune ? 12 + Math.random() * 8 : 3 + Math.random() * 5,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.018,
        color,
        shape: isRune ? 'rune' : Math.random() < 0.3 ? 'star' : 'circle',
        char: runes[Math.floor(Math.random() * runes.length)],
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
      });
    }

    // Continuous trailing ambient sparks during spin
    let frameCount = 0;
    const render = () => {
      if (!isMounted) return;
      frameCount++;
      ctx.clearRect(0, 0, W, H);

      // Add gentle fountain while spinning
      if (frameCount < 110 && frameCount % 3 === 0) {
        for (let j = 0; j < 2; j++) {
          const a = Math.random() * Math.PI * 2;
          const s = 1.5 + Math.random() * 4;
          particles.push({
            x: cx + (Math.random() - 0.5) * 60,
            y: cy + (Math.random() - 0.5) * 80,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s - 1.2,
            size: 2.5 + Math.random() * 4,
            alpha: 0.95,
            decay: 0.02 + Math.random() * 0.02,
            color: colors[Math.floor(Math.random() * colors.length)],
            shape: Math.random() < 0.4 ? 'star' : 'circle',
            rot: 0,
            rotSpeed: 0.05,
          });
        }
      }

      // Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96; // air resistance
        p.vy *= 0.96;
        p.rot += p.rotSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        if (p.shape === 'rune' && p.char) {
          ctx.font = `bold ${Math.round(p.size)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.char, p.x, p.y);
        } else if (p.shape === 'star') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          for (let s = 0; s < 5; s++) {
            ctx.lineTo(Math.cos(((18 + s * 72) * Math.PI) / 180) * p.size, -Math.sin(((18 + s * 72) * Math.PI) / 180) * p.size);
            ctx.lineTo(Math.cos(((54 + s * 72) * Math.PI) / 180) * (p.size / 2), -Math.sin(((54 + s * 72) * Math.PI) / 180) * (p.size / 2));
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (particles.length > 0 || frameCount < 130) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [animKey, card.element, isHero]);

  const handleReplay = () => {
    setAnimKey(prev => prev + 1);
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 sm:gap-6 z-10 py-2 w-full max-w-sm">
      {/* Container holding Particle Canvas, Shockwave, and Spinning Card */}
      <div className="relative flex items-center justify-center w-full min-h-[380px] sm:min-h-[440px]">
        {/* Background Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-0 w-full h-full object-contain"
        />

        {/* Radiant Expanding Shockwave on Forge/Replay */}
        <div
          key={`shockwave-${animKey}`}
          className="animate-forge-shockwave z-0"
          style={{
            borderColor: isHero ? '#eab308' : rarityConfig.color,
            boxShadow: `0 0 60px ${isHero ? 'rgba(234, 179, 8, 0.8)' : rarityConfig.glowColor}`,
          }}
        />

        {/* Ambient Halo Behind Card */}
        <div
          className={`absolute w-44 h-64 sm:w-56 sm:h-80 rounded-full blur-3xl opacity-60 pointer-events-none transition-all duration-700 ${
            isHero ? 'bg-yellow-500/50' : 'bg-red-500/30'
          }`}
          style={{
            backgroundColor: isHero ? 'rgba(234, 179, 8, 0.45)' : rarityConfig.glowColor,
          }}
        />

        {/* 3D Spinning & Settling Card Container */}
        <div
          key={`card-${animKey}`}
          className="relative group cursor-pointer animate-forge-spin-settle z-10"
          onClick={onInspect3D}
          onDoubleClick={onInspect3D}
          title="Double-click or tap to inspect in interactive 3D"
        >
          <img
            src={card.image}
            alt={card.name}
            className={`w-48 min-[380px]:w-56 sm:w-68 lg:w-72 aspect-[640/880] rounded-2xl border-4 ${rarityConfig.borderClass} group-hover:scale-102 transition-transform bg-black object-contain shadow-2xl`}
            style={{ borderColor: rarityConfig.color }}
          />

          {/* Element corner emblem */}
          <div className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 w-9 h-9 sm:w-12 sm:h-12 bg-black border-2 border-yellow-500 rounded-full p-1.5 sm:p-2 shadow-xl">
            <img src={ELEMENT_ICONS[card.element]} alt={card.element} className="w-full h-full object-contain" />
          </div>

          {/* Hero Awakening Badge */}
          {isHero && (
            <div className="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-black text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-full shadow-2xl border-2 border-white animate-bounce flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-black shrink-0" />
              <span>HERO AWAKENED</span>
            </div>
          )}

          {/* 3D Inspect Prompt Hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/85 border border-white/30 text-yellow-300 text-[10px] font-black px-3 py-1 rounded-full backdrop-blur-md shadow-lg flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <RotateCw className="w-3 h-3 text-yellow-300 shrink-0" />
            <span>DOUBLE-TAP TO ROTATE 3D</span>
          </div>
        </div>
      </div>

      {/* Hero Status Banner Announcement if Hero was drawn */}
      {isHero && card.heroStatus && (
        <div className="w-full px-4 py-2 bg-gradient-to-r from-yellow-950/90 via-amber-900/90 to-yellow-950/90 border border-yellow-500/80 rounded-xl text-center shadow-xl animate-in fade-in zoom-in-95 duration-500">
          <div className="text-[10px] sm:text-xs font-black text-yellow-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
            <span>HERO STATUS: {card.heroStatus}</span>
            <Zap className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
          </div>
          <div className="text-[9px] sm:text-[10px] text-yellow-100/80 font-serif italic mt-0.5">
            {card.baseWeapon ? `Elevated ${card.baseWeapon} stats granted by legendary ascension!` : 'Elevated higher stats granted by hero ascension!'}
          </div>
        </div>
      )}

      {/* Card Metadata & Action Controls */}
      <div className="text-center w-full space-y-3">
        <div>
          <h3 className="text-lg sm:text-2xl font-black text-yellow-400 drop-shadow-lg">
            {card.name}
          </h3>
          <p className="text-[10px] sm:text-xs text-yellow-200/70 font-serif italic max-w-xs mx-auto">
            {card.description}
          </p>
        </div>

        {/* Stat Summary Badges */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm font-black flex-wrap">
          <span className="px-3 py-1 bg-red-950/80 border border-red-500/60 rounded-lg text-red-400 shadow flex items-center gap-1">
            <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>ATK {card.attack}</span>
          </span>
          <span className="px-3 py-1 bg-yellow-950/80 border border-yellow-500/60 rounded-lg text-yellow-400 shadow flex items-center gap-1">
            {isHero ? (
              <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            ) : card.type === CardType.SWORD ? (
              <Swords className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            ) : card.type === CardType.AXE ? (
              <Axe className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            )}
            <span>{isHero ? `HERO ${card.baseWeapon || card.type}` : card.type}</span>
          </span>
          <span className="px-3 py-1 bg-blue-950/80 border border-blue-500/60 rounded-lg text-blue-400 shadow flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>DEF {card.defense}</span>
          </span>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap gap-2.5 sm:gap-3 justify-center pt-2">
          <button
            id="forge-enshrine-vault-btn"
            onClick={onKeep}
            className="min-h-[48px] bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-5 sm:px-7 py-2.5 rounded-full font-black text-xs sm:text-sm hover:brightness-110 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 text-black shrink-0" />
            <span>ENSHRINE IN VAULT</span>
          </button>

          <button
            id="forge-replay-reveal-btn"
            onClick={handleReplay}
            title="Replay 3D spin and particle burst"
            className="min-h-[48px] bg-white/10 hover:bg-white/20 text-yellow-300 border border-yellow-500/40 px-3.5 sm:px-4 py-2.5 rounded-full font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-yellow-300 shrink-0" />
            <span className="hidden sm:inline">REPLAY</span>
          </button>

          <button
            id="forge-inspect-3d-btn"
            onClick={onInspect3D}
            className="min-h-[48px] bg-purple-950/80 hover:bg-purple-900/90 text-purple-200 border border-purple-500/40 px-3.5 sm:px-4 py-2.5 rounded-full font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-purple-200 shrink-0" />
            <span>3D</span>
          </button>

          <button
            id="forge-recycle-card-btn"
            onClick={onDiscard}
            title="Discard this card"
            className="min-h-[48px] bg-white/10 text-white/60 px-3.5 sm:px-4 py-2.5 rounded-full font-black text-xs sm:text-sm hover:bg-red-600 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <X className="w-4 h-4 text-current shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
