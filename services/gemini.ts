
import { GoogleGenAI } from "@google/genai";
import { Element, CardType } from '../types';
import { ASSETS } from '../constants';

const PROCEDURAL_ELEMENT_PREFIXES: Record<Element, string[]> = {
  [Element.FIRE]: ['Infernal', 'Cinder', 'Pyre', 'Ignition', 'Volcanic', 'Molten', 'Hellfire', 'Solar', 'Blazing'],
  [Element.ICE]: ['Glacial', 'Frostbite', 'Blizzard', 'Cryo', 'Permafrost', 'Rime', 'Arctic', 'Frozen', 'Hailstone'],
  [Element.WIND]: ['Tempest', 'Zephyr', 'Vortex', 'Cyclone', 'Gale', 'Aero', 'Typhoon', 'Storm', 'Whirlwind'],
  [Element.EARTH]: ['Granite', 'Tectonic', 'Terra', 'Obsidian', 'Seismic', 'Basalt', 'Colossus', 'Stone', 'Boulder'],
};

const PROCEDURAL_TYPE_NOUNS: Record<CardType, string[]> = {
  [CardType.HERO]: ['Sovereign', 'Warlord', 'Striker', 'Vanguard', 'Champion', 'Reaver', 'Sentinel', 'Titan', 'Enforcer'],
  [CardType.AXE]: ['Cleaver', 'Chopper', 'Sunderer', 'Ripper', 'Splitter', 'Hewer', 'Gore', 'Maul', 'Biter'],
  [CardType.SWORD]: ['Blade', 'Edge', 'Scythe', 'Fang', 'Talon', 'Slicer', 'Sabre', 'Stinger', 'Razor'],
  [CardType.SHIELD]: ['Aegis', 'Bulwark', 'Bastion', 'Barrier', 'Ward', 'Pillar', 'Carapace', 'Rampart', 'Citadel'],
};

export function generateProceduralName(element: Element, type: CardType, theme?: string): string {
  if (theme && theme.trim().length > 0) {
    const cleanTheme = theme.trim().split(/\s+/)[0];
    const nouns = PROCEDURAL_TYPE_NOUNS[type] || ['Striker', 'Vanguard'];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${cleanTheme} ${noun}`;
  }

  const prefixes = PROCEDURAL_ELEMENT_PREFIXES[element] || ['Primal', 'Elemental'];
  const nouns = PROCEDURAL_TYPE_NOUNS[type] || ['Striker', 'Vanguard'];

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${prefix} ${noun}`;
}

export class GeminiService {
  private getClient(): GoogleGenAI | null {
    const key = (typeof process !== 'undefined' && (process.env?.GEMINI_API_KEY || process.env?.API_KEY)) || '';
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
  }

  private async fetchTemplateAsBase64(): Promise<{ data: string, mimeType: string } | null> {
    try {
      const response = await fetch(ASSETS.CARD_TEMPLATE);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          resolve({ data: base64data, mimeType: blob.type });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to fetch card template", e);
      return null;
    }
  }

  async generateCardName(element: Element, type: CardType, theme: string): Promise<string> {
    const ai = this.getClient();
    if (!ai) {
      return generateProceduralName(element, type, theme);
    }

    const prompt = `Generate a short, epic, 2-word name for a ${element} elemental card of type ${type}. 
    ${theme ? `Theme hint: ${theme}` : 'Theme: High-energy Punk Rock fantasy.'}
    Return ONLY the name, nothing else. No punctuation.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });
      const generated = response.text?.trim().replace(/["'.!]/g, '');
      return generated || generateProceduralName(element, type, theme);
    } catch {
      // Seamlessly fall back to an authentic elemental name on any API/network error
      return generateProceduralName(element, type, theme);
    }
  }

  async generateCustomCard(description: string, isHero: boolean): Promise<string | null> {
    if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey && (window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
        }
      } catch {}
    }

    const templateData = await this.fetchTemplateAsBase64();
    try {
      const ai = this.getClient();
      if (!ai) return null;
      
      const characterRules = isHero ? `
            UNIFIED CHARACTER DESIGN RULES:
            - Head Design: Human-shaped head. The character wears a SKIN-TIGHT, FORM-FITTING BURLAP SACK MASK. 
            - Mask Fitting: The mask must fit perfectly to the contours of the human head and jawline, exactly like a Deadpool mask or a superhero cowl. It is made of tight burlap fabric with a visible rough weave.
            - Facial Features: Large, expressive, vibrant ANIME EYES painted on the mask.
            - Mouth Design: A series of several stitched "X" marks arranged in a curved row to form a wide, jagged, stylized SMILE.
            - Fashion Style: High-energy Gritty Punk Rock. Leather jackets with spikes, torn patches, and chains.
      ` : `
            WEAPON DESIGN RULES:
            - Focus: High-detail weaponry. NO characters, NO human figures, NO faces.
            - Style: Punk-modified weaponry. Gritty metal, spikes, duct-tape handles, and high-tech infusions.
      `;

      const contents: any = {
        parts: [
          { 
            text: `You are a professional concept artist for a digital card game. Generate a standalone 2D FLAT GRAPHIC of a COLLECTIBLE PLAYING CARD.
            
            ${characterRules}
            
            ELEMENTAL COLOR PALETTE:
            - EARTH: Must be dominated by deep BROWNS, chocolate, and sienna.
            - WIND: Must be dominated by vibrant GREENS, emerald, and neon lime.
            - FIRE: Intense reds and oranges.
            - ICE: Cool blues and whites.

            OUTPUT FORMATTING RULES (STRICTEST ADHERENCE REQUIRED):
            1. FULL BLEED: The card frame MUST extend to the exact boundaries of the image. 
            2. ZERO PADDING: There must be NO white borders, NO black bars, and NO padding of any color around the card. The card face IS the entire image.
            3. CARD STYLE: Maintain the "Battle Swipes" gritty punk-rock card border. The frame should be thick and heavy.
            4. PERSPECTIVE: Perfectly flat 2D front view. No 3D shadows, no 3D depth effects outside the card.
            5. IMAGE DIMENSIONS: 3:4 portrait aspect ratio.
            6. NO WHITE: Absolutely avoid white or light-colored background space around the card. Every pixel of the 3:4 canvas must be part of the card design.
            
            Subject Description: "${description}".` 
          }
        ]
      };

      if (templateData) {
        contents.parts.unshift({
          inlineData: {
            data: templateData.data,
            mimeType: templateData.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents,
        config: { 
          imageConfig: { 
            aspectRatio: "3:4" 
          } 
        },
      });
      
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (e: any) {
      if (e?.message?.includes("Requested entity was not found") && typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
        try {
          await (window as any).aistudio.openSelectKey();
        } catch {}
      }
    }
    return null;
  }
}

export const geminiService = new GeminiService();
