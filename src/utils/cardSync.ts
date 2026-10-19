import { Card } from '../../types';
import { SyncedCardData, SyncedDeckPayload } from '../types/multiplayer';

// In-memory temporary cache for synced opponent images during match
const temporaryCardImageCache = new Map<string, string>();

/**
 * Compresses an image data URL or image path to a safe, lightweight JPEG/PNG base64 string.
 * This guarantees rapid Wi-Fi and Bluetooth transmission of custom forged card artwork.
 */
export async function compressCardImage(imageSource: string, maxWidth = 380, maxHeight = 520, quality = 0.78): Promise<string> {
  if (!imageSource) return '';
  // If it's already a standard static asset path, no need to compress
  if (imageSource.startsWith('/') && !imageSource.startsWith('/data:') && !imageSource.includes('blob:')) {
    return imageSource;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(width, 100);
        canvas.height = Math.max(height, 140);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSource);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Export as compressed JPEG or PNG
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        // Fallback to original image if tainted canvas or read error
        resolve(imageSource);
      }
    };
    img.onerror = () => {
      resolve(imageSource);
    };
    img.src = imageSource;
  });
}

/**
 * Packages player's equipped deck for multiplayer transmission.
 * Automatically compresses custom artwork while preserving all card stats, elements, and names.
 */
export async function prepareDeckForSync(
  deck: Card[],
  duelistName: string,
  avatarUrl?: string,
  equippedDeckName?: string,
  runesCount?: number,
  onProgress?: (progress: number) => void
): Promise<SyncedDeckPayload> {
  const syncedCards: SyncedCardData[] = [];
  const total = deck.length;

  for (let i = 0; i < total; i++) {
    const card = deck[i];
    let compressedImage = card.image;

    // Check if card has custom user image
    if (card.image && (card.image.startsWith('data:') || card.image.startsWith('blob:'))) {
      compressedImage = await compressCardImage(card.image);
    }

    syncedCards.push({
      id: card.id,
      name: card.name,
      element: card.element,
      type: String(card.type),
      attack: card.attack,
      defense: card.defense,
      image: compressedImage,
      description: card.description || '',
      rarity: card.rarity,
      isHero: card.isHero,
      heroStatus: card.heroStatus,
      isCustom: Boolean(card.image && (card.image.startsWith('data:') || card.image.startsWith('blob:'))),
    });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  return {
    duelistName,
    avatarUrl,
    deck: syncedCards,
    equippedDeckName: equippedDeckName || 'Custom Deck',
    runesCount,
    ready: true,
  };
}

/**
 * Receives synced opponent deck payload and converts into Battle Swipes Card objects.
 * Caches custom card art in memory for the match duration.
 */
export function unpackOpponentDeck(payload: SyncedDeckPayload): Card[] {
  return payload.deck.map((item, index) => {
    const cardId = `opp-${item.id || index}-${Date.now()}`;
    if (item.image) {
      temporaryCardImageCache.set(cardId, item.image);
    }

    return {
      id: cardId,
      name: item.name,
      element: item.element,
      type: item.type as any,
      attack: item.attack,
      defense: item.defense,
      image: item.image,
      description: item.description,
      rarity: item.rarity,
      isHero: item.isHero,
      heroStatus: item.heroStatus,
    };
  });
}

/**
 * Clears temporary opponent images when leaving multiplayer match
 */
export function clearTemporaryMatchImages(): void {
  temporaryCardImageCache.clear();
}
