import { Element, CardType, Rarity } from '../../types';
import { ASSETS, ELEMENT_ICONS, ELEMENTAL_BACKDROPS } from '../../constants';
import { RARITY_CONFIGS } from './rarity';

// Polyfill CanvasRenderingContext2D.prototype.roundRect for cross-browser / legacy WebView resilience
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, w: number, h: number, radii: any) {
    const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? (radii[0] || 0) : (radii ? Number(radii) : 0));
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}

export interface CompositeCardParams {
  photoSrc: string;
  element: Element;
  type: CardType;
  name: string;
  attack: number;
  defense: number;
  isHero?: boolean;
  heroStatus?: string;
  baseWeapon?: CardType;
  rarity?: Rarity;
  fitMode?: 'cover' | 'fit';
}

export interface CompositeSleeveParams {
  photoSrc: string;
  element: Element;
  name?: string;
  rarity?: Rarity;
  fitMode?: 'fit' | 'cover';
}

const ELEMENT_COLOR_SCHEMES: Record<Element, {
  primary: string;
  secondary: string;
  border: string;
  glow: string;
  bgDark: string;
}> = {
  [Element.FIRE]: {
    primary: '#ef4444',
    secondary: '#f97316',
    border: '#f59e0b',
    glow: 'rgba(239, 68, 68, 0.7)',
    bgDark: '#2a0a0a',
  },
  [Element.ICE]: {
    primary: '#38bdf8',
    secondary: '#0284c7',
    border: '#7dd3fc',
    glow: 'rgba(56, 189, 248, 0.7)',
    bgDark: '#071e2e',
  },
  [Element.WIND]: {
    primary: '#4ade80',
    secondary: '#16a34a',
    border: '#86efac',
    glow: 'rgba(74, 222, 128, 0.7)',
    bgDark: '#082414',
  },
  [Element.EARTH]: {
    primary: '#eab308',
    secondary: '#ca8a04',
    border: '#fde047',
    glow: 'rgba(234, 179, 8, 0.7)',
    bgDark: '#261b07',
  },
};

function safeLoadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function toOptimizedDataUrl(canvas: HTMLCanvasElement): string {
  try {
    const webp = canvas.toDataURL('image/webp', 0.88);
    if (webp && webp.startsWith('data:image/webp')) {
      return webp;
    }
  } catch {}
  return canvas.toDataURL('image/png');
}

/**
 * Composites a user photo across the full front of the card with sleek floating TCG stats,
 * name banner, element crest, and authentic rarity border.
 * Returns a high-res Data URL suitable for use in the game.
 */
