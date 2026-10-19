import React from 'react';
import { 
  Volume2, 
  VolumeX, 
  Settings, 
  X, 
  ScrollText, 
  Sliders, 
  ChevronRight, 
  Check, 
  Trophy, 
  Sparkles,
  Zap,
  Volume1
} from 'lucide-react';
import { SOUNDS } from '../../constants';

interface GameOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  gameVolume: number;
  onChangeVolume: (volume: number) => void;
  autoDrawOpeningHand: boolean;
  onToggleAutoDraw: (enabled: boolean) => void;
  onOpenDuelRecords: () => void;
  stats: {
    totalWins: number;
    totalLosses: number;
    farthestLevel: number;
    runes: number;
  };
  playSound: (soundUrl: string) => void;
}

export const GameOptionsModal: React.FC<GameOptionsModalProps> = ({
  isOpen,
  onClose,
  isMuted,
  onToggleMute,
  gameVolume,
  onChangeVolume,
  autoDrawOpeningHand,
  onToggleAutoDraw,
  onOpenDuelRecords,
  stats,
  playSound,
}) => {
  if (!isOpen) return null;

  const handlePresetVolume = (vol: number) => {
    onChangeVolume(vol);
    if (isMuted && vol > 0) {
      onToggleMute();
    }
    playSound(SOUNDS.CARD_SWIPE);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-gradient-to-b from-neutral-900 via-black to-neutral-950 border-2 border-yellow-500/40 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow Accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-yellow-600/30 bg-black/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-950/60 border border-yellow-500/40 flex items-center justify-center shadow-inner">
              <Settings className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex flex-col text-left">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.2em] text-yellow-300">
                Game Options
              </h3>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white/40">
                Audio, Gameplay & Records
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              playSound(SOUNDS.CARD_SWIPE);
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95"
            title="Close Options"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* 1. Duel Records Entry */}
          <div className="bg-black/50 border border-yellow-600/30 rounded-xl p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-yellow-400" />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-yellow-100">
                  Duel Records
                </span>
              </div>
              <span className="text-[9px] font-bold text-yellow-500/80 uppercase tracking-widest">
                Stats & History
              </span>
            </div>

            {/* Quick stats snapshot */}
            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="bg-neutral-900/80 rounded-lg p-2 text-center border border-white/5">
                <div className="text-xs sm:text-sm font-black text-green-400">{stats.totalWins}</div>
                <div className="text-[7px] sm:text-[8px] font-bold uppercase text-white/40 tracking-wider">Victories</div>
              </div>
              <div className="bg-neutral-900/80 rounded-lg p-2 text-center border border-white/5">
                <div className="text-xs sm:text-sm font-black text-red-400">{stats.totalLosses}</div>
                <div className="text-[7px] sm:text-[8px] font-bold uppercase text-white/40 tracking-wider">Defeats</div>
              </div>
              <div className="bg-neutral-900/80 rounded-lg p-2 text-center border border-white/5">
                <div className="text-xs sm:text-sm font-black text-yellow-400">{stats.farthestLevel}</div>
                <div className="text-[7px] sm:text-[8px] font-bold uppercase text-white/40 tracking-wider">Max Depth</div>
              </div>
            </div>

            <button
              onClick={() => {
                playSound(SOUNDS.CARD_SWIPE);
                onClose();
                onOpenDuelRecords();
              }}
              className="w-full py-2 px-3 bg-gradient-to-r from-yellow-950/40 via-yellow-900/30 to-yellow-950/40 hover:from-yellow-900/60 hover:to-yellow-900/60 border border-yellow-500/40 hover:border-yellow-400 rounded-lg text-yellow-300 hover:text-yellow-200 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-between active:scale-[0.98] shadow-sm"
            >
              <span>View Full Duel Records</span>
              <ChevronRight className="w-3.5 h-3.5 text-yellow-400" />
            </button>
          </div>

          {/* 2. Audio & Loudness Controls */}
          <div className="bg-black/50 border border-yellow-600/30 rounded-xl p-3 sm:p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-yellow-400" />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-yellow-100">
                  Sound & Volume
                </span>
              </div>
              <button
                onClick={() => {
                  onToggleMute();
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                  isMuted
                    ? 'bg-red-950/80 text-red-300 border-red-700/60 hover:bg-red-900'
                    : 'bg-green-950/80 text-green-300 border-green-700/60 hover:bg-green-900'
                }`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3 h-3 text-red-400" />
                    <span>Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3 text-green-400" />
                    <span>Sound On</span>
                  </>
                )}
              </button>
            </div>

            {/* Master Volume Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-white/60 uppercase">
                <span className="flex items-center gap-1">
                  <Volume1 className="w-3 h-3 text-yellow-500" />
                  <span>Master Loudness</span>
                </span>
                <span className="text-yellow-400 font-black">{isMuted ? '0%' : `${gameVolume}%`}</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={isMuted ? 0 : gameVolume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChangeVolume(val);
                  if (isMuted && val > 0) {
                    onToggleMute();
                  }
                }}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />

              {/* Volume Quick Presets */}
              <div className="flex items-center justify-between gap-1.5 pt-1">
                {[
                  { label: 'Mute', val: 0 },
                  { label: 'Low', val: 30 },
                  { label: 'Med', val: 65 },
                  { label: 'Max', val: 100 },
                ].map(preset => {
                  const isActive = !isMuted && gameVolume === preset.val;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handlePresetVolume(preset.val)}
                      className={`flex-1 py-1 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all border ${
                        isActive
                          ? 'bg-yellow-400 text-black border-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.4)]'
                          : 'bg-neutral-900/80 text-white/60 hover:text-white border-white/5 hover:border-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Opening Hand Draw Preference */}
          <div className="bg-black/50 border border-yellow-600/30 rounded-xl p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-yellow-100">
                  Opening Hand Draw
                </span>
              </div>
              <button
                onClick={() => {
                  onToggleAutoDraw(!autoDrawOpeningHand);
                  playSound(SOUNDS.CARD_SWIPE);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                  autoDrawOpeningHand
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                    : 'bg-neutral-900/80 text-white/50 border-white/10 hover:border-white/30'
                }`}
              >
                {autoDrawOpeningHand ? (
                  <>
                    <Check className="w-3 h-3 text-yellow-400" />
                    <span>Auto Draw On</span>
                  </>
                ) : (
                  <span>Manual Swipe</span>
                )}
              </button>
            </div>
            <p className="text-[8px] sm:text-[9px] text-white/50 leading-relaxed">
              When enabled, your 5 opening cards are automatically drawn when entering a duel without needing manual upward swipes.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-yellow-600/30 bg-black/70 flex justify-end">
          <button
            onClick={() => {
              playSound(SOUNDS.CARD_SWIPE);
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(234,179,8,0.35)] active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
