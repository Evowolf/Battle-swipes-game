import React, { useState, useEffect, useRef } from 'react';
import { ASSETS, VFX, SOUNDS } from '../../constants';
import { Element } from '../../types';
import { ParticleCanvas } from './ParticleCanvas';
import { LogOut, Swords, Zap, ChevronRight } from 'lucide-react';

interface DuelOpeningClashProps {
  playerProfileImage: string;
  playerName?: string;
  opponentImage: string;
  opponentName?: string;
  level?: number;
  currentEnvElement?: Element | null;
  playSound: (soundUrl: string) => void;
  isMuted?: boolean;
  onComplete: () => void;
  onExit?: () => void;
}

const FALLBACK_PROFILE = "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=80";

interface ParticleSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  decay: number;
  drag: number;
  gravity: number;
  length: number;
}

interface CanvasShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  growth: number;
  color: string;
  lineWidth: number;
}

interface ChargeStreamer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export const DuelOpeningClash: React.FC<DuelOpeningClashProps> = ({
  playerProfileImage,
  playerName = 'YOU',
  opponentImage,
  opponentName = 'Opponent',
  level = 1,
  currentEnvElement = Element.FIRE,
  playSound,
  onComplete,
  onExit,
}) => {
  const [clashPhase, setClashPhase] = useState<'intro' | 'charge' | 'impact' | 'outro'>('intro');
  const [hasImpacted, setHasImpacted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<ParticleSpark[]>([]);
  const shockRingsRef = useRef<CanvasShockRing[]>([]);
  const streamersRef = useRef<ChargeStreamer[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Dynamic elemental audio & asset mapping
  const env = currentEnvElement || Element.FIRE;
  const slashVFX = 
    env === Element.ICE ? VFX.ICE_SLASH : 
    env === Element.WIND ? VFX.WIND_SLASH : 
    env === Element.EARTH ? VFX.EARTH_SLASH : 
    VFX.FIRE_SLASH;

  const burstVFX = 
    env === Element.ICE ? VFX.ICE_BURST : 
    env === Element.WIND ? VFX.WIND_BURST : 
    env === Element.EARTH ? VFX.EARTH_BURST : 
    VFX.FIRE_BURST;

  const sliceSound = 
    env === Element.ICE ? SOUNDS.ICE_SLICE : 
    env === Element.WIND ? SOUNDS.WIND_SLICE : 
    env === Element.EARTH ? SOUNDS.EARTH_SLICE : 
    SOUNDS.FIRE_SLICE;

  const explosionSound = 
    env === Element.ICE ? SOUNDS.ICE_EXPLOSION : 
    env === Element.WIND ? SOUNDS.WIND_EXPLOSION : 
    env === Element.EARTH ? SOUNDS.EARTH_EXPLOSION : 
    SOUNDS.FIRE_EXPLOSION;

  // Elemental color theme for particles
  const elementColors = {
    [Element.FIRE]: ['#ff4500', '#ffa500', '#ffd700', '#ffffff', '#ff1a00'],
    [Element.ICE]: ['#00f0ff', '#80d8ff', '#e0f7fa', '#ffffff', '#00b0ff'],
    [Element.WIND]: ['#00e676', '#69f0ae', '#b9f6ca', '#ffffff', '#1de9b6'],
    [Element.EARTH]: ['#ffb300', '#ffca28', '#ffe082', '#ffffff', '#d7ccc8'],
  }[env] || ['#ffaa00', '#ffd700', '#ffffff'];

  // Spawn explosive burst particles on impact
  const triggerImpactSparks = (cx: number, cy: number) => {
    const count = 120;
    const newSparks: ParticleSpark[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 16 + 4;
      const col = elementColors[Math.floor(Math.random() * elementColors.length)];
      newSparks.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        radius: Math.random() * 3.5 + 1.5,
        maxRadius: Math.random() * 6 + 3,
        color: col,
        alpha: 1,
        decay: Math.random() * 0.025 + 0.012,
        drag: 0.935,
        gravity: 0.12,
        length: Math.random() * 12 + 6,
      });
    }
    sparksRef.current = newSparks;

    // Expanding shockwave rings on canvas
    shockRingsRef.current = [
      {
        x: cx,
        y: cy,
        radius: 10,
        maxRadius: Math.min(window.innerWidth, window.innerHeight) * 0.75,
        alpha: 1,
        growth: 24,
        color: '#ffffff',
        lineWidth: 6,
      },
      {
        x: cx,
        y: cy,
        radius: 5,
        maxRadius: Math.min(window.innerWidth, window.innerHeight) * 0.9,
        alpha: 0.9,
        growth: 18,
        color: elementColors[0],
        lineWidth: 4,
      },
      {
        x: cx,
        y: cy,
        radius: 2,
        maxRadius: Math.min(window.innerWidth, window.innerHeight) * 1.1,
        alpha: 0.75,
        growth: 14,
        color: '#ffd700',
        lineWidth: 2,
      },
    ];
  };

  // Canvas render loop for high-velocity particle physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 1. Charge Streamers (Inward swirling energy during charge)
      if (streamersRef.current.length > 0) {
        for (let i = streamersRef.current.length - 1; i >= 0; i--) {
          const s = streamersRef.current[i];
          s.x += s.vx;
          s.y += s.vy;
          s.alpha -= s.decay;

          // Pull slightly toward target
          const dx = s.targetX - s.x;
          const dy = s.targetY - s.y;
          s.vx += dx * 0.05;
          s.vy += dy * 0.05;

          ctx.save();
          ctx.globalAlpha = Math.max(0, s.alpha);
          ctx.fillStyle = s.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = s.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, Math.max(0.1, s.radius), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          if (s.alpha <= 0) {
            streamersRef.current.splice(i, 1);
          }
        }
      }

      // 2. Shockwave Rings
      if (shockRingsRef.current.length > 0) {
        for (let i = shockRingsRef.current.length - 1; i >= 0; i--) {
          const r = shockRingsRef.current[i];
          r.radius += r.growth;
          r.growth *= 0.96;
          r.alpha *= 0.93;

          ctx.save();
          ctx.globalAlpha = Math.max(0, r.alpha);
          ctx.strokeStyle = r.color;
          ctx.lineWidth = Math.max(0.1, r.lineWidth);
          ctx.shadowBlur = 15;
          ctx.shadowColor = r.color;
          ctx.beginPath();
          ctx.arc(r.x, r.y, Math.max(0.1, r.radius), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          if (r.alpha <= 0.02 || r.radius >= r.maxRadius) {
            shockRingsRef.current.splice(i, 1);
          }
        }
      }

      // 3. Explosive Sparks
      if (sparksRef.current.length > 0) {
        for (let i = sparksRef.current.length - 1; i >= 0; i--) {
          const p = sparksRef.current[i];
          p.vx *= p.drag;
          p.vy *= p.drag;
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;

          // Elongated spark in motion vector direction
          const speed = Math.hypot(p.vx, p.vy);
          if (speed > 1.5) {
            ctx.beginPath();
            ctx.moveTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
            ctx.lineTo(p.x + p.vx * 0.5, p.y + p.vy * 0.5);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(0.1, p.radius * 0.9);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, p.radius), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          if (p.alpha <= 0) {
            sparksRef.current.splice(i, 1);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Sequence orchestrator for high-impact pacing
  useEffect(() => {
    // Initial entrance sound
    playSound(SOUNDS.CARD_SWIPE);

    // Charge phase: portraits prepare to smash together
    const chargeTimer = setTimeout(() => {
      setClashPhase('charge');
      playSound(sliceSound);

      // Spawn charge energy streamers
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pTargetX = width * 0.32;
      const oTargetX = width * 0.68;
      const cy = height * 0.5;

      const newStreamers: ChargeStreamer[] = [];
      for (let i = 0; i < 40; i++) {
        // Left duelist streamers
        const angleL = Math.random() * Math.PI * 2;
        const distL = Math.random() * 140 + 80;
        newStreamers.push({
          x: pTargetX + Math.cos(angleL) * distL,
          y: cy + Math.sin(angleL) * distL,
          vx: -Math.cos(angleL) * 3,
          vy: -Math.sin(angleL) * 3,
          targetX: pTargetX,
          targetY: cy,
          radius: Math.random() * 2.5 + 1.2,
          color: '#ffd700',
          alpha: 0.9,
          decay: 0.02,
        });

        // Right duelist streamers
        const angleR = Math.random() * Math.PI * 2;
        const distR = Math.random() * 140 + 80;
        newStreamers.push({
          x: oTargetX + Math.cos(angleR) * distR,
          y: cy + Math.sin(angleR) * distR,
          vx: -Math.cos(angleR) * 3,
          vy: -Math.sin(angleR) * 3,
          targetX: oTargetX,
          targetY: cy,
          radius: Math.random() * 2.5 + 1.2,
          color: '#ff3344',
          alpha: 0.9,
          decay: 0.02,
        });
      }
      streamersRef.current = newStreamers;
    }, 600);

    // Impact phase: portraits collide with flash, shockwave, and clean clash impact
    const impactTimer = setTimeout(() => {
      setClashPhase('impact');
      setHasImpacted(true);
      playSound(SOUNDS.VS_CLASH_EXPLOSION);

      // Trigger particle explosion at center
      triggerImpactSparks(window.innerWidth / 2, window.innerHeight / 2);

      // Haptic bump on mobile devices
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([35, 60, 45]);
        }
      } catch {}
    }, 1250);

    // Outro transition
    const outroTimer = setTimeout(() => {
      setClashPhase('outro');
    }, 2250);

    // Final finish and return to arena
    const finishTimer = setTimeout(() => {
      onComplete();
    }, 2750);

    return () => {
      clearTimeout(chargeTimer);
      clearTimeout(impactTimer);
      clearTimeout(outroTimer);
      clearTimeout(finishTimer);
    };
  }, [playSound, sliceSound, explosionSound, onComplete]);

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div 
      className={`fixed inset-0 z-[200] bg-black flex flex-col items-center justify-between overflow-hidden font-cinzel select-none touch-none transition-opacity duration-500 ${
        clashPhase === 'outro' ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100'
      } ${hasImpacted && clashPhase === 'impact' ? 'animate-shake-heavy' : ''}`}
      onClick={handleSkip}
    >
      {/* Dynamic Realm Backdrop */}
      <div 
        className="absolute inset-0 bg-cover bg-center brightness-[0.25] scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${ASSETS.BACKDROP})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />

      {/* Cinematic Volumetric Light Rays in Background */}
      <div className="absolute top-1/2 left-1/2 w-[140vw] h-[140vw] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-30 blur-xl animate-cinematic-rays bg-[conic-gradient(from_0deg_at_50%_50%,rgba(255,215,0,0.5)_0deg,transparent_30deg,rgba(239,68,68,0.5)_60deg,transparent_90deg,rgba(255,255,255,0.4)_120deg,transparent_150deg,rgba(255,215,0,0.5)_180deg,transparent_210deg,rgba(239,68,68,0.5)_240deg,transparent_270deg,rgba(255,255,255,0.4)_300deg,transparent_330deg)]" />

      {/* Speed lines during charge */}
      <div className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-300 ${
        clashPhase === 'charge' || clashPhase === 'impact' ? 'opacity-40' : 'opacity-0'
      } bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(255,215,0,0.15)_85%,rgba(239,68,68,0.25)_100%)]`} />

      {/* Organic Elemental Floating Particles in Background */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-75">
        <ParticleCanvas element={env} isHero={true} />
      </div>

      {/* Dedicated High-Performance Particle Explosion Canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-30"
      />

      {/* Optional Top Exit Button */}
      {onExit && (
        <button
          onClick={onExit}
          className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[250] bg-black/80 hover:bg-black text-white/80 hover:text-white px-3 py-1.5 rounded-full border border-white/25 backdrop-blur-md text-[9px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
        >
          <LogOut className="w-3.5 h-3.5 text-white/80" />
          <span>EXIT MATCH</span>
        </button>
      )}

      {/* Screen Whiteout Flash upon Impact */}
      {hasImpacted && clashPhase === 'impact' && (
        <div className="absolute inset-0 z-[300] bg-white animate-flash pointer-events-none" />
      )}

      {/* Primary Clash Action Arena - Fully Mobile Friendly, Perfectly Centered */}
      <div className="relative z-20 w-full max-w-4xl mx-auto h-full flex flex-col justify-between items-center py-4 sm:py-8 px-2 min-[380px]:px-4 sm:px-8">
        
        {/* TOP STATUS BADGE - Positioned cleanly up top with dedicated breathing room */}
        <div className="w-full flex flex-col items-center gap-1 shrink-0 pt-1 sm:pt-2 mb-1 sm:mb-3 z-30 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 rounded-full bg-black/85 border border-yellow-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(234,179,8,0.3)]">
            <Swords className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
              DUEL ARENA CLASH
            </span>
            <Swords className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] font-bold text-white/70 uppercase tracking-widest bg-black/60 px-2.5 py-0.5 rounded-full border border-white/10 shadow-sm">
            <span className="text-yellow-400 font-black">{currentEnvElement || 'FIRE'} REALM</span>
            <span>•</span>
            <span>STAGE {level}</span>
          </div>
        </div>

        {/* CENTER CLASH STAGE */}
        <div className="w-full flex-1 flex flex-col items-center justify-center relative my-auto">
          
          {/* Main Fighters & VS Row - Mobile optimized gap, responsive proportions */}
          <div className="w-full flex flex-row items-center justify-center gap-1.5 min-[380px]:gap-3 sm:gap-8 md:gap-14 relative">
            
            {/* PLAYER (Left Fighter) */}
            <div 
              className={`flex flex-col items-center gap-1.5 sm:gap-3 transition-all duration-500 ease-out shrink-0 ${
                clashPhase === 'intro'
                  ? 'translate-x-0 opacity-100 scale-100 animate-spin-in-l'
                  : clashPhase === 'charge'
                  ? 'translate-x-3 min-[380px]:translate-x-5 sm:translate-x-14 md:translate-x-20 scale-105 rotate-2'
                  : clashPhase === 'impact'
                  ? 'translate-x-5 min-[380px]:translate-x-7 sm:translate-x-18 md:translate-x-24 scale-110 rotate-3'
                  : 'translate-x-0 opacity-0 scale-95'
              }`}
            >
              {/* Avatar Frame with Shake wrapper */}
              <div className={`relative group ${clashPhase === 'impact' ? 'animate-impact-hit' : ''}`}>
                {/* Glowing Aura Ring */}
                <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-300 rounded-full blur-lg sm:blur-xl opacity-80 animate-pulse" />
                
                {/* Avatar Circular Frame */}
                <div className="relative w-20 h-20 min-[380px]:w-24 min-[380px]:h-24 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-full p-1 sm:p-2 bg-gradient-to-b from-yellow-300 via-amber-600 to-yellow-800 shadow-[0_0_35px_rgba(234,179,8,0.8)] z-10">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 sm:border-4 border-yellow-200 bg-black relative shadow-inner">
                    <img 
                      src={playerProfileImage || FALLBACK_PROFILE} 
                      alt="Player Profile" 
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_PROFILE;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Player Crest Emblem Badge */}
                  <div className="absolute -bottom-2 sm:-bottom-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-2 sm:px-3.5 py-0.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider border border-white/80 shadow-lg whitespace-nowrap z-20 flex items-center gap-1">
                    <Swords className="w-3 h-3 text-black shrink-0" />
                    <span>DUELIST</span>
                  </div>
                </div>
              </div>

              {/* Player Name and Role Label - Truncated and centered, no overlap */}
              <div className="text-center mt-1 z-20 max-w-[85px] min-[380px]:max-w-[105px] sm:max-w-[160px]">
                <h3 className="text-xs min-[380px]:text-sm sm:text-xl md:text-2xl font-black text-yellow-400 uppercase tracking-wider drop-shadow-[0_0_12px_rgba(234,179,8,0.8)] truncate" title={playerName}>
                  {playerName}
                </h3>
                <span className="inline-block text-[7px] min-[380px]:text-[8px] sm:text-[10px] font-bold text-yellow-200/80 tracking-widest uppercase bg-yellow-950/80 px-2 py-0.5 rounded-full border border-yellow-600/40 truncate">
                  CHALLENGER
                </span>
              </div>
            </div>

            {/* CENTER AXIS: VS LOGO & CLASH VFX */}
            <div className="relative flex flex-col items-center justify-center shrink-0 w-12 min-[380px]:w-16 sm:w-28 md:w-36 z-30">
              
              {/* Tie Clash Shockwave & Crossing Slashes on Impact */}
              {hasImpacted && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                  <img 
                    src={VFX.TIE_CLASH_EFFECT} 
                    className="animate-tie-clash absolute w-48 min-[380px]:w-64 sm:w-[420px] max-w-none" 
                    alt="Clash Burst" 
                  />
                  {/* Crossing Elemental Slashes */}
                  <img 
                    src={slashVFX} 
                    className="animate-slash absolute w-52 min-[380px]:w-72 sm:w-[460px] max-w-none pointer-events-none" 
                    style={{ transform: 'translate(-50%, -50%) rotate(-35deg)' }}
                    alt="Slash 1" 
                  />
                  <img 
                    src={slashVFX} 
                    className="animate-slash absolute w-52 min-[380px]:w-72 sm:w-[460px] max-w-none pointer-events-none" 
                    style={{ transform: 'translate(-50%, -50%) rotate(35deg)' }}
                    alt="Slash 2" 
                  />
                  <img 
                    src={burstVFX} 
                    className="animate-burst absolute w-44 min-[380px]:w-60 sm:w-[380px] max-w-none pointer-events-none" 
                    alt="Elemental Burst" 
                  />
                </div>
              )}

              {/* VS Logo */}
              <div className={`transition-all duration-300 relative z-20 ${
                clashPhase === 'impact' ? 'scale-115 sm:scale-130 brightness-150' : 'scale-100'
              }`}>
                <img 
                  src={ASSETS.VS_LOGO} 
                  alt="Versus" 
                  className="w-10 min-[380px]:w-14 sm:w-24 md:w-32 h-auto drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] animate-vs"
                />
              </div>
            </div>

            {/* OPPONENT (Right Fighter) */}
            <div 
              className={`flex flex-col items-center gap-1.5 sm:gap-3 transition-all duration-500 ease-out shrink-0 ${
                clashPhase === 'intro'
                  ? 'translate-x-0 opacity-100 scale-100 animate-spin-in-r'
                  : clashPhase === 'charge'
                  ? '-translate-x-3 min-[380px]:-translate-x-5 sm:-translate-x-14 md:-translate-x-20 scale-105 -rotate-2'
                  : clashPhase === 'impact'
                  ? '-translate-x-5 min-[380px]:-translate-x-7 sm:-translate-x-18 md:-translate-x-24 scale-110 -rotate-3'
                  : 'translate-x-0 opacity-0 scale-95'
              }`}
            >
              {/* Avatar Frame with Shake wrapper */}
              <div className={`relative group ${clashPhase === 'impact' ? 'animate-impact-hit' : ''}`}>
                {/* Glowing Aura Ring */}
                <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 rounded-full blur-lg sm:blur-xl opacity-80 animate-pulse" />
                
                {/* Avatar Circular Frame */}
                <div className="relative w-20 h-20 min-[380px]:w-24 min-[380px]:h-24 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-full p-1 sm:p-2 bg-gradient-to-b from-red-400 via-red-800 to-purple-950 shadow-[0_0_35px_rgba(239,68,68,0.8)] z-10">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 sm:border-4 border-red-300 bg-black relative shadow-inner">
                    <img 
                      src={opponentImage} 
                      alt="Opponent Profile" 
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Opponent Crest Emblem Badge */}
                  <div className="absolute -bottom-2 sm:-bottom-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-purple-700 text-white px-2 sm:px-3.5 py-0.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider border border-white/80 shadow-lg whitespace-nowrap z-20 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-white shrink-0" />
                    <span>LVL {level}</span>
                  </div>
                </div>
              </div>

              {/* Opponent Name and Role Label - Truncated and centered, no overlap */}
              <div className="text-center mt-1 z-20 max-w-[85px] min-[380px]:max-w-[105px] sm:max-w-[160px]">
                <h3 className="text-xs min-[380px]:text-sm sm:text-xl md:text-2xl font-black text-red-500 uppercase tracking-wider drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] truncate" title={opponentName}>
                  {opponentName}
                </h3>
                <span className="inline-block text-[7px] min-[380px]:text-[8px] sm:text-[10px] font-bold text-red-200/80 tracking-widest uppercase bg-red-950/80 px-2 py-0.5 rounded-full border border-red-600/40 truncate">
                  DEFENDER
                </span>
              </div>
            </div>

          </div>

          {/* CLASH ANNOUNCEMENT BANNER - Positioned below fighters with ample room */}
          <div className="w-full text-center mt-4 sm:mt-8 min-h-[36px] flex items-center justify-center px-4">
            {hasImpacted ? (
              <div className="text-base min-[380px]:text-lg sm:text-3xl md:text-4xl font-black uppercase tracking-[0.15em] sm:tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-amber-500 drop-shadow-[0_0_30px_rgba(255,215,0,0.95)] animate-realm-text text-center">
                DUEL COMMENCED!
              </div>
            ) : (
              <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-white/50 animate-pulse">
                INITIALIZING CLASH...
              </div>
            )}
          </div>

        </div>

        {/* BOTTOM SKIP / ADVANCE BUTTON - Always visible and accessible */}
        <div className="w-full flex justify-center pb-2 z-40 shrink-0">
          <button 
            onClick={handleSkip}
            className="bg-black/70 hover:bg-black/90 border border-yellow-500/40 text-yellow-300/90 hover:text-yellow-300 px-4 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_15px_rgba(0,0,0,0.8)] min-h-[44px]"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>TAP TO ENTER DUEL &gt;&gt;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
