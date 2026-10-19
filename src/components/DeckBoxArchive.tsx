import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardSleeve, DeckBoxSkin, Element } from '../../types';
import { ASSETS, ELEMENT_ICONS, ELEMENTAL_BACKDROPS, SOUNDS } from '../../constants';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { 
  Check, 
  Plus, 
  Sparkles, 
  Palette, 
  Layers, 
  Eye, 
  ArrowDown, 
  ArrowUp,
  Save 
} from 'lucide-react';
import { DeckBox3D } from './DeckBox3D';
import { DeckBoxDesignerModal } from './DeckBoxDesignerModal';

interface DeckBoxArchiveProps {
  allDecks: Card[][];
  setAllDecks: React.Dispatch<React.SetStateAction<Card[][]>>;
  equippedDeckIndex: number;
  setEquippedDeckIndex: (idx: number) => void;
  deckSize: number;
  availableLibrary: Card[];
  cardSleeves: CardSleeve[];
  activeSleeveImage?: string;
  playSound: (soundUrl: string) => void;
  onOpen3DCard: (card: Card) => void;
  onOpenFullDeckEditor: (vaultIdx: number) => void;
}

export const DEFAULT_DECK_BOX_SKINS: DeckBoxSkin[] = [
  {
    id: 'deck_box_0',
    name: 'Inferno Phoenix Vault',
    image: ELEMENTAL_BACKDROPS.FIRE,
    tileMode: 'cover',
    tileSize: 110,
    theme: 'ruby',
    element: Element.FIRE,
    boxColor: 'red',
    liningColor: 'yellow',
    outsideType: 'image',
    insideType: 'color',
    updatedAt: 0,
  },
  {
    id: 'deck_box_1',
    name: 'Glacial Cobalt Vault',
    image: ELEMENTAL_BACKDROPS.ICE,
    tileMode: 'cover',
    tileSize: 110,
    theme: 'sapphire',
    element: Element.ICE,
    boxColor: 'blue',
    liningColor: 'blue',
    outsideType: 'image',
    insideType: 'color',
    updatedAt: 0,
  },
  {
    id: 'deck_box_2',
    name: 'Tempest Titan Vault',
    image: ELEMENTAL_BACKDROPS.WIND,
    tileMode: 'cover',
    tileSize: 110,
    theme: 'emerald',
    element: Element.WIND,
    boxColor: 'green',
    liningColor: 'yellow',
    outsideType: 'image',
    insideType: 'color',
    updatedAt: 0,
  },
];

export const getEquippedDeckBoxSkin = (
  equippedIdx: number = 0,
  savedSkins?: DeckBoxSkin[]
): DeckBoxSkin => {
  if (savedSkins && savedSkins[equippedIdx]) {
    return savedSkins[equippedIdx];
  }
  return DEFAULT_DECK_BOX_SKINS[equippedIdx] || DEFAULT_DECK_BOX_SKINS[0];
};

export const getOpponentDeckBoxSkin = (
  envElement: Element = Element.FIRE,
  opponentName: string = 'Challenger'
): DeckBoxSkin => {
  const match = DEFAULT_DECK_BOX_SKINS.find(s => s.element === envElement);
  if (match) {
    return {
      ...match,
      name: `${opponentName}'s Vault`,
    };
  }
  return {
    ...DEFAULT_DECK_BOX_SKINS[0],
    name: `${opponentName}'s Vault`,
  };
};

