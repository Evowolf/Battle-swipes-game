import React, { useEffect, useRef } from 'react';
import { Element } from '../../types';

interface ParticleCanvasProps {
  element: Element;
  isHero?: boolean;
  isShield?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  decay: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  type: 'flame' | 'ember' | 'smoke' | 'frost' | 'shard' | 'snow' | 'ribbon' | 'wind_dust' | 'gravel' | 'earth_dust';
  customData?: any;
}

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({ element, isHero = false, isShield = false }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isMounted = true;

    // Dynamically size canvas to container with robust defaults
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width, 500);
      const h = Math.max(rect.height, 500);
      canvas.width = w;
      canvas.height = h;
    };

    updateSize();

    let width = canvas.width;
    let height = canvas.height;
    let centerX = width / 2;
    let centerY = height / 2;

    const particles: Particle[] = [];
    const density = isHero ? 1.8 : 1.0;

    // --- PARTICLE CREATION HELPERS ---
    const spawnFlame = (isInitial = false) => {
      const flameColors = [
        'rgba(255, 255, 255, 0.95)',
        'rgba(255, 220, 90, 0.9)',
        'rgba(255, 130, 20, 0.8)',
        'rgba(235, 60, 10, 0.7)',
        'rgba(180, 20, 0, 0.5)',
      ];
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 0.5;
      const offset = isInitial ? Math.random() * 40 : Math.random() * 15;
      particles.push({
        x: centerX + Math.cos(angle) * offset,
        y: centerY + Math.sin(angle) * offset,
        vx: Math.cos(angle) * speed * 0.6 + (Math.random() - 0.5) * 1,
        vy: -Math.random() * 3.5 - 1.5, // rising flame
        radius: Math.random() * 16 + 12,
        maxRadius: Math.random() * 45 + 30,
        alpha: 0.9,
        decay: Math.random() * 0.018 + 0.012,
        color: flameColors[Math.floor(Math.random() * flameColors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        type: 'flame',
      });
    };

    const spawnEmber = (isInitial = false) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = isInitial ? Math.random() * 6 + 2 : Math.random() * 4 + 1.5;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2.5,
        radius: Math.random() * 2.5 + 1,
        maxRadius: 4,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        color: Math.random() > 0.35 ? '#ffea00' : '#ff3300',
        rotation: 0,
        rotSpeed: 0,
        type: 'ember',
        customData: { sineOffset: Math.random() * Math.PI * 2, sineFreq: Math.random() * 0.12 + 0.05 },
      });
    };

    const spawnSmoke = () => {
      particles.push({
        x: centerX + (Math.random() - 0.5) * 35,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 1.2,
        radius: Math.random() * 16 + 10,
        maxRadius: Math.random() * 55 + 40,
        alpha: 0.35,
        decay: Math.random() * 0.008 + 0.005,
        color: 'rgba(35, 28, 28, ',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        type: 'smoke',
      });
    };

    const spawnFrostMist = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 0.5;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 20,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 15 + 10,
        maxRadius: Math.random() * 65 + 35,
        alpha: 0.45,
        decay: Math.random() * 0.01 + 0.006,
        color: Math.random() > 0.5 ? 'rgba(215, 245, 255, ' : 'rgba(120, 215, 255, ',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.01,
        type: 'frost',
      });
    };

    const spawnIceShard = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2.5;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4 + 2,
        maxRadius: 12,
        alpha: 0.95,
        decay: Math.random() * 0.016 + 0.01,
        color: Math.random() > 0.25 ? '#ffffff' : '#80deea',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        type: 'shard',
        customData: { length: Math.random() * 16 + 8, aspect: Math.random() * 0.35 + 0.18 },
      });
    };

    const spawnSnow = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.6,
        radius: Math.random() * 2.2 + 1,
        maxRadius: 3.5,
        alpha: 0.9,
        decay: Math.random() * 0.012 + 0.008,
        color: '#e0f7fa',
        rotation: 0,
        rotSpeed: 0,
        type: 'snow',
      });
    };

    const spawnRibbon = () => {
      const startAngle = Math.random() * Math.PI * 2;
      particles.push({
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: Math.random() * 20 + 15,
        maxRadius: Math.random() * 85 + 55,
        alpha: 0.75,
        decay: Math.random() * 0.014 + 0.008,
        color: Math.random() > 0.5 ? 'rgba(180, 255, 210, ' : 'rgba(220, 255, 245, ',
        rotation: startAngle,
        rotSpeed: (Math.random() * 0.16 + 0.08) * (Math.random() > 0.5 ? 1 : -1),
        type: 'ribbon',
        customData: { arcLength: Math.PI * (Math.random() * 0.8 + 0.4), thickness: Math.random() * 3.5 + 1.5 },
      });
    };

    const spawnWindDust = () => {
      const dist = Math.random() * 30 + 10;
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 2.2 + 0.8,
        maxRadius: 4.5,
        alpha: 0.85,
        decay: Math.random() * 0.018 + 0.01,
        color: Math.random() > 0.4 ? '#b9f6ca' : '#e8f5e9',
        rotation: angle,
        rotSpeed: Math.random() * 0.22 + 0.1,
        type: 'wind_dust',
        customData: { dist, speed: Math.random() * 4.5 + 3 },
      });
    };

    const spawnGravel = (isInitial = false) => {
      const earthColors = ['#5c3a1e', '#8c592b', '#a56f3d', '#3e240f', '#b8860b', '#7c4d25'];
      const angle = Math.random() * Math.PI * 2;
      const speed = isInitial ? Math.random() * 8 + 3 : Math.random() * 5 + 2;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 25,
        y: centerY + (Math.random() - 0.5) * 25,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3.5, // heavy explosive arc
        radius: Math.random() * 5.5 + 2.5,
        maxRadius: 11,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        color: earthColors[Math.floor(Math.random() * earthColors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.35,
        type: 'gravel',
        customData: {
          points: Array.from({ length: 5 }, () => Math.random() * 0.5 + 0.7),
          gravity: Math.random() * 0.28 + 0.22,
        },
      });
    };

    const spawnEarthDust = () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 15,
        y: centerY + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 14 + 8,
        maxRadius: Math.random() * 60 + 35,
        alpha: 0.55,
        decay: Math.random() * 0.012 + 0.006,
        color: 'rgba(140, 90, 45, ',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        type: 'earth_dust',
      });
    };

    // --- INITIAL BURST SPAWNING ---
    if (element === Element.FIRE) {
      for (let i = 0; i < Math.floor(35 * density); i++) spawnFlame(true);
      for (let i = 0; i < Math.floor(60 * density); i++) spawnEmber(true);
      for (let i = 0; i < Math.floor(20 * density); i++) spawnSmoke();
    } else if (element === Element.ICE) {
      for (let i = 0; i < Math.floor(30 * density); i++) spawnFrostMist();
      for (let i = 0; i < Math.floor(45 * density); i++) spawnIceShard();
      for (let i = 0; i < Math.floor(40 * density); i++) spawnSnow();
    } else if (element === Element.WIND) {
      for (let i = 0; i < Math.floor(14 * density); i++) spawnRibbon();
      for (let i = 0; i < Math.floor(60 * density); i++) spawnWindDust();
    } else if (element === Element.EARTH) {
      for (let i = 0; i < Math.floor(50 * density); i++) spawnGravel(true);
      for (let i = 0; i < Math.floor(35 * density); i++) spawnEarthDust();
    }

    // --- RENDER & EMISSION LOOP ---
    let frameCount = 0;
    let frameTime = 0;

    const render = () => {
      if (!isMounted) return;
      frameCount++;
      frameTime += 0.016;

      ctx.clearRect(0, 0, width, height);

      // CONTINUOUS EMITTER REFILL (runs every frame/ticks while mounted)
      if (element === Element.FIRE) {
        if (frameCount % 2 === 0) spawnFlame();
        spawnEmber();
        if (frameCount % 4 === 0) spawnSmoke();
      } else if (element === Element.ICE) {
        if (frameCount % 2 === 0) spawnFrostMist();
        if (frameCount % 3 === 0) spawnIceShard();
        spawnSnow();
      } else if (element === Element.WIND) {
        if (frameCount % 4 === 0) spawnRibbon();
        spawnWindDust();
        spawnWindDust();
      } else if (element === Element.EARTH) {
        if (frameCount % 2 === 0) spawnGravel();
        if (frameCount % 3 === 0) spawnEarthDust();
      }

      // Hero Center Glow Pulsing Aura
      if (isHero) {
        ctx.save();
        const coreGlow = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 90 + Math.sin(frameTime * 10) * 15);
        if (element === Element.FIRE) {
          coreGlow.addColorStop(0, 'rgba(255, 255, 220, 0.9)');
          coreGlow.addColorStop(0.5, 'rgba(255, 120, 0, 0.5)');
          coreGlow.addColorStop(1, 'rgba(180, 0, 0, 0)');
        } else if (element === Element.ICE) {
          coreGlow.addColorStop(0, 'rgba(240, 255, 255, 0.9)');
          coreGlow.addColorStop(0.5, 'rgba(0, 200, 255, 0.5)');
          coreGlow.addColorStop(1, 'rgba(0, 50, 150, 0)');
        } else if (element === Element.WIND) {
          coreGlow.addColorStop(0, 'rgba(220, 255, 220, 0.9)');
          coreGlow.addColorStop(0.5, 'rgba(50, 230, 130, 0.5)');
          coreGlow.addColorStop(1, 'rgba(0, 100, 50, 0)');
        } else if (element === Element.EARTH) {
          coreGlow.addColorStop(0, 'rgba(255, 220, 150, 0.9)');
          coreGlow.addColorStop(0.5, 'rgba(180, 110, 30, 0.5)');
          coreGlow.addColorStop(1, 'rgba(60, 30, 0, 0)');
        }
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Blend mode for high-contrast elemental light
      if (element === Element.FIRE || element === Element.ICE || element === Element.WIND) {
        ctx.globalCompositeOperation = 'lighter';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      // UPDATE & DRAW PARTICLES
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();

        // 1. FLAME
        if (p.type === 'flame') {
          p.x += p.vx;
          p.y += p.vy;
          p.radius = Math.min(p.maxRadius, p.radius + 0.85);
          p.vx += (Math.random() - 0.5) * 0.45;

          const r = Math.max(0.1, p.radius);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. EMBER
        else if (p.type === 'ember') {
          p.customData.sineOffset += p.customData.sineFreq;
          p.x += p.vx + Math.sin(p.customData.sineOffset) * 1.4;
          p.y += p.vy;
          p.vy -= 0.06; // float upward

          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, p.radius), 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. SMOKE
        else if (p.type === 'smoke') {
          p.x += p.vx;
          p.y += p.vy;
          p.radius = Math.min(p.maxRadius, p.radius + 0.6);

          const r = Math.max(0.1, p.radius);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          grad.addColorStop(0, `${p.color}${p.alpha})`);
          grad.addColorStop(1, `${p.color}0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. FROST MIST
        else if (p.type === 'frost') {
          p.x += p.vx;
          p.y += p.vy;
          p.radius = Math.min(p.maxRadius, p.radius + 0.75);

          const r = Math.max(0.1, p.radius);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          grad.addColorStop(0, `${p.color}${p.alpha})`);
          grad.addColorStop(1, `${p.color}0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 5. ICE SHARD
        else if (p.type === 'shard') {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.93; // freezing deceleration
          p.vy *= 0.93;
          p.rotation += p.rotSpeed;

          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.shadowColor = '#60a5fa';
          ctx.shadowBlur = 10;

          // Organic crystalline needle
          const len = p.customData.length;
          const w = len * p.customData.aspect;
          ctx.beginPath();
          ctx.moveTo(0, -len / 2);
          ctx.lineTo(w, 0);
          ctx.lineTo(0, len / 2);
          ctx.lineTo(-w, 0);
          ctx.closePath();
          ctx.fill();
        }

        // 6. SNOW
        else if (p.type === 'snow') {
          p.x += p.vx + Math.sin(frameTime * 4 + i) * 0.6;
          p.y += p.vy;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, p.radius), 0, Math.PI * 2);
          ctx.fill();
        }

        // 7. WIND RIBBON
        else if (p.type === 'ribbon') {
          p.rotation += p.rotSpeed;
          p.radius = Math.min(p.maxRadius, p.radius + 1.3);

          ctx.translate(centerX, centerY);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.1, p.radius), 0, p.customData.arcLength);
          ctx.strokeStyle = `${p.color}${p.alpha})`;
          ctx.lineWidth = Math.max(0.1, p.customData.thickness);
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // 8. WIND DUST
        else if (p.type === 'wind_dust') {
          p.rotation += p.rotSpeed;
          p.customData.dist += p.customData.speed * 0.45;
          const x = centerX + Math.cos(p.rotation) * p.customData.dist;
          const y = centerY + Math.sin(p.rotation) * p.customData.dist;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.1, p.radius), 0, Math.PI * 2);
          ctx.fill();
        }

        // 9. EARTH GRAVEL
        else if (p.type === 'gravel') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.customData.gravity; // weighty gravity
          p.rotation += p.rotSpeed;

          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);

          // Irregular pebble polygon
          const pts = p.customData.points;
          const r = Math.max(0.1, p.radius);
          ctx.beginPath();
          for (let k = 0; k < pts.length; k++) {
            const a = (k / pts.length) * Math.PI * 2;
            const pr = r * pts[k];
            const px = Math.cos(a) * pr;
            const py = Math.sin(a) * pr;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }

        // 10. EARTH DUST
        else if (p.type === 'earth_dust') {
          p.x += p.vx;
          p.y += p.vy;
          p.radius = Math.min(p.maxRadius, p.radius + 0.85);

          const r = Math.max(0.1, p.radius);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          grad.addColorStop(0, `${p.color}${p.alpha})`);
          grad.addColorStop(1, `${p.color}0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [element, isHero, isShield]);

  return (
    <div ref={containerRef} className="absolute -inset-24 sm:-inset-36 pointer-events-none z-30 flex items-center justify-center overflow-visible">
      {/* Refraction & Heat Distortion Ambiance */}
      {element === Element.FIRE && (
        <div className="absolute w-56 h-56 sm:w-80 sm:h-80 rounded-full backdrop-blur-[2px] bg-red-500/10 animate-pulse pointer-events-none" />
      )}
      {element === Element.WIND && (
        <div className="absolute w-60 h-60 sm:w-96 sm:h-96 rounded-full backdrop-blur-[3px] bg-emerald-500/10 animate-ping opacity-20 pointer-events-none" />
      )}
      <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
    </div>
  );
};