export async function compositeCardImage(params: CompositeCardParams): Promise<string> {
  const { photoSrc, element, type, name, attack, defense, isHero, heroStatus, baseWeapon, rarity = Rarity.COMMON, fitMode = 'cover' } = params;
  const colors = ELEMENT_COLOR_SCHEMES[element] || ELEMENT_COLOR_SCHEMES[Element.FIRE];
  const rarityConfig = RARITY_CONFIGS[rarity] || RARITY_CONFIGS[Rarity.COMMON];

  const canvas = document.createElement('canvas');
  const W = 640;
  const H = 880;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return photoSrc;

  const cardRadius = 24;
  const borderWidth = 10;
  const borderOffset = borderWidth / 2;

  // 1. CLIP CANVAS TO THE ROUNDED CARD SHAPE
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, cardRadius);
  ctx.clip();

  // Dark baseline
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  // 2. FULL IMAGE ON THE FRONT OF THE CARD
  const photoImg = await safeLoadImage(photoSrc);

  if (photoImg) {
    const pW = photoImg.naturalWidth || photoImg.width;
    const pH = photoImg.naturalHeight || photoImg.height;

    if (fitMode === 'fit') {
      // 100% UNMUNCHED / FULL IMAGE VISIBLE:
      // Ambient atmospheric background fill of the image to eliminate harsh borders
      const bgScale = Math.max(W / pW, H / pH);
      const bgW = pW * bgScale;
      const bgH = pH * bgScale;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(photoImg, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH);
      ctx.restore();

      // Atmospheric dark tint over ambient background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, W, H);

      // Draw full image uncropped, centered on the front of the card
      const scale = Math.min(W / pW, H / pH);
      const drawW = pW * scale;
      const drawH = pH * scale;
      const drawX = (W - drawW) / 2;
      const drawY = (H - drawH) / 2;
      ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    } else {
      // FULL-BLEED COVER: Spans the full front of the card edge-to-edge
      const scale = Math.max(W / pW, H / pH);
      const drawW = pW * scale;
      const drawH = pH * scale;
      const drawX = (W - drawW) / 2;
      const drawY = (H - drawH) / 2;
      ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    }

    // Gentle edge vignette for authentic depth
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Fallback if image failed to load: elemental backdrop
    const backdropImg = await safeLoadImage(ELEMENTAL_BACKDROPS[element]);
    if (backdropImg) {
      ctx.drawImage(backdropImg, 0, 0, W, H);
    } else {
      const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 2);
      grad.addColorStop(0, colors.secondary);
      grad.addColorStop(1, colors.bgDark);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // 3. TOP SLEEK FLOATING HEADER (CARD NAME & ELEMENT)
  // Transparent glass pill so the full artwork stays visible
  const headerX = 22;
  const headerY = 22;
  const headerW = W - 44;
  const headerH = 52;

  ctx.save();
  // Translucent backdrop pill
  const headerGrad = ctx.createLinearGradient(0, headerY, 0, headerY + headerH);
  headerGrad.addColorStop(0, 'rgba(12, 10, 8, 0.82)');
  headerGrad.addColorStop(0.5, 'rgba(24, 18, 12, 0.88)');
  headerGrad.addColorStop(1, 'rgba(10, 8, 6, 0.84)');
  ctx.fillStyle = headerGrad;
  ctx.beginPath();
  ctx.roundRect(headerX, headerY, headerW, headerH, 26);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = isHero ? '#eab308' : rarityConfig.borderHex;
  ctx.shadowColor = rarityConfig.glowColor;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Element Icon in glowing circular crest on the left
  const iconImg = await safeLoadImage(ELEMENT_ICONS[element]);
  if (iconImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(headerX + 26, headerY + headerH / 2, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.border;
    ctx.stroke();
    ctx.drawImage(iconImg, headerX + 7, headerY + headerH / 2 - 19, 38, 38);
    ctx.restore();
  }

  // Card Name Typography
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 8;
  ctx.fillStyle = isHero ? '#fef08a' : '#fef9c3';
  ctx.font = '900 22px "Cinzel", "Cinzel Decorative", Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let displayTitle = name.trim() || `${element} ${type}`;
  if (displayTitle.length > 22) {
    displayTitle = displayTitle.slice(0, 21) + '…';
  }
  ctx.fillText(displayTitle, headerX + 54, headerY + headerH / 2 + 1);

  // Element Tag on right side of header
  ctx.font = '900 12px "Cinzel", sans-serif';
  ctx.fillStyle = colors.secondary;
  ctx.textAlign = 'right';
  ctx.fillText(element.toUpperCase(), headerX + headerW - 14, headerY + headerH / 2 + 1);
  ctx.restore();

  // 4. FLOATING RARITY / HERO ACCENT BADGE (UNDER HEADER)
  const tagY = headerY + headerH + 8;
  const tagH = 26;
  ctx.save();
  const weaponLabel = (baseWeapon || (type === CardType.HERO ? CardType.SWORD : type)) === CardType.SWORD ? 'SWORD' : (baseWeapon || type) === CardType.AXE ? 'AXE' : 'SHIELD';
  const tagText = isHero
    ? `★ HERO ${weaponLabel} • ${(heroStatus || 'CHAMPION').toUpperCase()} ★`
    : `⬥ ${rarityConfig.label} • ${type.toUpperCase()} ⬥`;
  
  ctx.font = '900 11px "Cinzel", sans-serif';
  const textWidth = ctx.measureText(tagText).width;
  const tagW = Math.min(headerW - 60, textWidth + 30);
  const tagX = (W - tagW) / 2;

  const tagGrad = ctx.createLinearGradient(tagX, tagY, tagX + tagW, tagY);
  if (isHero) {
    tagGrad.addColorStop(0, 'rgba(234, 179, 8, 0.88)');
    tagGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.95)');
    tagGrad.addColorStop(1, 'rgba(234, 179, 8, 0.88)');
  } else {
    tagGrad.addColorStop(0, 'rgba(10, 8, 6, 0.82)');
    tagGrad.addColorStop(0.5, 'rgba(25, 20, 15, 0.9)');
    tagGrad.addColorStop(1, 'rgba(10, 8, 6, 0.82)');
  }
  ctx.fillStyle = tagGrad;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, tagW, tagH, 13);
  ctx.fill();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isHero ? '#ffffff' : rarityConfig.borderHex;
  ctx.shadowColor = rarityConfig.glowColor;
  ctx.shadowBlur = 8;
  ctx.stroke();

  ctx.fillStyle = isHero ? '#000000' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = isHero ? 0 : 4;
  ctx.shadowColor = '#000000';
  ctx.fillText(tagText, W / 2, tagY + tagH / 2);
  ctx.restore();

  // 5. BOTTOM FLOATING COMBAT STATS HUD (ATK & DEF GEMS)
  // Subtle gradient ground so numbers are crystal clear
  const hudY = H - 90;
  const botShade = ctx.createLinearGradient(0, hudY - 30, 0, H);
  botShade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  botShade.addColorStop(0.4, 'rgba(0, 0, 0, 0.45)');
  botShade.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
  ctx.fillStyle = botShade;
  ctx.fillRect(0, hudY - 30, W, H - (hudY - 30));

  const statY = H - 76;
  const statW = 126;
  const statH = 46;

  // Red ATK Jewel (Bottom Left)
  ctx.save();
  const atkX = 26;
  const atkGrad = ctx.createLinearGradient(atkX, statY, atkX, statY + statH);
  atkGrad.addColorStop(0, 'rgba(239, 68, 68, 0.92)');
  atkGrad.addColorStop(1, 'rgba(153, 27, 27, 0.95)');
  ctx.fillStyle = atkGrad;
  ctx.beginPath();
  ctx.roundRect(atkX, statY, statW, statH, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fca5a5';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
  ctx.shadowBlur = 8;
  ctx.stroke();

  ctx.font = '900 11px sans-serif';
  ctx.fillStyle = '#fecaca';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ATK', atkX + 10, statY + statH / 2);

  ctx.font = '900 22px "Cinzel", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(`${attack}`, atkX + statW - 12, statY + statH / 2);
  ctx.restore();

  // Blue DEF Jewel (Bottom Right)
  ctx.save();
  const defX = W - 26 - statW;
  const defGrad = ctx.createLinearGradient(defX, statY, defX, statY + statH);
  defGrad.addColorStop(0, 'rgba(2, 132, 199, 0.92)');
  defGrad.addColorStop(1, 'rgba(7, 89, 133, 0.95)');
  ctx.fillStyle = defGrad;
  ctx.beginPath();
  ctx.roundRect(defX, statY, statW, statH, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7dd3fc';
  ctx.shadowColor = 'rgba(2, 132, 199, 0.6)';
  ctx.shadowBlur = 8;
  ctx.stroke();

  ctx.font = '900 11px sans-serif';
  ctx.fillStyle = '#bae6fd';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('DEF', defX + 10, statY + statH / 2);

  ctx.font = '900 22px "Cinzel", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(`${defense}`, defX + statW - 12, statY + statH / 2);
  ctx.restore();

  // Center Type Tag / Brand
  ctx.save();
  ctx.font = '900 11px "Cinzel", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  const typeName = isHero 
    ? `HERO ${weaponLabel}` 
    : type === CardType.SWORD ? 'SWORD' : type === CardType.AXE ? 'AXE' : 'SHIELD';
  ctx.fillText(typeName, W / 2, statY + statH / 2 - 2);

  ctx.font = '800 8px "Cinzel", sans-serif';
  ctx.fillStyle = isHero ? 'rgba(253, 224, 71, 0.85)' : 'rgba(255, 255, 255, 0.45)';
  const subBrand = isHero && heroStatus 
    ? `${heroStatus.toUpperCase()}` 
    : `BATTLE SWIPES`;
  ctx.fillText(subBrand, W / 2, statY + statH / 2 + 12);
  ctx.restore();

  // 6. RARITY PERIMETER CARD BORDER
  ctx.save();
  ctx.strokeStyle = rarityConfig.borderHex;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.roundRect(borderOffset, borderOffset, W - borderOffset * 2, H - borderOffset * 2, cardRadius);
  ctx.stroke();

  // Fine inner metallic highlight line tracing the frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(borderOffset + 6, borderOffset + 6, W - (borderOffset + 6) * 2, H - (borderOffset + 6) * 2, cardRadius - 4);
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end outer card clip

  return toOptimizedDataUrl(canvas);
}

/**
 * Composites a custom card sleeve for players in the Forge.
 * Creates an authentic 640x880 TCG card backing with the user's custom photo/art
 * covering the entire back of the card, displaying the full image without any text.
 */
export async function compositeCardSleeve(params: CompositeSleeveParams): Promise<string> {
  const { photoSrc, element, rarity = Rarity.COMMON, fitMode = 'fit' } = params;
  const colors = ELEMENT_COLOR_SCHEMES[element] || ELEMENT_COLOR_SCHEMES[Element.FIRE];
  const rarityConfig = RARITY_CONFIGS[rarity] || RARITY_CONFIGS[Rarity.COMMON];

  const canvas = document.createElement('canvas');
  const W = 640;
  const H = 880;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return photoSrc;

  const cardRadius = 24;
  const borderWidth = 10;
  const borderOffset = borderWidth / 2;

  // Clip everything inside the standard rounded card boundaries
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, cardRadius);
  ctx.clip();

  // Baseline dark canvas fill
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  const photoImg = await safeLoadImage(photoSrc);

  if (photoImg) {
    const pW = photoImg.naturalWidth || photoImg.width;
    const pH = photoImg.naturalHeight || photoImg.height;
    const imgAspect = pW / pH;
    const cardAspect = W / H; // ~0.72727

    // WHOLE IMAGE SHOWN ON THE BACK OF THE CARD WITH PROPER ASPECT RATIO
    if (fitMode === 'fit') {
      // 1. Ambient background fill matching image colors
      const bgScale = Math.max(W / pW, H / pH);
      const bgW = pW * bgScale;
      const bgH = pH * bgScale;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(photoImg, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH);
      ctx.restore();

      // Atmospheric dark tint over ambient background
      ctx.fillStyle = 'rgba(10, 8, 6, 0.65)';
      ctx.fillRect(0, 0, W, H);

      // 2. Draw 100% full uncropped image centered onto the card back
      const scale = Math.min(W / pW, H / pH);
      const drawW = pW * scale;
      const drawH = pH * scale;
      const drawX = (W - drawW) / 2;
      const drawY = (H - drawH) / 2;
      ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    } else {
      // 'cover': fills the entire card back edge-to-edge with the image
      const scale = Math.max(W / pW, H / pH);
      const drawW = pW * scale;
      const drawH = pH * scale;
      const drawX = (W - drawW) / 2;
      const drawY = (H - drawH) / 2;
      ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    }

    // Subtle atmospheric vignette along outer edges for authentic TCG depth
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.38, W / 2, H / 2, W * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Fallback if no photo image: draw rich elemental backdrop covering the card
    const backdropImg = await safeLoadImage(ELEMENTAL_BACKDROPS[element]);
    if (backdropImg) {
      ctx.drawImage(backdropImg, 0, 0, W, H);
    } else {
      const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 2);
      grad.addColorStop(0, colors.secondary);
      grad.addColorStop(1, colors.bgDark);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // NO TEXT ON THE CARD BACK!
  // No title plaque, no font rendering, no text overlays whatsoever.

  // PERIMETER RARITY CARD SLEEVE BORDER (Exact 1:1 match with card fronts)
  ctx.save();
  ctx.strokeStyle = rarityConfig.borderHex;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.roundRect(borderOffset, borderOffset, W - borderOffset * 2, H - borderOffset * 2, cardRadius);
  ctx.stroke();

  // Subtle inner metallic highlight tracing the sleeve edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(borderOffset + 6, borderOffset + 6, W - (borderOffset + 6) * 2, H - (borderOffset + 6) * 2, cardRadius - 4);
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end outer card clip

  return toOptimizedDataUrl(canvas);
}

// In-memory cache for composited card backs by rarity & sleeve
const cardBackCache: Map<string, string> = new Map();

/**
 * Composites an authentic card backing onto the exact same 640x880 canvas coordinate system
 * with the exact same border radius, stroke width, and rarity border as compositeCardImage.
 * Supports custom player sleeves or default card backing.
 */
export async function compositeCardBack(rarity: Rarity = Rarity.COMMON, sleeveImageUrl?: string): Promise<string> {
  const cacheKey = `${rarity}_${sleeveImageUrl || 'default'}`;
  if (cardBackCache.has(cacheKey)) {
    return cardBackCache.get(cacheKey)!;
  }

  // If already a composited sleeve data URL, return directly so full edge-to-edge sleeve artwork is untouched
  if (sleeveImageUrl && (sleeveImageUrl.startsWith('data:') || sleeveImageUrl.startsWith('blob:'))) {
    cardBackCache.set(cacheKey, sleeveImageUrl);
    return sleeveImageUrl;
  }

  const W = 640;
  const H = 880;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sleeveImageUrl || ASSETS.CARD_TEMPLATE;

  const bgToLoad = sleeveImageUrl && sleeveImageUrl !== 'default' ? sleeveImageUrl : ASSETS.CARD_TEMPLATE;
  const templateImg = await safeLoadImage(bgToLoad);
  if (templateImg) {
    const tW = templateImg.naturalWidth || templateImg.width || W;
    const tH = templateImg.naturalHeight || templateImg.height || H;
    const scale = Math.max(W / tW, H / tH);
    const drawW = tW * scale;
    const drawH = tH * scale;
    const drawX = (W - drawW) / 2;
    const drawY = (H - drawH) / 2;
    ctx.drawImage(templateImg, drawX, drawY, drawW, drawH);
  } else {
    ctx.fillStyle = '#120d09';
    ctx.fillRect(0, 0, W, H);
  }

  // Draw identical rarity border matching the card's exact shape, width, and radius
  const rarityConfig = RARITY_CONFIGS[rarity] || RARITY_CONFIGS[Rarity.COMMON];
  ctx.save();
  const cardRadius = 24;
  const borderWidth = 10;
  const borderOffset = borderWidth / 2;

  // Clean perimeter border matching the exact card shape
  ctx.strokeStyle = rarityConfig.borderHex;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.roundRect(borderOffset, borderOffset, W - borderOffset * 2, H - borderOffset * 2, cardRadius);
  ctx.stroke();

  // Fine inner highlight line tracing the frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(borderOffset + 6, borderOffset + 6, W - (borderOffset + 6) * 2, H - (borderOffset + 6) * 2, cardRadius - 4);
  ctx.stroke();

  ctx.restore();

  const dataUrl = toOptimizedDataUrl(canvas);
  cardBackCache.set(cacheKey, dataUrl);
  return dataUrl;
}