export const DeckBoxArchive: React.FC<DeckBoxArchiveProps> = ({
  allDecks,
  setAllDecks,
  equippedDeckIndex,
  setEquippedDeckIndex,
  deckSize,
  availableLibrary,
  cardSleeves,
  playSound,
  onOpen3DCard,
}) => {
  // Active Box Index: 0, 1, 2
  const [activeBoxIndex, setActiveBoxIndex] = useState(equippedDeckIndex || 0);

  // Deck Box Skins (persisted per box)
  const [boxSkins, setBoxSkins] = useState<DeckBoxSkin[]>(DEFAULT_DECK_BOX_SKINS);

  // Box Open / Animation lifecycle stages:
  // 'closed' -> 'opening' -> 'cards-falling' -> 'open' -> 'saving' -> 'closing' -> 'closed'
  const [boxState, setBoxState] = useState<'closed' | 'opening' | 'cards-falling' | 'open' | 'saving' | 'closing'>('closed');

  // Animation state for a card sliding down from top carousel into bottom carousel
  const [slidingDownCard, setSlidingDownCard] = useState<{ card: Card; startX: number; startY: number } | null>(null);

  // Animation state for a card removed from bottom carousel (flick up or swipe down)
  const [removingCard, setRemovingCard] = useState<{ id: string; direction: 'up' | 'down' } | null>(null);

  // Customizer modal state
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [designerBoxIndex, setDesignerBoxIndex] = useState(0);

  // Top inventory element filter
  const [filterElement, setFilterElement] = useState<Element | 'ALL'>('ALL');

  // Drag tracking for swiping/flicking bottom cards
  const dragStartYRef = useRef<Record<string, number>>({});

  // Active skin and arena backdrop
  const currentSkin = boxSkins[activeBoxIndex] || DEFAULT_DECK_BOX_SKINS[activeBoxIndex];
  const arenaBackdrop = ELEMENTAL_BACKDROPS[currentSkin.element] || ASSETS.BACKDROP;

  // Load saved deck box skins
  useEffect(() => {
    getStorageItem<DeckBoxSkin[]>('battle_swipes_deck_boxes', DEFAULT_DECK_BOX_SKINS)
      .then((saved) => {
        if (Array.isArray(saved) && saved.length === 3) {
          const upgraded = saved.map((s, idx) => {
            const defaultSkin = DEFAULT_DECK_BOX_SKINS[idx];
            return {
              ...defaultSkin,
              ...s,
              image: (!s.image || s.image.includes('card-backing') || s.image.includes('Card%20backing'))
                ? defaultSkin.image
                : s.image,
              outsideType: s.outsideType || 'image',
              insideType: s.insideType || 'color',
              insideImage: s.insideImage || s.image || defaultSkin.image,
            };
          });
          setBoxSkins(upgraded);
        }
      })
      .catch(() => {});
  }, []);

  // Save box skins on update
  const handleSaveSkin = (updatedSkin: DeckBoxSkin) => {
    setBoxSkins((prev) => {
      const next = [...prev];
      next[designerBoxIndex] = updatedSkin;
      setStorageItem('battle_swipes_deck_boxes', next).catch(() => {});
      return next;
    });
  };

  // Carousel navigation between Box 1, 2, and 3
  const goToBox = (index: number) => {
    if (index === activeBoxIndex) return;
    const clamped = Math.max(0, Math.min(2, index));
    setActiveBoxIndex(clamped);
    setBoxState('closed');
    playSound(SOUNDS.CARD_SWIPE);
  };

  // Current active vault cards
  const currentDeckCards = allDecks[activeBoxIndex] || [];
  const count = currentDeckCards.length;
  const isEquipped = equippedDeckIndex === activeBoxIndex;

  // Filtered available library for top inventory carousel
  const filteredLibrary = useMemo(() => {
    return availableLibrary.filter((card) => {
      if (filterElement === 'ALL') return true;
      return card.element === filterElement;
    });
  }, [availableLibrary, filterElement]);

  // ------------------------------------------------------------
  // DECK BOX OPEN ANIMATION:
  // 1. Box snaps to front (handled smoothly by DeckBox3D)
  // 2. Box lid hinges open backward
  // 3. Cards stored inside fly out and float down to bottom carousel
  // 4. Cards land into bottom carousel and become selectable
  // ------------------------------------------------------------
  const handleOpenDeckBox = () => {
    if (boxState !== 'closed') return;

    playSound(SOUNDS.CARD_SWIPE);
    setBoxState('opening');

    setTimeout(() => {
      setBoxState('cards-falling');
      playSound(SOUNDS.SHIELD_BLOCK);
    }, 340);

    setTimeout(() => {
      setBoxState('open');
    }, 960);
  };

  // ------------------------------------------------------------
  // SAVE & CLOSE BEHAVIOR:
  // 1. All cards in bottom carousel fly up into the air, orient horizontally, and slide into the open box.
  // 2. Lid hinges closed flush with the top of the box.
  // 3. Box returns to solid closed state.
  // ------------------------------------------------------------
  const handleSaveAndClose = () => {
    if (boxState === 'closed' || boxState === 'saving' || boxState === 'closing') return;

    playSound(SOUNDS.CARD_SWIPE);
    setBoxState('saving');

    setTimeout(() => {
      setBoxState('closing');
      playSound(SOUNDS.CARD_SWIPE);
    }, 620);

    setTimeout(() => {
      setBoxState('closed');
      playSound(SOUNDS.GAME_WIN);
    }, 980);
  };

  // ------------------------------------------------------------
  // TOP CAROUSEL: TAP CARD TO ADD
  // Flashy animation: flies down with particle aura and arc to the deck carousel
  // ------------------------------------------------------------
  const handleTapAddFromInventory = (card: Card, e: React.MouseEvent) => {
    if (boxState !== 'open') return;

    if (currentDeckCards.length >= deckSize) {
      playSound(SOUNDS.SHIELD_BLOCK);
      return;
    }
    const alreadyExists = currentDeckCards.some((c) => c.id === card.id);
    if (alreadyExists) {
      playSound(SOUNDS.SHIELD_BLOCK);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSlidingDownCard({
      card,
      startX: rect.left,
      startY: rect.top,
    });
    playSound(SOUNDS.CARD_SWIPE);

    setTimeout(() => {
      const updated = [...currentDeckCards, card];
      setAllDecks((prev) => {
        const next = [...prev];
        next[activeBoxIndex] = updated;
        setStorageItem('battle_swipes_decks', next).catch(() => {});
        return next;
      });
      setSlidingDownCard(null);
    }, 460);
  };

  // ------------------------------------------------------------
  // BOTTOM CAROUSEL: FLICK UP OR SWIPE DOWN TO REMOVE
  // ------------------------------------------------------------
  const handleRemoveCard = (card: Card, direction: 'up' | 'down') => {
    if (boxState !== 'open' || removingCard) return;

    setRemovingCard({ id: card.id, direction });
    playSound(SOUNDS.CARD_SWIPE);

    setTimeout(() => {
      const updated = currentDeckCards.filter((c) => c.id !== card.id);
      setAllDecks((prev) => {
        const next = [...prev];
        next[activeBoxIndex] = updated;
        setStorageItem('battle_swipes_decks', next).catch(() => {});
        return next;
      });
      setRemovingCard(null);
    }, 280);
  };

  const isLidHingedOpen = boxState === 'opening' || boxState === 'cards-falling' || boxState === 'open' || boxState === 'saving';

  return (
    <div className="relative z-20 w-full min-h-[88vh] rounded-3xl overflow-hidden select-none border-2 border-yellow-600/40 shadow-2xl flex flex-col justify-between bg-black/95">
      {/* Dynamic Keyframes for cards animations - Optimized for GPU Hardware Acceleration */}
      <style>{`
        @keyframes cardsFlyOutAndFloatDown {
          0% {
            transform: translate3d(0, 20px, 0) rotateZ(90deg) rotateX(55deg) scale(0.92);
            opacity: 0;
          }
          28% {
            transform: translate3d(0, -45px, 0) rotateZ(45deg) rotateX(25deg) scale(1.05);
            opacity: 1;
          }
          65% {
            transform: translate3d(0, 60px, 0) rotate(-6deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 195px, 0) rotate(0deg) scale(0.95);
            opacity: 0.95;
          }
        }

        @keyframes cardsFlyUpOrientAndSlideIn {
          0% {
            transform: translate3d(0, 180px, 0) rotate(0deg) scale(0.85);
            opacity: 0.1;
          }
          25% {
            transform: translate3d(0, 40px, 0) rotate(-8deg) scale(1.05);
            opacity: 1;
          }
          52% {
            transform: translate3d(0, -45px, 0) rotateZ(90deg) rotateX(55deg) scale(1);
            opacity: 1;
          }
          75% {
            transform: translate3d(0, -18px, 0) rotateZ(90deg) rotateX(55deg) scale(0.96);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 25px, 0) rotateZ(90deg) rotateX(55deg) scale(0.92);
            opacity: 0;
          }
        }

        @keyframes flashyCardFlyDownToDeck {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          20% {
            transform: translate3d(0, -22px, 0) scale(1.18) rotate(-8deg);
            opacity: 1;
          }
          55% {
            transform: translate3d(0, 140px, 0) scale(1.12) rotate(6deg);
            opacity: 1;
          }
          85% {
            transform: translate3d(0, 275px, 0) scale(1.02) rotate(-2deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 345px, 0) scale(0.95) rotate(0deg);
            opacity: 0.95;
          }
        }
      `}</style>

      {/* Arena Ambient Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700 pointer-events-none opacity-35"
        style={{ backgroundImage: `url(${arenaBackdrop})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/45 to-black/95 pointer-events-none" />

      {/* ============================================================== */}
      {/* 1. TOP HEADER & INVENTORY CAROUSEL */}
      {/* ============================================================== */}
      <div className="relative z-30 w-full p-2 sm:p-3.5 space-y-2">
        {/* Top Control Bar: Vault Name & Equip Button OUTSIDE the 3D box */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-black/85 backdrop-blur-md px-3 py-2 rounded-2xl border border-yellow-500/40 shadow">
          {/* Vault Name outside the box */}
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black uppercase text-yellow-300 tracking-wider">
              {currentSkin.name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
              isEquipped ? 'bg-green-600 text-white border-green-400' : 'bg-white/10 text-white/50 border-white/20'
            }`}>
              {isEquipped ? 'EQUIPPED' : `${count}/${deckSize}`}
            </span>
          </div>

          {/* Box Switchers (Box 1, 2, 3) */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToBox(idx)}
                className={`min-h-[32px] px-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                  activeBoxIndex === idx
                    ? 'bg-yellow-500 text-black border-yellow-300 shadow font-black'
                    : 'bg-black/60 text-white/50 border-white/10 hover:border-yellow-500/40'
                }`}
              >
                BOX {idx + 1}
              </button>
            ))}
          </div>

          {/* Top Actions: Equip & Design (OUTSIDE the box) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEquippedDeckIndex(activeBoxIndex);
                playSound(SOUNDS.GAME_WIN);
              }}
              className={`min-h-[32px] px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider border transition-all active:scale-95 flex items-center gap-1 ${
                isEquipped
                  ? 'bg-green-700 text-white border-green-500'
                  : 'bg-yellow-500 text-black border-yellow-300'
              }`}
            >
              <Check className="w-3 h-3" />
              <span>{isEquipped ? 'ACTIVE' : 'EQUIP'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDesignerBoxIndex(activeBoxIndex);
                setIsDesignerOpen(true);
                playSound(SOUNDS.CARD_SWIPE);
              }}
              className="min-h-[32px] px-2.5 rounded-xl bg-yellow-950/60 border border-yellow-600/50 text-yellow-300 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1"
            >
              <Palette className="w-3 h-3" />
              <span>DESIGN</span>
            </button>
          </div>
        </div>

        {/* TOP CAROUSEL: ALL INVENTORY CARDS */}
        {boxState === 'open' && (
          <div className="bg-black/85 backdrop-blur-md rounded-2xl p-2 border border-yellow-600/40 shadow-xl space-y-1 animate-in slide-in-from-top-3 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-1 px-1">
              <span className="text-[10px] sm:text-xs font-black uppercase text-yellow-300 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                <span>INVENTORY (TAP TO ADD TO DECK)</span>
              </span>

              {/* Element Filter Pills */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilterElement('ALL')}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                    filterElement === 'ALL'
                      ? 'bg-yellow-500 text-black shadow'
                      : 'bg-black/60 text-white/50 border border-white/10'
                  }`}
                >
                  ALL
                </button>
                {[Element.FIRE, Element.ICE, Element.WIND, Element.EARTH].map((el) => (
                  <button
                    key={el}
                    type="button"
                    onClick={() => setFilterElement(el)}
                    className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-0.5 transition-all ${
                      filterElement === el
                        ? 'bg-yellow-500 text-black shadow'
                        : 'bg-black/60 text-white/50 border border-white/10'
                    }`}
                  >
                    <img src={ELEMENT_ICONS[el]} alt={el} className="w-2.5 h-2.5 object-contain" />
                    <span>{el}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Horizontal Swipeable Top Carousel */}
            <div className="flex gap-2 overflow-x-auto py-1 px-0.5 max-w-full scrollbar-thin scrollbar-thumb-yellow-600/40">
              {filteredLibrary.map((card) => {
                const inDeck = currentDeckCards.some((c) => c.id === card.id);
                const isDeckFull = count >= deckSize;

                return (
                  <div
                    key={card.id}
                    onClick={(e) => {
                      if (!inDeck && !isDeckFull) handleTapAddFromInventory(card, e);
                    }}
                    className={`relative shrink-0 w-[66px] min-[380px]:w-[74px] sm:w-[84px] rounded-xl overflow-hidden border-2 bg-black/95 p-1 flex flex-col justify-between transition-all shadow cursor-pointer active:scale-95 ${
                      inDeck
                        ? 'opacity-35 border-white/10 cursor-not-allowed'
                        : isDeckFull
                        ? 'opacity-50 border-yellow-900/40 cursor-not-allowed'
                        : 'border-yellow-500/70 hover:border-yellow-400 hover:scale-105'
                    }`}
                    title={inDeck ? 'Already in Deck' : isDeckFull ? 'Deck Full' : 'Tap to Add'}
                  >
                    <div className="relative w-full aspect-[640/880] rounded-lg overflow-hidden bg-black">
                      <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-black/85 p-0.5 border border-yellow-400">
                        <img src={ELEMENT_ICONS[card.element]} alt={card.element} className="w-full h-full object-contain" />
                      </div>
                      {!inDeck && !isDeckFull && (
                        <div className="absolute inset-0 bg-yellow-400/20 opacity-0 hover:opacity-100 flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5 text-yellow-300" />
                        </div>
                      )}
                    </div>
                    <div className="py-0.5 text-center leading-none">
                      <span className="text-[7.5px] min-[380px]:text-[8px] font-black text-yellow-200 truncate block">
                        {card.name}
                      </span>
                      <div className="flex items-center justify-center gap-1 text-[7px] font-black mt-0.5">
                        <span className="text-red-400">⚔{card.attack}</span>
                        <span className="text-sky-400">🛡{card.defense}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. MIDDLE SECTION: TALL 3D DECK BOX STAGE (ZERO OVERLAPPING) */}
      {/* ============================================================== */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-center py-4 sm:py-6 min-h-[360px] sm:min-h-[400px]">
        {/* Name and Status Display Banner OUTSIDE the box - well above the 3D stage */}
        <div className="flex items-center justify-center gap-2 mb-3 px-3.5 py-1 rounded-full bg-black/90 border border-yellow-500/40 shadow-lg z-20">
          <span className="text-xs sm:text-sm font-black uppercase text-yellow-300 tracking-wider">
            {currentSkin.name}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
            isEquipped ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-black/70 text-white/50 border-white/20'
          }`}>
            {isEquipped ? 'ACTIVE IN ARENA' : 'STORED'}
          </span>
        </div>

        {/* 3D Box Container - drag to spin, tap to snap back and open */}
        <div className="scale-90 min-[380px]:scale-95 sm:scale-100 transition-transform origin-center">
          <DeckBox3D
            boxIndex={activeBoxIndex}
            vaultName={currentSkin.name}
            deckCards={currentDeckCards}
            deckSize={deckSize}
            isEquipped={isEquipped}
            skin={currentSkin}
            isOpen={isLidHingedOpen}
            onToggleOpen={() => {
              if (boxState === 'closed') handleOpenDeckBox();
              else if (boxState === 'open') handleSaveAndClose();
            }}
            playSound={playSound}
            isActiveInCarousel={true}
          />
        </div>

        {/* CARDS FLY OUT & FLOAT DOWN TO CAROUSEL ANIMATION */}
        {boxState === 'cards-falling' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
            {currentDeckCards.slice(0, 6).map((c, i) => (
              <div
                key={`flying-out-${c.id}-${i}`}
                className="absolute w-[80px] h-[112px] rounded-xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.95)] bg-black will-change-transform"
                style={{
                  animation: `cardsFlyOutAndFloatDown 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <img src={c.image} alt="Flying Card" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* CARDS FLY UP, ORIENT HORIZONTALLY, & SLIDE INTO DECK BOX ON SAVE */}
        {boxState === 'saving' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
            {currentDeckCards.slice(0, 6).map((c, i) => (
              <div
                key={`flying-in-${c.id}-${i}`}
                className="absolute w-[80px] h-[112px] rounded-xl overflow-hidden border-2 border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,1)] bg-black will-change-transform"
                style={{
                  animation: `cardsFlyUpOrientAndSlideIn 0.58s cubic-bezier(0.34, 1.25, 0.64, 1) forwards`,
                  animationDelay: `${i * 45}ms`,
                }}
              >
                <img src={c.image} alt="Inserting Card" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. BOTTOM CAROUSEL: DECK CONTENTS (FLICK UP / SWIPE DOWN TO REMOVE) */}
      {/* ============================================================== */}
      <div className="relative z-30 w-full p-2 sm:p-3.5 bg-gradient-to-t from-black via-black/95 to-transparent">
        {boxState === 'open' && (
          <div className="space-y-1.5 animate-in slide-in-from-bottom-3 duration-300">
            {/* Header & Save Action Bar */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs sm:text-sm font-black uppercase text-yellow-300 tracking-wider">
                  DECK CONTENTS ({count} / {deckSize})
                </span>
                <span className="hidden sm:inline text-[10px] text-white/40">
                  (Flick up or tap remove)
                </span>
              </div>

              {/* SAVE & CLOSE BUTTON */}
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="min-h-[34px] px-3.5 py-1 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-black" />
                <span>SAVE & CLOSE</span>
              </button>
            </div>

            {count === 0 ? (
              <div className="py-5 text-center bg-black/60 rounded-2xl border border-dashed border-white/20">
                <p className="text-xs font-bold text-yellow-300">Deck Box is Empty</p>
                <p className="text-[10px] text-white/50">Tap inventory cards above to add them to this deck</p>
              </div>
            ) : (
              /* Thumb-friendly horizontal bottom carousel */
              <div className="relative w-full overflow-x-auto py-1 px-1 scrollbar-thin scrollbar-thumb-yellow-600/40">
                <div className="flex gap-2 items-end justify-start min-w-max mx-auto px-1">
                  {currentDeckCards.map((card, idx) => {
                    const isRemoving = removingCard?.id === card.id;
                    const removeDir = removingCard?.direction || 'down';

                    return (
                      <div
                        key={`${card.id}-${idx}`}
                        style={{
                          transform: isRemoving 
                            ? removeDir === 'up'
                              ? 'translateY(-140px) scale(0.7)'
                              : 'translateY(140px) scale(0.7)'
                            : 'translateY(0)',
                          opacity: isRemoving ? 0 : 1,
                          transition: isRemoving ? 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)' : 'all 0.2s ease-out',
                        }}
                        onPointerDown={(e) => {
                          dragStartYRef.current[card.id] = e.clientY;
                        }}
                        onPointerUp={(e) => {
                          const startY = dragStartYRef.current[card.id];
                          if (startY !== undefined) {
                            const dy = e.clientY - startY;
                            // Flicking UP (dy < -25) or swiping DOWN (dy > 25)
                            if (dy < -25) {
                              handleRemoveCard(card, 'up');
                            } else if (dy > 25) {
                              handleRemoveCard(card, 'down');
                            }
                          }
                        }}
                        className="relative w-[70px] min-[380px]:w-[78px] sm:w-[88px] shrink-0 aspect-[640/880] rounded-xl overflow-hidden border-2 bg-black/95 p-1 flex flex-col justify-between shadow-xl cursor-grab active:cursor-grabbing active:scale-95 will-change-transform"
                      >
                        {/* Card Image */}
                        <div
                          className="relative w-full aspect-[640/880] rounded-lg overflow-hidden bg-black"
                          onDoubleClick={() => onOpen3DCard(card)}
                          title="Double-tap to inspect"
                        >
                          <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                          <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-black/85 p-0.5 border border-yellow-400">
                            <img src={ELEMENT_ICONS[card.element]} alt={card.element} className="w-full h-full object-contain" />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen3DCard(card);
                            }}
                            className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/80 text-yellow-400 flex items-center justify-center opacity-70 hover:opacity-100"
                            title="Inspect 3D"
                          >
                            <Eye className="w-2 h-2" />
                          </button>
                        </div>

                        {/* Card Stats */}
                        <div className="py-0.5 text-center leading-none">
                          <span className="text-[7.5px] min-[380px]:text-[8px] font-black text-yellow-200 truncate block">
                            {card.name}
                          </span>
                          <div className="flex items-center justify-center gap-1 text-[7px] font-black mt-0.5">
                            <span className="text-red-400">⚔{card.attack}</span>
                            <span className="text-sky-400">🛡{card.defense}</span>
                          </div>
                        </div>

                        {/* Flick / Tap Remove Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCard(card, 'up');
                          }}
                          className="min-h-[20px] w-full py-0.5 rounded bg-red-950/80 hover:bg-red-800 text-red-200 border border-red-500/40 text-[7px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5 transition-all active:scale-95"
                          title="Flick up or tap to remove from deck"
                        >
                          <ArrowUp className="w-2 h-2" />
                          <span>REMOVE</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* When Box is Closed: Bottom Action Bar */}
        {boxState === 'closed' && (
          <div className="flex flex-col items-center justify-center gap-1.5 py-1.5">
            <button
              type="button"
              onClick={handleOpenDeckBox}
              className="min-h-[44px] w-full max-w-sm py-2 px-6 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>TAP TO OPEN DECK BOX</span>
            </button>
            <span className="text-[9.5px] text-white/50 tracking-wider">
              Tap the box or button above to deploy cards and edit deck
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. FLASHY FLYING CARD (TOP INVENTORY -> BOTTOM DECK CAROUSEL) */}
      {/* ============================================================== */}
      {slidingDownCard && (
        <div
          className="fixed z-[9999] pointer-events-none will-change-transform"
          style={{
            left: `${slidingDownCard.startX}px`,
            top: `${slidingDownCard.startY}px`,
            width: '74px',
            animation: 'flashyCardFlyDownToDeck 0.46s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          {/* Card Frame with Radiant Golden Border & Glow */}
          <div className="relative aspect-[640/880] rounded-xl overflow-hidden border-2 border-yellow-300 shadow-[0_0_25px_rgba(250,204,21,1)] bg-black ring-2 ring-yellow-400">
            <img src={slidingDownCard.card.image} alt="Flying Card" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/35 via-transparent to-white/40" />
            {/* Spinning Sparkle Crest */}
            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-lg animate-spin">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            {/* Elemental Badge */}
            <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/85 p-0.5 border border-yellow-300 shadow">
              <img src={ELEMENT_ICONS[slidingDownCard.card.element]} alt="Element" className="w-full h-full object-contain" />
            </div>
          </div>
          {/* Trailing golden aura */}
          <div className="absolute -inset-2 bg-yellow-400/35 blur-md rounded-full -z-10" />
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. 3D DECK BOX DESIGNER MODAL */}
      {/* ============================================================== */}
      <DeckBoxDesignerModal
        isOpen={isDesignerOpen}
        onClose={() => setIsDesignerOpen(false)}
        boxIndex={designerBoxIndex}
        currentSkin={boxSkins[designerBoxIndex] || DEFAULT_DECK_BOX_SKINS[designerBoxIndex]}
        onSaveSkin={handleSaveSkin}
        cardSleeves={cardSleeves}
        playSound={playSound}
      />
    </div>
  );
};
