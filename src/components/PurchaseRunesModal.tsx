import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  ShieldCheck,
  Flame,
  Droplets,
  Wind,
  Mountain,
  Clock,
  Gift,
  CheckCircle2,
  Lock,
  CreditCard
} from 'lucide-react';
import { ASSETS, SOUNDS } from '../../constants';

interface PurchaseRunesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRunes: number;
  onAddRunes: (amount: number) => void;
  playSound: (soundUrl: string) => void;
}

interface RunePack {
  id: string;
  title: string;
  runes: number;
  bonus: number;
  priceUSD: string;
  badge?: string;
  desc: string;
  gradient: string;
  border: string;
}

const RUNE_PACKS: RunePack[] = [
  {
    id: 'pack-starter',
    title: 'Pouch of Runes',
    runes: 100,
    bonus: 0,
    priceUSD: '$0.99',
    badge: 'STARTER',
    desc: 'Quick essence boost for 1 Forge summon',
    gradient: 'from-amber-600/30 via-yellow-600/20 to-neutral-900',
    border: 'border-amber-500/40 hover:border-amber-400',
  },
  {
    id: 'pack-acolyte',
    title: 'Acolyte Cache',
    runes: 350,
    bonus: 50,
    priceUSD: '$2.99',
    badge: 'POPULAR',
    desc: '3+ Elemental Forges with extra crystal essence',
    gradient: 'from-blue-600/30 via-cyan-600/20 to-neutral-900',
    border: 'border-blue-500/40 hover:border-blue-400',
  },
  {
    id: 'pack-champion',
    title: 'Champion Trove',
    runes: 900,
    bonus: 150,
    priceUSD: '$5.99',
    badge: 'HIGH VALUE',
    desc: 'Empowers high rarity rolls & custom sleeve crafting',
    gradient: 'from-emerald-600/30 via-teal-600/20 to-neutral-900',
    border: 'border-emerald-500/40 hover:border-emerald-400',
  },
  {
    id: 'pack-elder',
    title: 'Elder Vault',
    runes: 2000,
    bonus: 500,
    priceUSD: '$9.99',
    badge: 'BEST VALUE',
    desc: 'Massive rune haul for master deck crafters',
    gradient: 'from-purple-600/30 via-amber-600/20 to-neutral-900',
    border: 'border-purple-500/40 hover:border-purple-400',
  },
  {
    id: 'pack-titan',
    title: "Titan's Hoard",
    runes: 5000,
    bonus: 1500,
    priceUSD: '$19.99',
    badge: 'ULTIMATE',
    desc: 'Unlocks limitless forge mastery and sleeve archives',
    gradient: 'from-yellow-600/40 via-red-600/30 to-neutral-900',
    border: 'border-yellow-400/60 hover:border-yellow-300',
  },
];

const DAILY_CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DAILY_CLAIM_STORAGE_KEY = 'battle_swipes_daily_rune_claim_time';

