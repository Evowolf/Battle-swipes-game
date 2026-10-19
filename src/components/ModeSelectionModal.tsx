import React from 'react';
import { Sword, Trophy, Wifi, Bluetooth, X } from 'lucide-react';
import { SOUNDS } from '../../constants';

export type ModeSelectionType = 'arena' | 'tournament';
export type BattleChoice = 'single' | 'wifi' | 'bluetooth';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ModeSelectionType;
  onSelect: (choice: BattleChoice) => void;
  playSound: (soundUrl: string) => void;
}

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSelect,
  playSound,
}) => {
  if (!isOpen) return null;

  const isTournament = mode === 'tournament';

  const options = isTournament
    ? [
        {
          id: 'single' as BattleChoice,
          title: 'Solo Tournament',
          description: '8-duelist championship bracket against AI contenders',
          badge: 'Solo AI',
          icon: <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />,
          accentBg: 'bg-yellow-500/15 border-yellow-500/30 hover:border-yellow-400 group-hover:bg-yellow-500/25',
          tagColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        },
        {
          id: 'wifi' as BattleChoice,
          title: 'Wi-Fi Tournament',
          description: 'Host or join bracket duels on your local network',
          badge: 'Network',
          icon: <Wifi className="w-5 h-5 text-amber-400 shrink-0" />,
          accentBg: 'bg-amber-500/15 border-amber-500/30 hover:border-amber-400 group-hover:bg-amber-500/25',
          tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        },
        {
          id: 'bluetooth' as BattleChoice,
          title: 'Bluetooth Tournament',
          description: 'Direct peer connection with nearby smartphones & tablets',
          badge: 'Direct Link',
          icon: <Bluetooth className="w-5 h-5 text-blue-400 shrink-0" />,
          accentBg: 'bg-blue-500/15 border-blue-500/30 hover:border-blue-400 group-hover:bg-blue-500/25',
          tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        },
      ]
    : [
        {
          id: 'single' as BattleChoice,
          title: 'Single Battle',
          description: 'Classic 1v1 elemental clash against the Master AI',
          badge: 'Solo AI',
          icon: <Sword className="w-5 h-5 text-yellow-400 shrink-0" />,
          accentBg: 'bg-yellow-500/15 border-yellow-500/30 hover:border-yellow-400 group-hover:bg-yellow-500/25',
          tagColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        },
        {
          id: 'wifi' as BattleChoice,
          title: 'Wi-Fi Battle',
          description: 'Host or join duels on your local network or online room',
          badge: 'Network',
          icon: <Wifi className="w-5 h-5 text-amber-400 shrink-0" />,
          accentBg: 'bg-amber-500/15 border-amber-500/30 hover:border-amber-400 group-hover:bg-amber-500/25',
          tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        },
        {
          id: 'bluetooth' as BattleChoice,
          title: 'Bluetooth Battle',
          description: 'Direct peer-to-peer duel with nearby mobile devices',
          badge: 'Direct Link',
          icon: <Bluetooth className="w-5 h-5 text-blue-400 shrink-0" />,
          accentBg: 'bg-blue-500/15 border-blue-500/30 hover:border-blue-400 group-hover:bg-blue-500/25',
          tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-neutral-950/95 border-2 border-yellow-500/60 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-yellow-500/25 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 shrink-0">
              {isTournament ? <Trophy className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sword className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-black text-yellow-400 uppercase tracking-wider sm:tracking-widest leading-none truncate">
                {isTournament ? 'Select Tournament' : 'Select Arena Mode'}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-yellow-200/60 font-medium mt-1 truncate">
                {isTournament ? 'Choose your championship format' : 'Choose your battlefield'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound(SOUNDS.MENU_POP);
              onClose();
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="flex flex-col gap-2 sm:gap-2.5">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                playSound(SOUNDS.MENU_POP);
                onSelect(opt.id);
              }}
              className={`w-full text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer group flex items-center justify-between gap-2.5 ${opt.accentBg} active:scale-[0.98]`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-xl bg-black/60 border border-white/10 shadow-inner group-hover:scale-105 transition-transform shrink-0">
                  {opt.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-yellow-200 group-hover:text-yellow-100 uppercase tracking-wide truncate">
                    {opt.title}
                  </h3>
                  <p className="text-[9px] sm:text-[11px] text-white/60 group-hover:text-white/80 line-clamp-2 mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </div>
              </div>
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border shrink-0 ${opt.tagColor}`}>
                {opt.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Footer cancel button */}
        <button
          onClick={() => {
            playSound(SOUNDS.MENU_POP);
            onClose();
          }}
          className="w-full py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
