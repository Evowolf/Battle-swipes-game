import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeckBoxSkin, Element } from '../../types';
import { ASSETS, VFX, SOUNDS, ELEMENTAL_BACKDROPS } from '../../constants';
import { SolidDeckBox3D } from './DeckBox3D';
import { FastForward } from 'lucide-react';

interface BattleDeckBoxClashIntroProps {
  playerSkin: DeckBoxSkin;
  opponentSkin: DeckBoxSkin;
  playerName: string;
  opponentName: string;
  playerAvatar: string;
  opponentAvatar: string;
  currentEnvElement?: Element | null;
  arenaBackdrop?: string;
  playSound: (soundUrl: string) => void;
  isMuted?: boolean;
  onComplete: () => void;
  onExit?: () => void;
}

interface ParticleSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  drag: number;
  gravity: number;
  length: number;
}

interface ShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  growth: number;
  color: string;
  lineWidth: number;
}

export const BattleDeckBoxClashIntro: React.FC<BattleDeckBoxClashIntroProps> = ({
  playerSkin,
  opponentSkin,
  playerName = 'YOU',
  opponentName = 'Opponent',
  playerAvatar,
  opponentAvatar,
  currentEnvElement = Element.FIRE,
  arenaBackdrop,
  playSound,
  onComplete,
  onExit,
}) => {
  // Box opening & Clash FX states
  const [areBoxesOpen, setAreBoxesOpen] = useState(false);
  const [isClashImpact, setIsClashImpact] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Canvas particle refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<ParticleSpark[]>([]);
  const shockRingsRef = useRef<ShockRing[]>([]);
  const isCompletedRef = useRef(false);

  // Arena background fallback
  const arenaBg = arenaBackdrop || (currentEnvElement ? ELEMENTAL_BACKDROPS[currentEnvElement] : null) || ASSETS.BACKDROP;

  // Elemental particle colors
  const env = currentEnvElement || Element.FIRE;
  const explosionColors = React.useMemo(() => {
    switch (env) {
      case Element.ICE:
        return ['#ffffff', '#00f0ff', '#80d8ff', '#00b0ff', '#e0f7fa'];
      case Element.WIND:
        return ['#ffffff', '#00e676', '#69f0ae', '#1de9b6', '#b9f6ca'];
      case Element.EARTH:
        return ['#ffffff', '#ffd700', '#ffb300', '#ffca28', '#8d6e63'];
      case Element.FIRE:
      default:
        return ['#ffffff', '#ffeb3b', '#ffa000', '#ff5722', '#ff1744'];
    }
  }, [env]);

  // Spawn canvas particles on impact
  const triggerImpactVFX = useCallback((cx: number, cy: number) => {
    const sparks: ParticleSpark[] = [];

    // Tangential Vertical Spray
    for (let i = 0; i < 40; i++) {
      const isUp = i % 2 === 0;
      const speed = Math.random() * 18 + 7;
      const spreadX = (Math.random() - 0.5) * 12;
      const vy = isUp ? -speed : speed;
      const col = explosionColors[Math.floor(Math.random() * explosionColors.length)];
      sparks.push({
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + (Math.random() - 0.5) * 10,
        vx: spreadX,
        vy: vy,
        radius: Math.random() * 2.2 + 1,
        color: col,
        alpha: 1,
        decay: Math.random() * 0.022 + 0.015,
        drag: 0.95,
        gravity: isUp ? 0.22 : -0.12,
        length: Math.random() * 14 + 6,
      });
    }

    // Radial Blast Sparks
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 17 + 5;
      const col = explosionColors[Math.floor(Math.random() * explosionColors.length)];
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.2 + 1,
        color: col,
        alpha: 1,
        decay: Math.random() * 0.02 + 0.014,
        drag: 0.94,
        gravity: 0.12,
        length: Math.random() * 12 + 5,
      });
    }
    sparksRef.current = sparks;

    // Shockwave Rings
    const maxR = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.45, 230) : 200;
    const rings: ShockRing[] = [
      { x: cx, y: cy, radius: 8, maxRadius: maxR * 0.75, alpha: 1, growth: 16, color: '#ffffff', lineWidth: 4 },
      { x: cx, y: cy, radius: 5, maxRadius: maxR * 0.9, alpha: 0.9, growth: 20, color: explosionColors[1], lineWidth: 3 },
      { x: cx, y: cy, radius: 2, maxRadius: maxR, alpha: 0.8, growth: 24, color: '#ffd700', lineWidth: 2.2 },
    ];
    shockRingsRef.current = rings;
  }, [explosionColors]);

  // High-performance canvas particle render loop
  const hasClearedCanvasRef = useRef(false);
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      hasClearedCanvasRef.current = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const rings = shockRingsRef.current;
      const sparks = sparksRef.current;

      if (rings.length === 0 && sparks.length === 0) {
        if (!hasClearedCanvasRef.current) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasClearedCanvasRef.current = true;
        }
        animId = requestAnimationFrame(render);
        return;
      }

      hasClearedCanvasRef.current = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.radius += ring.growth;
        ring.alpha -= 0.026;
        ring.lineWidth = Math.max(0.5, ring.lineWidth * 0.95);

        if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
          rings.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.lineWidth;
        ctx.globalAlpha = Math.max(0, ring.alpha);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= sp.drag;
        sp.vy = sp.vy * sp.drag + sp.gravity;
        sp.alpha -= sp.decay;

        if (sp.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.alpha);
        ctx.strokeStyle = sp.color;
        ctx.fillStyle = sp.color;
        ctx.lineWidth = sp.radius;

        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x - sp.vx * 2, sp.y - sp.vy * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Sequence Timeline:
  // 1. T = 0ms: Left 3D box spins in from left, stops on left side (T = 750ms). Wooshing sound!
  // 2. T = 750ms: Right 3D box spins in from right, stops on right side (T = 1500ms). Wooshing sound!
  // 3. T = 1650ms: Both boxes are stopped. BOTH BOXES OPEN AT THE SAME TIME!
  //    As the lids open, the 2 player images are REVEALED rising up smoothly from the opened deck boxes!
  // 4. T = 2300ms: Both player images anticipate and DASH towards center!
  // 5. T = 2550ms: The 2 player images SLAM EDGE-TO-EDGE TOGETHER!
  //    Clash explosion sound (SOUNDS.VS_CLASH_EXPLOSION) plays, screen shake, flash, sparks & shockwave rings, and VS logo pops up!
  //    The two images stay together edge-to-edge shaking intensely in deadlock.
  // 6. T = 4100ms: Smooth transition to the altar draw phase!
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    // T = 0ms: Left 3D deck box spins in with Wooshing sound!
    playSound(SOUNDS.WOOSHING);

    // T = 750ms: Right 3D deck box spins in with Wooshing sound!
    timeouts.push(
      setTimeout(() => {
        playSound(SOUNDS.WOOSHING);
      }, 750)
    );

    // T = 1650ms: Both boxes slide in and stop. BOTH BOXES OPEN AT THE SAME TIME!
    timeouts.push(
      setTimeout(() => {
        setAreBoxesOpen(true);
        playSound(SOUNDS.CARD_SWIPE);
      }, 1650)
    );

    // T = 2550ms: Player images slam EDGE-TO-EDGE together at center!
    timeouts.push(
      setTimeout(() => {
        setIsClashImpact(true);
        setShowFlash(true);
        setIsScreenShaking(true);

        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([70, 40, 110]);
          }
        } catch {}

        playSound(SOUNDS.VS_CLASH_EXPLOSION);

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2 - 25;
        triggerImpactVFX(cx, cy);

        setTimeout(() => setShowFlash(false), 190);
        setTimeout(() => setIsScreenShaking(false), 500);
      }, 2550)
    );

    // T = 4100ms: Transition smoothly to Battle Arena!
    timeouts.push(
      setTimeout(() => {
        if (isCompletedRef.current) return;
        isCompletedRef.current = true;
        setIsExiting(true);
        setTimeout(() => {
          onComplete();
        }, 180);
      }, 4100)
    );

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [onComplete, playSound, triggerImpactVFX]);

  // Instant Skip functionality
  const handleSkip = useCallback(() => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    setIsExiting(true);

    playSound(SOUNDS.CARD_SWIPE);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    } catch {}

    setTimeout(() => {
      onComplete();
    }, 150);
  }, [playSound, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[120] overflow-hidden select-none bg-black flex flex-col items-center justify-between transition-all duration-400 ${
        isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      } ${isScreenShaking ? 'animate-clash-shake' : ''}`}
    >
      <style>{`
        /* Cinematic Letterbox Bars */
        .cinematic-letterbox {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 90;
          background: #000000;
          pointer-events: none;
        }

        /* Anime Speed Lines */
        @keyframes speedLinesStream {
          0% { transform: scale(1); opacity: 0.12; }
          50% { transform: scale(1.03); opacity: 0.35; }
          100% { transform: scale(1); opacity: 0.12; }
        }

        /* 1. LEFT 3D BOX: Spins 720deg in from left, STOPS on left side at 0.75s (18.3%), stays stopped */
        @keyframes leftBoxSpinInAndStop {
          0% {
            transform: translate3d(calc(-50vw - 120px), 18px, 0px);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          18.3% {
            /* 0.75s: STOPS cleanly on left side with safe center clearance */
            transform: translate3d(calc(-50vw + 68px), 18px, 0px);
            opacity: 1;
          }
          100% {
            transform: translate3d(calc(-50vw + 68px), 18px, 0px);
            opacity: 1;
          }
        }

        @keyframes leftBoxSpin {
          0% {
            transform: rotateY(-720deg) rotateX(15deg) scale3d(0.75, 0.75, 0.75);
          }
          18.3% {
            transform: rotateY(16deg) rotateX(-5deg) rotateZ(2deg) scale3d(1, 1, 1);
          }
          100% {
            transform: rotateY(16deg) rotateX(-5deg) rotateZ(2deg) scale3d(1, 1, 1);
          }
        }

        /* 2. RIGHT 3D BOX: Spins 720deg in from right starting at 0.75s, STOPS on right side at 1.50s (36.6%), stays stopped */
        @keyframes rightBoxSpinInAndStop {
          0%, 18.3% {
            transform: translate3d(calc(50vw + 120px), 18px, 0px);
            opacity: 0;
          }
          22% {
            opacity: 1;
          }
          36.6% {
            /* 1.50s: STOPS cleanly on right side with safe center clearance */
            transform: translate3d(calc(50vw - 68px), 18px, 0px);
            opacity: 1;
          }
          100% {
            transform: translate3d(calc(50vw - 68px), 18px, 0px);
            opacity: 1;
          }
        }

        @keyframes rightBoxSpin {
          0%, 18.3% {
            transform: rotateY(720deg) rotateX(-15deg) scale3d(0.75, 0.75, 0.75);
          }
          36.6% {
            transform: rotateY(-16deg) rotateX(5deg) rotateZ(-2deg) scale3d(1, 1, 1);
          }
          100% {
            transform: rotateY(-16deg) rotateX(5deg) rotateZ(-2deg) scale3d(1, 1, 1);
          }
        }

        /* 3. PLAYER IMAGE:
           - Hidden inside box until 1.65s (40.2%).
           - 1.65s (40.2%): Both boxes open! Image is REVEALED rising up out of the open box cavity!
           - 1.65s - 2.25s (40.2% - 54.9%): Rises smoothly, floats with glowing aura above the open box.
           - 2.25s - 2.45s (54.9% - 59.8%): Pull back slightly in anticipation.
           - 2.45s - 2.55s (59.8% - 62.2%): DASH & SLAM EDGE-TO-EDGE into center!
           - 2.55s - 100%: Stays locked edge-to-edge at center and shakes intensely with VS logo!
        */
        @keyframes playerAvatarAppearAndClash {
          0%, 40.2% {
            /* Inside closed/sliding box */
            transform: translate3d(calc(-50vw + 68px), 20px, 10px) scale(0);
            opacity: 0;
          }
          43.0% {
            /* Emerging through lid opening */
            transform: translate3d(calc(-50vw + 68px), -15px, 15px) scale(0.6);
            opacity: 0.8;
          }
          48.0% {
            /* Fully emerged and floating proudly above opened box */
            transform: translate3d(calc(-50vw + 68px), -68px, 20px) scale(1.08);
            opacity: 1;
          }
          53.0% {
            /* Settled float position */
            transform: translate3d(calc(-50vw + 68px), -68px, 20px) scale(1);
            opacity: 1;
          }
          57.5% {
            /* 2.35s: Anticipation windup pull-back */
            transform: translate3d(calc(-50vw + 58px), -70px, 20px) scale(0.96) rotateZ(-4deg);
            opacity: 1;
          }
          62.2% {
            /* 2.55s: SLAM EDGE-TO-EDGE AT CENTER! */
            transform: translate3d(calc(-50% + 0px), -68px, 25px) scale(1) rotateZ(2deg);
            opacity: 1;
          }
          /* Stay together edge-to-edge at center and shake */
          63.5% { transform: translate3d(calc(-50% + 1px), -70px, 25px) scale(1) rotateZ(1deg); }
          65.5% { transform: translate3d(calc(-50% - 2px), -66px, 25px) scale(1) rotateZ(3deg); }
          68.5% { transform: translate3d(calc(-50% + 1px), -69px, 25px) scale(1) rotateZ(1.5deg); }
          72.5% { transform: translate3d(calc(-50% - 1px), -67px, 25px) scale(1) rotateZ(2deg); }
          77.0% { transform: translate3d(calc(-50% + 0px), -68px, 25px) scale(1) rotateZ(1.5deg); }
          100% { transform: translate3d(calc(-50% + 0px), -68px, 25px) scale(1) rotateZ(1.5deg); opacity: 1; }
        }

        /* 4. OPPONENT IMAGE:
           - Hidden inside box until 1.65s (40.2%).
           - 1.65s (40.2%): Both boxes open! Image is REVEALED rising up out of the open box cavity!
           - 1.65s - 2.25s (40.2% - 54.9%): Rises smoothly, floats with glowing aura above the open box.
           - 2.25s - 2.45s (54.9% - 59.8%): Pull back slightly in anticipation.
           - 2.45s - 2.55s (59.8% - 62.2%): DASH & SLAM EDGE-TO-EDGE into center!
           - 2.55s - 100%: Stays locked edge-to-edge at center and shakes intensely with VS logo!
        */
        @keyframes opponentAvatarAppearAndClash {
          0%, 40.2% {
            /* Inside closed/sliding box */
            transform: translate3d(calc(50vw - 68px), 20px, 10px) scale(0);
            opacity: 0;
          }
          43.0% {
            /* Emerging through lid opening */
            transform: translate3d(calc(50vw - 68px), -15px, 15px) scale(0.6);
            opacity: 0.8;
          }
          48.0% {
            /* Fully emerged and floating proudly above opened box */
            transform: translate3d(calc(50vw - 68px), -68px, 20px) scale(1.08);
            opacity: 1;
          }
          53.0% {
            /* Settled float position */
            transform: translate3d(calc(50vw - 68px), -68px, 20px) scale(1);
            opacity: 1;
          }
          57.5% {
            /* 2.35s: Anticipation windup pull-back */
            transform: translate3d(calc(50vw - 58px), -70px, 20px) scale(0.96) rotateZ(4deg);
            opacity: 1;
          }
          62.2% {
            /* 2.55s: SLAM EDGE-TO-EDGE AT CENTER! */
            transform: translate3d(calc(50% - 0px), -68px, 25px) scale(1) rotateZ(-2deg);
            opacity: 1;
          }
          /* Stay together edge-to-edge at center and shake */
          63.5% { transform: translate3d(calc(50% - 1px), -70px, 25px) scale(1) rotateZ(-1deg); }
          65.5% { transform: translate3d(calc(50% + 2px), -66px, 25px) scale(1) rotateZ(-3deg); }
          68.5% { transform: translate3d(calc(50% - 1px), -69px, 25px) scale(1) rotateZ(-1.5deg); }
          72.5% { transform: translate3d(calc(50% + 1px), -67px, 25px) scale(1) rotateZ(-2deg); }
          77.0% { transform: translate3d(calc(50% - 0px), -68px, 25px) scale(1) rotateZ(-1.5deg); }
          100% { transform: translate3d(calc(50% - 0px), -68px, 25px) scale(1) rotateZ(-1.5deg); opacity: 1; }
        }

        /* 5. VS LOGO: Pops up right when images slam together at 2.55s (62.2%) */
        @keyframes vsLogoAppearOnClash {
          0%, 61.2% {
            transform: scale(0.05);
            opacity: 0;
          }
          62.2% {
            transform: scale(1.18);
            opacity: 1;
            filter: drop-shadow(0 0 24px rgba(250,204,21,1));
          }
          66.0% {
            transform: scale(0.95);
            opacity: 1;
          }
          74.0% {
            transform: scale(1.02);
            opacity: 1;
          }
          100% {
            transform: scale(1.0);
            opacity: 1;
            filter: drop-shadow(0 0 18px rgba(250,204,21,0.9));
          }
        }

        @keyframes avatarClashRumble {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-1.5px, 1.2px); }
          50% { transform: translate(1.5px, -1.2px); }
          75% { transform: translate(-1.2px, -1.5px); }
        }
        .animate-avatar-rumble {
          animation: avatarClashRumble 0.1s linear infinite;
        }

        /* Impact VFX */
        @keyframes radialShockSpikes {
          0% {
            transform: scale(0.1);
            opacity: 1;
            filter: brightness(2.2);
          }
          100% {
            transform: scale(1.85);
            opacity: 0;
            filter: brightness(1);
          }
        }

        @keyframes explosionBlastSprite {
          0% {
            transform: scale(0.1) rotate(0deg);
            opacity: 1;
          }
          40% {
            transform: scale(0.95) rotate(35deg);
            opacity: 0.95;
          }
          100% {
            transform: scale(1.25) rotate(70deg);
            opacity: 0;
          }
        }

        @keyframes clashShake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-8px, 6px); }
          20% { transform: translate(7px, -6px); }
          30% { transform: translate(-5px, 4px); }
          45% { transform: translate(4px, -3px); }
          60% { transform: translate(-2.5px, 2px); }
          75% { transform: translate(2px, -1px); }
        }
        .animate-clash-shake {
          animation: clashShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      {/* Cinematic Letterbox Bars */}
      <div className="cinematic-letterbox top-0 h-6 sm:h-8 border-b border-yellow-500/30 flex items-center justify-between px-3 sm:px-8">
        <span className="text-[7px] sm:text-[8.5px] font-black uppercase tracking-[0.22em] text-yellow-500/60">
          CHAMPIONSHIP DUEL ARENA
        </span>
        <span className="text-[7px] sm:text-[8.5px] font-black uppercase tracking-[0.22em] text-white/40">
          CLASH COMMENCEMENT
        </span>
      </div>
      <div className="cinematic-letterbox bottom-0 h-6 sm:h-8 border-t border-yellow-500/30 flex items-center justify-between px-3 sm:px-8">
        <span className="text-[7px] sm:text-[8.5px] font-black uppercase tracking-[0.22em] text-white/40">
          ROUND 1 · OPENING DRAW PHASE
        </span>
        <span className="text-[7px] sm:text-[8.5px] font-black uppercase tracking-[0.22em] text-yellow-500/60">
          3D DECK BOX SHOWDOWN
        </span>
      </div>

      {/* Atmospheric Arena Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 scale-105"
        style={{ backgroundImage: `url(${arenaBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/30 to-black/90 pointer-events-none" />

      {/* Speed Lines */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-20 mix-blend-screen"
        style={{
          backgroundImage: `repeating-conic-gradient(from 0deg, rgba(255,255,255,0.08) 0deg 3deg, transparent 3deg 15deg)`,
          animation: 'speedLinesStream 1.8s ease-in-out infinite',
        }}
      />

      {/* Flash Overlay */}
      {showFlash && (
        <div className="absolute inset-0 bg-white pointer-events-none z-50 animate-out fade-out duration-190" />
      )}

      {/* Duelist Name Banners Sliding In from Sides */}
      <div className="absolute top-9 sm:top-11 inset-x-0 z-30 flex items-center justify-between px-3 sm:px-8 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-black/85 border border-yellow-500/60 px-2 sm:px-3 py-0.5 rounded-lg shadow-md animate-in slide-in-from-left duration-400">
          <img
            src={playerAvatar}
            alt={playerName}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded object-cover border border-yellow-400"
          />
          <div>
            <span className="text-[6.5px] font-bold text-yellow-400 uppercase tracking-widest block">PLAYER</span>
            <span className="text-[9.5px] sm:text-[11px] font-black text-white uppercase tracking-wider block">{playerName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-yellow-500/40 text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-yellow-300">
          <span>{currentEnvElement ? `${currentEnvElement}` : 'DUEL'}</span>
          <span>•</span>
          <span>VS</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 bg-black/85 border border-red-500/60 px-2 sm:px-3 py-0.5 rounded-lg shadow-md animate-in slide-in-from-right duration-400 flex-row-reverse">
          <img
            src={opponentAvatar}
            alt={opponentName}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded object-cover border border-red-400"
          />
          <div className="text-right">
            <span className="text-[6.5px] font-bold text-red-400 uppercase tracking-widest block">CHALLENGER</span>
            <span className="text-[9.5px] sm:text-[11px] font-black text-white uppercase tracking-wider block">{opponentName}</span>
          </div>
        </div>
      </div>

      {/* Top Right Controls: Skip Button */}
      <div className="absolute top-1.5 sm:top-2 right-2 sm:right-6 z-50 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={handleSkip}
          className="px-2.5 sm:px-3 py-0.5 rounded-full bg-black/85 hover:bg-black text-yellow-300 border border-yellow-500/60 text-[8px] sm:text-[9.5px] font-black uppercase tracking-wider shadow flex items-center gap-1 transition-all active:scale-95"
        >
          <FastForward className="w-2.5 h-2.5 text-yellow-400" />
          <span>SKIP</span>
        </button>

        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="bg-black/70 hover:bg-black/90 active:scale-95 text-white/60 hover:text-white text-[7.5px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/20 transition-all shadow"
          >
            MENU
          </button>
        )}
      </div>

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-30"
      />

      {/* 3D ARENA VIEWPORT */}
      <div
        className="relative w-full flex-1 flex items-center justify-center pointer-events-none overflow-visible"
        style={{
          perspective: '1200px',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          className="relative flex items-center justify-center w-full h-full will-change-transform"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* 1. LEFT 3D BOX: Spins 720deg in, comes in and STOPS on left side. OPENS at 1.65s! */}
          <div
            className="absolute will-change-transform pointer-events-none flex items-center justify-center z-20"
            style={{
              width: '105px',
              height: '80px',
              transformStyle: 'preserve-3d',
              animation: 'leftBoxSpinInAndStop 4.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          >
            <div
              style={{
                width: '105px',
                height: '80px',
                transformStyle: 'preserve-3d',
                animation: 'leftBoxSpin 4.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              }}
            >
              <SolidDeckBox3D
                skin={playerSkin}
                isOpen={areBoxesOpen}
                showInsideCards={true}
              />
            </div>
          </div>

          {/* 2. RIGHT 3D BOX: Spins 720deg in after left box, comes in and STOPS on right side. OPENS at 1.65s! */}
          <div
            className="absolute will-change-transform pointer-events-none flex items-center justify-center z-20"
            style={{
              width: '105px',
              height: '80px',
              transformStyle: 'preserve-3d',
              animation: 'rightBoxSpinInAndStop 4.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          >
            <div
              style={{
                width: '105px',
                height: '80px',
                transformStyle: 'preserve-3d',
                animation: 'rightBoxSpin 4.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              }}
            >
              <SolidDeckBox3D
                skin={opponentSkin}
                isOpen={areBoxesOpen}
                showInsideCards={true}
              />
            </div>
          </div>

          {/* 3. PLAYER AVATAR IMAGE:
              Revealed rising up when box opens at 1.65s, sized a tad bigger, slams EDGE-TO-EDGE with opponent image! */}
          <div
            className="absolute will-change-transform pointer-events-none flex flex-col items-center justify-center z-30"
            style={{
              animation: 'playerAvatarAppearAndClash 4.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className={`relative flex flex-col items-center ${isClashImpact ? 'animate-avatar-rumble' : ''}`}>
              <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-300 rounded-full blur-md opacity-85 animate-pulse pointer-events-none" />

              {/* Tad bigger size: w-16 h-16 min-[380px]:w-20 min-[380px]:h-20 sm:w-28 sm:h-28 */}
              <div className="relative w-16 h-16 min-[380px]:w-20 min-[380px]:h-20 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-700 shadow-xl z-10 border-2 border-yellow-200">
                <div className="w-full h-full rounded-full overflow-hidden bg-black relative">
                  <img
                    src={playerAvatar}
                    alt={playerName}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. OPPONENT AVATAR IMAGE:
              Revealed rising up when box opens at 1.65s, sized a tad bigger, slams EDGE-TO-EDGE with player image! */}
          <div
            className="absolute will-change-transform pointer-events-none flex flex-col items-center justify-center z-30"
            style={{
              animation: 'opponentAvatarAppearAndClash 4.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className={`relative flex flex-col items-center ${isClashImpact ? 'animate-avatar-rumble' : ''}`}>
              <div className="absolute -inset-2 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 rounded-full blur-md opacity-85 animate-pulse pointer-events-none" />

              {/* Tad bigger size: w-16 h-16 min-[380px]:w-20 min-[380px]:h-20 sm:w-28 sm:h-28 */}
              <div className="relative w-16 h-16 min-[380px]:w-20 min-[380px]:h-20 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-b from-red-400 via-red-700 to-purple-900 shadow-xl z-10 border-2 border-red-300">
                <div className="w-full h-full rounded-full overflow-hidden bg-black relative">
                  <img
                    src={opponentAvatar}
                    alt={opponentName}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* 5. VS LOGO: Compact, appears right when images slam together */}
          <div
            className="absolute z-40 flex items-center justify-center pointer-events-none will-change-transform"
            style={{
              transform: 'translate3d(0, -68px, 30px)',
              animation: 'vsLogoAppearOnClash 4.1s ease-in-out forwards',
            }}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 sm:w-26 h-20 sm:h-26 rounded-full bg-gradient-to-r from-yellow-400/40 via-red-500/30 to-yellow-300/40 blur-md animate-spin-slow pointer-events-none" />
              <img
                src={ASSETS.VS_LOGO}
                alt="VS"
                className="w-12 min-[380px]:w-14 sm:w-20 h-12 min-[380px]:h-14 sm:h-20 object-contain filter drop-shadow-[0_0_18px_rgba(250,204,21,1)]"
              />
            </div>
          </div>

          {/* EXPLOSIVE SMASH COLLISION BLAST AT AVATAR CLASH SEAM */}
          {isClashImpact && (
            <div
              className="absolute z-40 flex flex-col items-center justify-center pointer-events-none"
              style={{
                transform: 'translate3d(0, -68px, 30px)',
              }}
            >
              <div
                className="absolute w-36 min-[380px]:w-44 sm:w-56 aspect-square rounded-full border border-yellow-300 opacity-90 blur-[0.5px]"
                style={{
                  animation: 'radialShockSpikes 0.65s ease-out forwards',
                }}
              />
              <div
                className="absolute w-28 min-[380px]:w-36 sm:w-44 aspect-square rounded-full border border-red-500 opacity-80 blur-[0.5px]"
                style={{
                  animation: 'radialShockSpikes 0.55s ease-out 0.04s forwards',
                }}
              />

              <img
                src={VFX.FIRE_BURST}
                alt="Fire Burst"
                className="absolute w-28 min-[380px]:w-36 sm:w-48 h-28 min-[380px]:h-36 sm:h-48 object-contain pointer-events-none filter drop-shadow-[0_0_18px_rgba(255,100,0,0.85)]"
                style={{
                  animation: 'explosionBlastSprite 0.65s ease-out forwards',
                }}
              />

              <img
                src={VFX.TIE_CLASH_EFFECT}
                alt="Clash Burst"
                className="w-24 min-[380px]:w-32 sm:w-40 h-24 min-[380px]:h-32 sm:h-40 object-contain pointer-events-none filter brightness-125 animate-pulse"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