export const PurchaseRunesModal: React.FC<PurchaseRunesModalProps> = ({
  isOpen,
  onClose,
  currentRunes,
  onAddRunes,
  playSound,
}) => {
  const [claimedToast, setClaimedToast] = useState<{ amount: number; message: string } | null>(null);
  const [timeUntilNextDaily, setTimeUntilNextDaily] = useState<number>(0);
  const [canClaimDaily, setCanClaimDaily] = useState<boolean>(true);

  // Check daily claim eligibility whenever modal opens or every second
  useEffect(() => {
    if (!isOpen) return;

    const checkDailyStatus = () => {
      try {
        const storedTimeStr = localStorage.getItem(DAILY_CLAIM_STORAGE_KEY);
        if (!storedTimeStr) {
          setCanClaimDaily(true);
          setTimeUntilNextDaily(0);
          return;
        }

        const lastClaimTime = parseInt(storedTimeStr, 10);
        if (isNaN(lastClaimTime)) {
          setCanClaimDaily(true);
          setTimeUntilNextDaily(0);
          return;
        }

        const now = Date.now();
        const elapsed = now - lastClaimTime;
        if (elapsed >= DAILY_CLAIM_COOLDOWN_MS) {
          setCanClaimDaily(true);
          setTimeUntilNextDaily(0);
        } else {
          setCanClaimDaily(false);
          setTimeUntilNextDaily(DAILY_CLAIM_COOLDOWN_MS - elapsed);
        }
      } catch (e) {
        setCanClaimDaily(true);
        setTimeUntilNextDaily(0);
      }
    };

    checkDailyStatus();
    const interval = setInterval(checkDailyStatus, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Format milliseconds into HH:MM:SS
  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Handle claiming the 24-hr daily 100 runes
  const handleClaimDaily = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canClaimDaily) return;

    const now = Date.now();
    try {
      localStorage.setItem(DAILY_CLAIM_STORAGE_KEY, now.toString());
    } catch (err) {
      console.warn('Could not persist daily claim timestamp:', err);
    }

    setCanClaimDaily(false);
    setTimeUntilNextDaily(DAILY_CLAIM_COOLDOWN_MS);
    onAddRunes(100);
    playSound(SOUNDS.GAME_WIN);

    setClaimedToast({
      amount: 100,
      message: 'Daily 100 Runes Claimed! Next claim available in 24 hours.',
    });

    setTimeout(() => {
      setClaimedToast(null);
    }, 3000);
  };

  // Handle purchasing rune pack
  const handlePurchasePack = (pack: RunePack) => {
    onAddRunes(pack.runes);
    playSound(SOUNDS.GAME_WIN);

    setClaimedToast({
      amount: pack.runes,
      message: `Purchased ${pack.title} (${pack.priceUSD})! +${pack.runes} Runes added.`,
    });

    setTimeout(() => {
      setClaimedToast(null);
    }, 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-gradient-to-b from-[#18110b] via-[#120a05] to-black border-2 border-yellow-600/70 rounded-2xl sm:rounded-3xl shadow-[0_0_60px_rgba(234,179,8,0.25)] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Mobile-Friendly Close Button with generous touch target and top z-index */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-30 min-w-[42px] min-h-[42px] w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/70 hover:bg-neutral-800 active:bg-neutral-700 border-2 border-yellow-500/50 hover:border-yellow-400 flex items-center justify-center text-yellow-300 hover:text-white shadow-lg active:scale-95 transition-all cursor-pointer"
          aria-label="Close Rune Treasury"
          title="Close Rune Treasury"
        >
          <X className="w-5 h-5 sm:w-5 sm:h-5 stroke-[2.5]" />
        </button>

        {/* Top Header Background Banner */}
        <div className="relative pt-4 sm:pt-5 pb-3 px-4 sm:px-6 text-center border-b border-yellow-600/30 bg-gradient-to-b from-yellow-950/40 via-yellow-900/10 to-transparent shrink-0">
          {/* Elemental Rune Crystals Artwork */}
          <div className="relative flex justify-center mb-1">
            <div className="absolute inset-0 bg-yellow-500/15 blur-2xl rounded-full scale-75 pointer-events-none" />
            <img
              src={ASSETS.PURCHASING_RUNES}
              alt="Purchasing Rune Crystals"
              style={{ maxHeight: '90px', objectFit: 'contain' }}
              className="relative w-24 sm:w-36 max-h-20 sm:max-h-24 h-auto object-contain filter drop-shadow-[0_4px_16px_rgba(234,179,8,0.45)] transition-transform hover:scale-105 duration-300 pointer-events-none"
              draggable={false}
              referrerPolicy="no-referrer"
            />
          </div>

          <h2 className="text-base sm:text-2xl font-black text-yellow-400 tracking-wider uppercase drop-shadow-md">
            Rune Treasury
          </h2>
          <p className="text-[10px] sm:text-xs text-yellow-200/70 max-w-sm mx-auto mt-0.5 font-medium leading-tight">
            Acquire ancient crystal essence to forge custom elemental cards and card backing sleeves
          </p>

          {/* Current Rune Balance Pill */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 mt-2 px-3 py-1 bg-black/80 border border-yellow-500/40 rounded-full shadow-inner">
            <img
              src={ASSETS.CURRENCY_RUNE}
              alt="Rune"
              width={16}
              height={16}
              style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px', maxWidth: '16px', maxHeight: '16px', objectFit: 'contain' }}
              className="rune-currency-icon filter drop-shadow shrink-0"
              draggable={false}
              referrerPolicy="no-referrer"
            />
            <span className="text-[10px] sm:text-xs text-white/60 font-semibold uppercase tracking-wider">Current Balance:</span>
            <span className="text-yellow-400 font-black text-sm sm:text-base leading-none">{currentRunes}</span>
            <span className="text-[9px] text-yellow-200/50 font-bold uppercase">Runes</span>
          </div>

          {/* Four Elements Subtle Indicator */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-2 text-[9px] sm:text-[10px] font-bold text-white/50">
            <span className="flex items-center gap-1 text-red-400/90"><Flame className="w-3 h-3" /> Fire</span>
            <span className="flex items-center gap-1 text-cyan-400/90"><Droplets className="w-3 h-3" /> Ice</span>
            <span className="flex items-center gap-1 text-emerald-400/90"><Wind className="w-3 h-3" /> Wind</span>
            <span className="flex items-center gap-1 text-amber-400/90"><Mountain className="w-3 h-3" /> Earth</span>
          </div>
        </div>

        {/* Claimed Toast Banner */}
        {claimedToast && (
          <div className="mx-3 sm:mx-4 mt-2 py-2 px-3 sm:px-4 rounded-xl bg-yellow-500/20 border border-yellow-400 text-yellow-300 text-center text-xs font-black tracking-wide uppercase flex items-center justify-center gap-2 animate-bounce shadow-lg">
            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="truncate">{claimedToast.message}</span>
          </div>
        )}

        {/* Scrollable Items Container */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-3 custom-scrollbar flex-1">

          {/* ============================================================== */}
          {/* DAILY 100 FREE RUNES (24-HR COOLDOWN)                          */}
          {/* ============================================================== */}
          <div
            className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
              canClaimDaily
                ? 'border-yellow-400/80 bg-gradient-to-r from-yellow-950/70 via-amber-900/40 to-neutral-900 shadow-[0_0_20px_rgba(234,179,8,0.25)]'
                : 'border-white/10 bg-neutral-900/60 opacity-80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0 flex items-start gap-2.5">
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    canClaimDaily
                      ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-black border-yellow-300 shadow-md animate-pulse'
                      : 'bg-neutral-800 text-neutral-500 border-white/10'
                  }`}
                >
                  <Gift className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                      Daily Rune Tribute
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        canClaimDaily
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 animate-pulse'
                          : 'bg-neutral-800 border-white/10 text-neutral-400'
                      }`}
                    >
                      {canClaimDaily ? 'AVAILABLE NOW' : '24HR COOLDOWN'}
                    </span>
                  </div>

                  <p className="text-[10px] sm:text-xs text-white/60 mt-0.5 leading-tight">
                    {canClaimDaily
                      ? 'Claim your daily 100 free runes gift. Refreshes every 24 hours!'
                      : `Applied! Come back in ${formatCountdown(timeUntilNextDaily)} for your next 100 runes.`}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1 text-yellow-400 font-black text-sm sm:text-base">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>+100 Free Runes</span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider ml-1">
                      ($0.00 FREE)
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily Claim Button */}
              <div className="sm:self-center shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={!canClaimDaily}
                  onClick={handleClaimDaily}
                  className={`w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    canClaimDaily
                      ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-black shadow-lg shadow-yellow-500/30 active:scale-95 cursor-pointer'
                      : 'bg-neutral-800 text-neutral-400 border border-white/10 cursor-not-allowed opacity-60'
                  }`}
                >
                  {canClaimDaily ? (
                    <>
                      <Sparkles className="w-4 h-4 text-black" />
                      <span>CLAIM 100 RUNES</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="font-mono text-[11px] sm:text-xs">{formatCountdown(timeUntilNextDaily)}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="flex items-center gap-2 pt-1 pb-0.5">
            <div className="h-px bg-yellow-600/30 flex-1" />
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500/80">
              Rune Crystal Packages
            </span>
            <div className="h-px bg-yellow-600/30 flex-1" />
          </div>

          {/* ============================================================== */}
          {/* REAL WORLD CASH PACKS                                         */}
          {/* ============================================================== */}
          {RUNE_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border ${pack.border} bg-gradient-to-r ${pack.gradient} flex items-center justify-between gap-3 shadow-md hover:brightness-105 transition-all`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
                    {pack.title}
                  </h3>
                  {pack.badge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-black/70 border border-white/20 text-yellow-300">
                      {pack.badge}
                    </span>
                  )}
                </div>

                <p className="text-[10px] sm:text-[11px] text-white/60 mt-0.5 truncate leading-tight">
                  {pack.desc}
                </p>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className="flex items-center gap-1 text-yellow-400 font-black text-sm sm:text-base">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{pack.runes} Runes</span>
                  </div>
                  {pack.bonus > 0 && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/40">
                      +{pack.bonus} Free Bonus
                    </span>
                  )}
                </div>
              </div>

              {/* Price & Action Button with Real Cash Amount */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs sm:text-sm font-black text-yellow-300 font-mono">
                  {pack.priceUSD}
                </span>
                <button
                  type="button"
                  onClick={() => handlePurchasePack(pack)}
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 active:scale-95 text-black font-black text-[11px] sm:text-xs tracking-wider uppercase shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <CreditCard className="w-3 h-3 text-black shrink-0" />
                  <span>BUY {pack.priceUSD}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-3.5 border-t border-yellow-600/30 bg-black/80 flex items-center justify-between text-[9px] sm:text-[10px] text-white/50 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-500/80 shrink-0" />
            <span>Instant In-Game Delivery • Simulated Purchases</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-yellow-400/80 hover:text-yellow-300 underline font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
