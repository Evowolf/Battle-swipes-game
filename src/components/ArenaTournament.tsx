import React, { useState } from 'react';
import { Element } from '../../types';
import { ELEMENT_ICONS, ASSETS, SOUNDS } from '../../constants';
import { TournamentState, TournamentMatch, TournamentFighter } from '../utils/aiNames';
import { Crown, Eye, Swords, ArrowLeft, Zap, RotateCcw, Trophy, FastForward, X } from 'lucide-react';

interface ArenaTournamentProps {
  tournament: TournamentState;
  playerName: string;
  playerAvatar: string;
  onStartMatch: (match: TournamentMatch) => void;
  onWatchAiMatch: (match: TournamentMatch) => void;
  onSimulateMatch: (match: TournamentMatch) => void;
  onSimulateToPlayerMatch: () => void;
  onNewTournament: () => void;
  onReturnToMenu: () => void;
  playSound: (sound: string) => void;
}

export const ArenaTournament: React.FC<ArenaTournamentProps> = ({
  tournament,
  playerName,
  playerAvatar,
  onStartMatch,
  onWatchAiMatch,
  onSimulateMatch,
  onSimulateToPlayerMatch,
  onNewTournament,
  onReturnToMenu,
  playSound,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState<'all' | 1 | 2 | 3>('all');

  const hasTournamentStarted = tournament.matches.some(m => m.status === 'completed');

  // Find all matches ready to clash (both fighters determined and not completed)
  const readyMatches = tournament.matches.filter(
    m => m.status !== 'completed' && m.fighter1.id !== 'tbd' && m.fighter2.id !== 'tbd'
  );

  // Active or selected match
  const focusedMatch = (selectedMatchId && readyMatches.find(m => m.id === selectedMatchId))
    || readyMatches[0]
    || null;

  const isPlayerInFocusMatch = focusedMatch && (focusedMatch.fighter1.isPlayer || focusedMatch.fighter2.isPlayer);
  const isPlayerInAnyReadyMatch = readyMatches.some(m => m.fighter1.isPlayer || m.fighter2.isPlayer);
  const hasFuturePlayerMatch = !tournament.playerEliminated && tournament.matches.some(
    m => m.status !== 'completed' && (m.fighter1.isPlayer || m.fighter2.isPlayer)
  );

  // Player waiting: advanced to a future round, but other matches in the current round are underway
  const isPlayerWaiting = !tournament.playerEliminated && !isPlayerInAnyReadyMatch && hasFuturePlayerMatch;

  const round1Matches = tournament.matches.filter(m => m.round === 1);
  const round2Matches = tournament.matches.filter(m => m.round === 2);
  const round3Matches = tournament.matches.filter(m => m.round === 3);

  const renderFighterSlot = (fighter: TournamentFighter, isWinner: boolean, isLoser: boolean) => {
    const isTBD = fighter.id === 'tbd';

    return (
      <div 
        className={`flex items-center justify-between p-1.5 sm:p-2 rounded-xl border transition-all ${
          isWinner 
            ? 'bg-gradient-to-r from-yellow-500/20 via-yellow-600/10 to-transparent border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.25)]' 
            : isLoser 
            ? 'bg-black/50 border-white/5 opacity-40 grayscale'
            : fighter.isPlayer 
            ? 'bg-yellow-500/15 border-yellow-500/60 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
            : isTBD
            ? 'bg-black/30 border-white/5 border-dashed text-white/30'
            : 'bg-black/60 border-white/10 hover:border-yellow-600/40'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar / Element Badge */}
          <div className="relative shrink-0">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0.5 border overflow-hidden bg-black ${
              fighter.isPlayer 
                ? 'border-yellow-400 shadow-md' 
                : isTBD 
                ? 'border-white/10' 
                : 'border-white/20'
            }`}>
              {isTBD ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-white/30 font-black">
                  ?
                </div>
              ) : (
                <img 
                  src={fighter.avatar} 
                  alt={fighter.name} 
                  className="w-full h-full rounded-full object-cover"
                />
              )}
            </div>
            {!isTBD && (
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/80 border border-white/20 p-0.5 flex items-center justify-center">
                <img src={ELEMENT_ICONS[fighter.element]} className="w-full h-full object-contain" alt="element" />
              </div>
            )}
          </div>

          {/* Name & Player Indicator */}
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs sm:text-sm font-black truncate ${
                fighter.isPlayer ? 'text-yellow-400' : isTBD ? 'text-white/30 italic' : 'text-white'
              }`}>
                {isTBD ? 'TBD' : fighter.name}
              </span>
              {fighter.isPlayer && (
                <span className="text-[7px] sm:text-[8px] bg-yellow-500 text-black px-1.5 py-0.2 rounded font-black tracking-wider uppercase whitespace-nowrap">
                  YOU
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status icon / Crown */}
        <div className="shrink-0 ml-1">
          {isWinner && (
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
          )}
          {isLoser && (
            <X className="w-3.5 h-3.5 text-red-500/60" />
          )}
        </div>
      </div>
    );
  };

  const renderMatchCard = (match: TournamentMatch) => {
    const isCompleted = match.status === 'completed';
    const isFocused = focusedMatch?.id === match.id;
    const isF1Winner = isCompleted && match.winner?.id === match.fighter1.id;
    const isF2Winner = isCompleted && match.winner?.id === match.fighter2.id;
    const isReady = match.fighter1.id !== 'tbd' && match.fighter2.id !== 'tbd' && !isCompleted;
    const isPlayerMatch = isReady && (match.fighter1.isPlayer || match.fighter2.isPlayer);

    return (
      <div 
        key={match.id}
        onClick={() => {
          if (isReady) {
            setSelectedMatchId(match.id);
            playSound(SOUNDS.MENU_POP);
          }
        }}
        className={`relative p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex flex-col gap-1.5 sm:gap-2 shadow-xl backdrop-blur-md ${
          isReady ? 'cursor-pointer' : ''
        } ${
          isFocused && isReady
            ? 'bg-[#201308]/95 border-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.4)] scale-[1.01]' 
            : isCompleted
            ? 'bg-black/70 border-yellow-900/30 opacity-80'
            : isReady
            ? 'bg-black/60 border-white/15 hover:border-yellow-500/60'
            : 'bg-black/30 border-white/5 opacity-50'
        }`}
      >
        {/* Match Header Badge */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-yellow-500/80">
            {match.round === 1 ? `Quarterfinal #${match.matchNumber}` : match.round === 2 ? `Semifinal #${match.matchNumber - 4}` : 'Grand Final'}
          </span>

          <div className="flex items-center gap-1.5">
            {isReady && !isPlayerMatch && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onWatchAiMatch(match);
                }}
                className="px-2 py-0.5 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/60 text-yellow-300 text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all"
                title="Watch this duel"
              >
                <Eye className="w-2.5 h-2.5 text-yellow-300 shrink-0" />
                <span>WATCH</span>
              </button>
            )}

            {isPlayerMatch && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartMatch(match);
                }}
                className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 shadow-md animate-pulse"
                title="Fight this match"
              >
                <Swords className="w-2.5 h-2.5 text-black shrink-0" />
                <span>FIGHT</span>
              </button>
            )}

            {isCompleted && (
              <span className="text-[8px] sm:text-[9px] text-green-400 font-bold uppercase tracking-wider">
                COMPLETED
              </span>
            )}
          </div>
        </div>

        {/* Fighter 1 */}
        {renderFighterSlot(match.fighter1, isF1Winner, isCompleted && !isF1Winner)}

        {/* VS Divider */}
        <div className="flex items-center justify-center my-0.5">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="px-2 text-[8px] sm:text-[9px] font-black text-white/30 uppercase tracking-widest">
            VS
          </span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        {/* Fighter 2 */}
        {renderFighterSlot(match.fighter2, isF2Winner, isCompleted && !isF2Winner)}
      </div>
    );
  };

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] bg-black text-white font-cinzel select-none flex flex-col justify-between overflow-y-auto overscroll-y-contain custom-scrollbar">
      {/* Background Ambience */}
      <div 
        className="fixed inset-0 bg-cover bg-center brightness-[0.2] scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${ASSETS.BACKDROP})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none" />

      {/* TOP HEADER */}
      <div className="relative z-20 w-full max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 pb-2 shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-yellow-600/30 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onReturnToMenu}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/90 border border-yellow-600/40 text-yellow-400 font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>MENU</span>
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-black uppercase tracking-wider text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                CLASHING TOURNAMENT
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Start Tournament Quick Action if unstarted */}
            {!hasTournamentStarted && focusedMatch && (
              <button
                onClick={() => {
                  if (isPlayerInFocusMatch) {
                    onStartMatch(focusedMatch);
                  } else {
                    onWatchAiMatch(focusedMatch);
                  }
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 border border-yellow-200"
              >
                <Zap className="w-4 h-4 text-black shrink-0" />
                <span>START TOURNAMENT</span>
              </button>
            )}

            {/* Player Status Moniker */}
            <div className="flex items-center gap-2 bg-black/80 px-3.5 py-1.5 rounded-2xl border border-yellow-500/50 shadow-lg">
              <div className="w-8 h-8 rounded-full border border-yellow-400 overflow-hidden bg-black shrink-0">
                <img src={playerAvatar} alt={playerName} className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-yellow-300 truncate max-w-[120px]">
                  {playerName}
                </div>
                <div className={`text-[8px] font-black uppercase tracking-widest ${
                  tournament.playerEliminated ? 'text-red-400' : 'text-green-400'
                }`}>
                  {tournament.playerEliminated ? 'Eliminated' : 'Active'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Round Filter Tabs for Mobile & Small Screens */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-1">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 max-w-full custom-scrollbar">
            <button
              onClick={() => setRoundFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                roundFilter === 'all'
                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-md'
                  : 'bg-black/60 text-white/60 border-white/10 hover:text-white'
              }`}
            >
              ALL ROUNDS
            </button>
            <button
              onClick={() => setRoundFilter(1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                roundFilter === 1
                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-md'
                  : 'bg-black/60 text-white/60 border-white/10 hover:text-white'
              }`}
            >
              QUARTERFINALS
            </button>
            <button
              onClick={() => setRoundFilter(2)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                roundFilter === 2
                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-md'
                  : 'bg-black/60 text-white/60 border-white/10 hover:text-white'
              }`}
            >
              SEMIFINALS
            </button>
            <button
              onClick={() => setRoundFilter(3)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                roundFilter === 3
                  ? 'bg-yellow-500 text-black border-yellow-400 shadow-md'
                  : 'bg-black/60 text-white/60 border-white/10 hover:text-white'
              }`}
            >
              FINALS
            </button>
          </div>

          <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold hidden sm:block">
            ↕ SCROLL BRACKET
          </div>
        </div>
      </div>

      {/* TOURNAMENT ELIMINATION BANNER */}
      {tournament.playerEliminated && !tournament.champion && (
        <div className="relative z-20 w-full max-w-4xl mx-auto px-3 sm:px-6 my-2">
          <div className="p-3 sm:p-4 rounded-2xl bg-red-950/80 border-2 border-red-600/60 shadow-[0_0_25px_rgba(239,68,68,0.3)] flex items-center justify-between gap-3">
            <div className="text-xs sm:text-sm font-black text-red-300 uppercase tracking-wider">
              KNOCKED OUT OF BRACKET
            </div>
            <button
              onClick={onNewTournament}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-yellow-600 text-white font-black text-xs uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 whitespace-nowrap flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>NEW TOURNAMENT</span>
            </button>
          </div>
        </div>
      )}

      {/* TOURNAMENT CHAMPION BANNER */}
      {tournament.champion && (
        <div className="relative z-20 w-full max-w-3xl mx-auto px-3 sm:px-6 my-3">
          <div className="p-4 sm:p-6 rounded-3xl bg-[#1c1208]/95 border-2 sm:border-4 border-yellow-400 shadow-[0_0_50px_rgba(234,179,8,0.5)] text-center space-y-2.5">
            <Trophy className="w-10 h-10 text-yellow-400 mx-auto" />
            <div className="text-lg sm:text-2xl font-black uppercase tracking-wider text-yellow-300">
              {tournament.champion.isPlayer ? 'YOU ARE THE TOURNAMENT CHAMPION!' : `${tournament.champion.name.toUpperCase()} IS CHAMPION!`}
            </div>
            <div className="text-xs font-black text-yellow-400 uppercase tracking-widest">
              +500 RUNES AWARDED
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={onNewTournament}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-black shrink-0" />
                <span>PLAY AGAIN</span>
              </button>
              <button
                onClick={onReturnToMenu}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-black/70 hover:bg-black/90 border border-white/20 text-white font-black text-xs sm:text-sm uppercase tracking-wider transition-all"
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOURNAMENT BRACKET TREE (Fully Scrollable) */}
      <div className="relative z-20 w-full max-w-6xl mx-auto px-3 sm:px-6 my-3 flex-1 pb-32 sm:pb-36">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
          
          {/* COLUMN 1: QUARTERFINALS */}
          {(roundFilter === 'all' || roundFilter === 1) && (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="text-center bg-black/70 py-1.5 rounded-xl border border-yellow-900/50">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-yellow-400">
                  Quarterfinals
                </span>
              </div>
              <div className="space-y-2.5">
                {round1Matches.map(m => renderMatchCard(m))}
              </div>
            </div>
          )}

          {/* COLUMN 2: SEMIFINALS */}
          {(roundFilter === 'all' || roundFilter === 2) && (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="text-center bg-black/70 py-1.5 rounded-xl border border-yellow-900/50">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-yellow-400">
                  Semifinals
                </span>
              </div>
              <div className="space-y-2.5 sm:space-y-6">
                {round2Matches.map(m => renderMatchCard(m))}
              </div>
            </div>
          )}

          {/* COLUMN 3: GRAND FINAL & PODIUM */}
          {(roundFilter === 'all' || roundFilter === 3) && (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="text-center bg-black/70 py-1.5 rounded-xl border border-yellow-900/50">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-yellow-400">
                  Grand Final
                </span>
              </div>
              <div className="space-y-3">
                {round3Matches.map(m => renderMatchCard(m))}

                {/* Champion Podium Stand */}
                <div className={`p-4 rounded-2xl border-2 text-center transition-all ${
                  tournament.champion 
                    ? 'bg-gradient-to-b from-yellow-500/30 to-amber-950/80 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.4)] scale-102'
                    : 'bg-black/40 border-white/10 border-dashed opacity-60'
                }`}>
                  <Trophy className="w-7 h-7 text-yellow-400 mx-auto mb-1" />
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-yellow-400">
                    {tournament.champion ? tournament.champion.name : 'TOURNAMENT CROWN'}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR (Always visible and reachable while scrolling) */}
      <div className="sticky bottom-0 z-40 w-full bg-neutral-950/95 border-t border-yellow-600/40 backdrop-blur-xl px-3 sm:px-6 py-2.5 sm:py-3.5 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] shrink-0">
        <div className="max-w-4xl mx-auto">
          {focusedMatch && !tournament.champion && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
              {/* Match Details & Status */}
              <div className="text-center sm:text-left min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-xs sm:text-sm font-black text-yellow-400 uppercase tracking-wider truncate">
                    {focusedMatch.fighter1.name} VS {focusedMatch.fighter2.name}
                  </span>
                  {isPlayerWaiting && (
                    <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider shrink-0">
                      WAITING FOR NEXT DUEL
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                {isPlayerInFocusMatch ? (
                  /* Player's turn to fight */
                  <button
                    onClick={() => onStartMatch(focusedMatch)}
                    className="min-h-[46px] px-6 py-2 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(234,179,8,0.7)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-yellow-200"
                  >
                    <Swords className="w-4 h-4 text-black shrink-0" />
                    <span>{hasTournamentStarted ? 'FIGHT YOUR DUEL' : 'START TOURNAMENT'}</span>
                  </button>
                ) : (
                  /* AI vs AI Match Controls */
                  <>
                    <button
                      onClick={() => onWatchAiMatch(focusedMatch)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-yellow-500/25 hover:bg-yellow-500/40 border border-yellow-400/70 text-yellow-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
                      title="Watch live battle"
                    >
                      <Eye className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                      <span>WATCH BATTLE</span>
                    </button>
                    <button
                      onClick={() => onSimulateMatch(focusedMatch)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5"
                      title="Simulate battle"
                    >
                      <Zap className="w-3.5 h-3.5 text-white/80 shrink-0" />
                      <span>SIMULATE</span>
                    </button>
                    {hasFuturePlayerMatch && (
                      <button
                        onClick={onSimulateToPlayerMatch}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
                        title="Skip to your next battle"
                      >
                        <FastForward className="w-3.5 h-3.5 text-black shrink-0" />
                        <span>SKIP TO MY MATCH</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!focusedMatch && !tournament.champion && (
            <div className="text-center py-1">
              <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                Awaiting Next Round
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

