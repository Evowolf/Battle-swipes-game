import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Bluetooth,
  Users,
  Copy,
  Check,
  RefreshCw,
  X,
  Sparkles,
  Shield,
  Zap,
  Sword,
  Trophy,
  Smartphone,
  ExternalLink,
  Signal,
  CheckCircle2,
  AlertCircle,
  Dices,
  Radio
} from 'lucide-react';
import { Card, Element } from '../../types';
import { SOUNDS } from '../../constants';
import {
  MultiplayerMode,
  ConnectionType,
  MultiplayerRoom,
  SyncedDeckPayload,
  BluetoothDeviceOption,
} from '../types/multiplayer';
import { multiplayerService } from '../services/multiplayerService';
import { prepareDeckForSync, unpackOpponentDeck } from '../utils/cardSync';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: MultiplayerMode;
  initialConnectionType: ConnectionType;
  equippedDeck: Card[];
  playerName: string;
  playerAvatar?: string;
  runesCount: number;
  playSound: (soundUrl: string) => void;
  onStartBattle: (opponentDeck: Card[], opponentName: string, opponentAvatar: string, isTournament: boolean) => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialConnectionType,
  equippedDeck,
  playerName,
  playerAvatar,
  runesCount,
  playSound,
  onStartBattle,
}) => {
  const [activeTab, setActiveTab] = useState<ConnectionType>(initialConnectionType);
  const [activeAction, setActiveAction] = useState<'menu' | 'host' | 'join'>('menu');

  // Wi-Fi Pass Code states
  const [hostPasscode, setHostPasscode] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [createdRoom, setCreatedRoom] = useState<MultiplayerRoom | null>(null);
  const [discoveredRooms, setDiscoveredRooms] = useState<MultiplayerRoom[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Bluetooth scanning & beacon state
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [isHostingBluetoothBeacon, setIsHostingBluetoothBeacon] = useState(false);
  const [bluetoothPasscode, setBluetoothPasscode] = useState('');
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDeviceOption[]>([
    { id: 'bt-1', name: 'BattleSwipes-Player2', rssi: -52, paired: false },
    { id: 'bt-2', name: 'Duelist-Galaxy-Tab', rssi: -68, paired: false },
  ]);

  // Sync and launch state
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoLaunchCountdown, setAutoLaunchCountdown] = useState<number | null>(null);
  const [connectedOpponent, setConnectedOpponent] = useState<{
    name: string;
    avatar?: string;
    deck?: Card[];
  } | null>(null);
  const [isOpponentReady, setIsOpponentReady] = useState(false);

  // References to avoid stale closures in event callbacks
  const connectedOpponentRef = useRef(connectedOpponent);
  connectedOpponentRef.current = connectedOpponent;
  const onStartBattleRef = useRef(onStartBattle);
  onStartBattleRef.current = onStartBattle;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const hasBattleLaunchedRef = useRef(false);
  const autoLaunchTimerRef = useRef<any>(null);

  // Generate a random clean passcode
  const generateRandomPasscode = () => {
    const prefixes = ['FIRE', 'RUNE', 'VALOR', 'DUEL', 'CLASH', 'ARENA', 'BEAST'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${num}`;
  };

  // Reset or initialize state when opening modal
  useEffect(() => {
    if (isOpen) {
      hasBattleLaunchedRef.current = false;
      if (autoLaunchTimerRef.current) {
        clearTimeout(autoLaunchTimerRef.current);
        autoLaunchTimerRef.current = null;
      }
      setActiveTab(initialConnectionType);
      setActiveAction('menu');
      setConnectedOpponent(null);
      setIsOpponentReady(false);
      setSyncProgress(0);
      setConnectionError(null);
      setIsConnecting(false);
      setAutoLaunchCountdown(null);
      setHostPasscode(generateRandomPasscode());
      setJoinPasscode('');
      setBluetoothPasscode(`BT-${Math.floor(100 + Math.random() * 900)}`);
      multiplayerService.queryAvailableRooms();
      multiplayerService.queryBluetoothBeacons();
    }
  }, [isOpen, initialConnectionType]);

  // Subscribe to multiplayer events
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = multiplayerService.subscribe((event) => {
      switch (event.type) {
        case 'rooms_list_updated':
          if (Array.isArray(event.data)) {
            setDiscoveredRooms(event.data);
          }
          break;

        case 'room_discovered':
          if (event.data) {
            setDiscoveredRooms((prev) => {
              if (prev.some((r) => r.id === event.data.id)) return prev;
              return [...prev, event.data];
            });
          }
          break;

        case 'room_created':
          if (event.data) {
            setCreatedRoom(event.data);
            setConnectionError(null);
          }
          break;

        case 'create_room_error':
          setConnectionError(event.data?.message || 'Error creating room. Try a different pass code.');
          break;

        case 'opponent_joined':
          // Host receives guest connection
          setIsConnecting(false);
          setConnectionError(null);
          setConnectedOpponent({
            name: event.data.duelistName || 'Challenger',
            avatar: event.data.avatarUrl,
          });
          playSound(SOUNDS.CHIME);
          startDeckSyncProcess();
          break;

        case 'connected_to_host':
          // Guest receives host confirmation
          setIsConnecting(false);
          setConnectionError(null);
          setConnectedOpponent({
            name: event.data.hostName || 'Host Duelist',
            avatar: event.data.hostAvatar,
          });
          playSound(SOUNDS.CHIME);
          startDeckSyncProcess();
          break;

        case 'join_error':
          setIsConnecting(false);
          setConnectionError(event.data?.message || `Could not find room with pass code "${event.data?.code}".`);
          break;

        case 'deck_sync_received':
          if (event.data) {
            const unpacked = unpackOpponentDeck(event.data);
            const oppName = event.data.duelistName || connectedOpponentRef.current?.name || 'Opponent';
            const oppAvatar = event.data.avatarUrl || connectedOpponentRef.current?.avatar;

            setConnectedOpponent({
              name: oppName,
              avatar: oppAvatar,
              deck: unpacked,
            });
            setIsOpponentReady(true);
            setSyncProgress(100);

            // Trigger automatic battle launch for both connected players!
            triggerAutoLaunchBattle(unpacked, oppName, oppAvatar);
          }
          break;

        case 'battle_started':
          // Server broadcasted start_battle event to all players in the room
          launchBattleImmediately();
          break;

        case 'bluetooth_devices_updated':
          if (Array.isArray(event.data)) {
            setBluetoothDevices((prev) => {
              const combined = [...event.data];
              prev.forEach((p) => {
                if (!combined.some((c) => c.id === p.id)) {
                  combined.push(p);
                }
              });
              return combined;
            });
          }
          break;

        case 'opponent_disconnected':
          setConnectedOpponent(null);
          setIsOpponentReady(false);
          setAutoLaunchCountdown(null);
          setConnectionError('Opponent disconnected from the match.');
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, equippedDeck, playerName, playerAvatar]);

  // Deck packaging & sync
  const startDeckSyncProcess = async () => {
    setIsSyncing(true);
    setSyncProgress(25);
    try {
      const payload = await prepareDeckForSync(
        equippedDeck,
        playerName || 'Warrior',
        playerAvatar,
        'Active Custom Deck',
        runesCount,
        (p) => setSyncProgress(Math.max(25, p))
      );
      multiplayerService.sendDeckSync(payload);
      setSyncProgress(90);
    } catch (err) {
      console.error('Deck sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Safe single-execution battle launcher
  const executeLaunchBattle = (opponentDeck: Card[], opponentName: string, opponentAvatar?: string) => {
    if (hasBattleLaunchedRef.current) return;
    hasBattleLaunchedRef.current = true;

    if (autoLaunchTimerRef.current) {
      clearTimeout(autoLaunchTimerRef.current);
      autoLaunchTimerRef.current = null;
    }

    onCloseRef.current();
    onStartBattleRef.current(
      opponentDeck,
      opponentName,
      opponentAvatar || '',
      modeRef.current === 'tournament'
    );
  };

  // Automated battle launcher once custom decks are exchanged
  const triggerAutoLaunchBattle = (opponentDeck: Card[], opponentName: string, opponentAvatar?: string) => {
    // Notify server to start battle
    multiplayerService.startBattle(modeRef.current === 'tournament');

    // Countdown of 600ms for visual polish
    setAutoLaunchCountdown(1);
    if (autoLaunchTimerRef.current) {
      clearTimeout(autoLaunchTimerRef.current);
    }
    autoLaunchTimerRef.current = setTimeout(() => {
      executeLaunchBattle(opponentDeck, opponentName, opponentAvatar);
    }, 600);
  };

  const launchBattleImmediately = () => {
    const opp = connectedOpponentRef.current;
    if (!opp?.deck) return;
    executeLaunchBattle(opp.deck, opp.name || 'Opponent', opp.avatar || '');
  };

  // Host Wi-Fi Room with custom pass code
  const handleHostRoom = () => {
    const codeToUse = hostPasscode.trim().toUpperCase() || generateRandomPasscode();
    const room = multiplayerService.createRoom(
      mode,
      activeTab,
      playerName || 'Warrior',
      playerAvatar,
      codeToUse
    );
    setCreatedRoom(room);
    setActiveAction('host');
    setConnectionError(null);
  };

  // Join Wi-Fi Room with typed pass code
  const handleJoinByPasscode = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setIsConnecting(true);
    setConnectionError(null);
    multiplayerService.joinRoom(
      cleanCode,
      mode,
      activeTab,
      playerName || 'Challenger',
      playerAvatar
    );
    setActiveAction('join');
  };

  const handleCopyCode = () => {
    const code = createdRoom?.id || hostPasscode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Bluetooth scanning & pairing
  const handleScanBluetooth = async () => {
    setIsScanningBluetooth(true);
    multiplayerService.queryBluetoothBeacons();

    // Check for native Web Bluetooth if browser supports it
    if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
        });
        if (device && device.name) {
          setBluetoothDevices((prev) => [
            { id: device.id, name: device.name, rssi: -42, paired: false, nativeDevice: device },
            ...prev,
          ]);
        }
      } catch (err) {
        // User cancelled or browser doesn't permit
      }
    }

    setTimeout(() => {
      setIsScanningBluetooth(false);
    }, 2000);
  };

  const handleHostBluetoothBeacon = () => {
    setIsHostingBluetoothBeacon(true);
    multiplayerService.registerBluetoothBeacon(
      `${playerName || 'Warrior'}'s Phone`,
      playerName || 'Warrior',
      playerAvatar,
      mode
    );
    // Also create a Bluetooth room so someone pairing directly can join
    const btCode = bluetoothPasscode.trim().toUpperCase() || `BT-${Math.floor(100 + Math.random() * 900)}`;
    multiplayerService.createRoom(mode, 'bluetooth', playerName || 'Warrior', playerAvatar, btCode);
    setCreatedRoom({
      id: btCode,
      name: `${playerName}'s Bluetooth Beacon`,
      hostName: playerName || 'Warrior',
      hostAvatar: playerAvatar,
      mode,
      connectionType: 'bluetooth',
      playerCount: 1,
      createdAt: Date.now(),
      status: 'waiting',
    });
  };

  const handlePairBluetooth = (dev: BluetoothDeviceOption) => {
    setIsConnecting(true);
    setConnectionError(null);
    // Clean identifier for room connection
    const targetRoomId = dev.id.startsWith('bt-') ? dev.id : `BT-${dev.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '7788'}`;
    multiplayerService.joinRoom(targetRoomId, mode, 'bluetooth', playerName || 'Challenger', playerAvatar);
  };

  // Local simulated test duel
  const handleStartLocalTestMode = async () => {
    setActiveTab('test');
    setIsSyncing(true);
    setSyncProgress(30);

    const simulatedDeck: Card[] = equippedDeck.map((c, i) => ({
      ...c,
      id: `sim-opp-${i}-${Date.now()}`,
      name: `Rival ${c.name}`,
      element: [Element.FIRE, Element.ICE, Element.WIND, Element.EARTH][i % 4],
      attack: Math.max(10, c.attack + (i % 2 === 0 ? 5 : -5)),
      defense: Math.max(5, c.defense + (i % 2 === 0 ? 2 : -2)),
    }));

    setTimeout(() => {
      setSyncProgress(100);
      setIsSyncing(false);
      const testOpponent = {
        name: 'Challenger Evowolf',
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
        deck: simulatedDeck,
      };
      setConnectedOpponent(testOpponent);
      setIsOpponentReady(true);
      triggerAutoLaunchBattle(simulatedDeck, testOpponent.name, testOpponent.avatar);
    }, 600);
  };

  const handleOpenSecondWindow = () => {
    const code = createdRoom?.id || hostPasscode;
    if (code) {
      window.open(`${window.location.origin}?joinRoom=${code}`, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-[#1c120c] via-[#140b07] to-black border-2 border-yellow-600/70 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.25)] flex flex-col overflow-hidden max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-3 sm:p-5 border-b border-yellow-600/30 bg-black/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-yellow-500/20 border border-yellow-400/50 flex items-center justify-center shadow-inner text-yellow-400 shrink-0">
              {mode === 'tournament' ? <Trophy className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sword className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-base font-black text-yellow-400 uppercase tracking-wider leading-none truncate">
                  {mode === 'tournament' ? 'Tournament Lobby' : 'Multiplayer Lobby'}
                </h2>
                <span className="px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REAL-TIME LIVE
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-yellow-200/60 font-medium mt-0.5 truncate">
                Join with custom pass code & instant card duel launch
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              multiplayerService.leaveRoom();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection Type Tabs */}
        <div className="grid grid-cols-3 bg-black/40 border-b border-yellow-600/30 p-1.5 gap-1.5">
          <button
            onClick={() => {
              setActiveTab('wifi');
              setActiveAction('menu');
              setConnectionError(null);
            }}
            className={`py-2 px-1.5 sm:px-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'wifi'
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/60 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Wi-Fi (Pass Codes)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('bluetooth');
              setActiveAction('menu');
              setConnectionError(null);
            }}
            className={`py-2 px-1.5 sm:px-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bluetooth'
                ? 'bg-blue-500/30 text-blue-300 border border-blue-400/60 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Bluetooth</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('test');
              handleStartLocalTestMode();
            }}
            className={`py-2 px-1.5 sm:px-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'test'
                ? 'bg-purple-500/30 text-purple-300 border border-purple-400/60 shadow-md'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Test Duel</span>
          </button>
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar">

          {/* Connection Error Banner */}
          {connectionError && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="flex-1">{connectionError}</span>
              <button
                onClick={() => setConnectionError(null)}
                className="text-red-300 hover:text-white text-xs underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Connecting State Spinner */}
          {isConnecting && !connectedOpponent && (
            <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/40 text-center space-y-2 animate-fade-in">
              <RefreshCw className="w-6 h-6 animate-spin text-yellow-400 mx-auto" />
              <p className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
                Connecting to Opponent with Pass Code...
              </p>
              <p className="text-[10px] text-white/50">
                Synchronizing card deck and launching battle once linked.
              </p>
            </div>
          )}

          {/* Connected & Auto-Launching Screen */}
          {connectedOpponent ? (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/50 flex flex-col items-center text-center">
                <div className="flex items-center justify-around gap-2 w-full">
                  {/* Local Player */}
                  <div className="flex flex-col items-center min-w-[70px] max-w-[110px]">
                    <img
                      src={playerAvatar || 'https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Card%20backing.jpeg'}
                      alt="You"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-yellow-400 object-cover shadow-lg shrink-0"
                    />
                    <span className="text-[11px] sm:text-xs font-black text-yellow-400 mt-1 truncate max-w-full">{playerName || 'You'}</span>
                    <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> Ready
                    </span>
                  </div>

                  {/* VS Emblem & Launch Timer */}
                  <div className="flex flex-col items-center">
                    <div className="px-3 sm:px-4 py-1.5 bg-yellow-500/20 border border-yellow-500/50 rounded-full text-yellow-300 font-black text-xs sm:text-sm tracking-widest animate-pulse">
                      VS
                    </div>
                    {autoLaunchCountdown !== null && (
                      <span className="text-[10px] font-black text-emerald-400 mt-1.5 uppercase tracking-wider animate-bounce">
                        STARTING NOW!
                      </span>
                    )}
                  </div>

                  {/* Opponent Player */}
                  <div className="flex flex-col items-center min-w-[70px] max-w-[110px]">
                    <img
                      src={connectedOpponent.avatar || 'https://raw.githubusercontent.com/Evowolf/Battle-Swipes-assets-/refs/heads/main/Card%20backing.jpeg'}
                      alt="Opponent"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-red-500 object-cover shadow-lg shrink-0"
                    />
                    <span className="text-[11px] sm:text-xs font-black text-red-400 mt-1 truncate max-w-full">{connectedOpponent.name}</span>
                    <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> {isOpponentReady ? 'Connected' : 'Syncing...'}
                    </span>
                  </div>
                </div>

                {/* Synchronization Status */}
                <div className="w-full mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-yellow-200/80">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      {syncProgress >= 100 ? 'Cards Synchronized! Launching Battle...' : 'Transmitting Custom Cards & Stats...'}
                    </span>
                    <span>{syncProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 via-amber-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>

                {/* Opponent Card Deck Summary */}
                {connectedOpponent.deck && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white/5 border border-white/10 w-full text-left">
                    <div className="text-[10px] font-black uppercase tracking-wider text-yellow-400 mb-1.5">
                      Opponent's Transferred Deck ({connectedOpponent.deck.length} Cards):
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                      {connectedOpponent.deck.slice(0, 6).map((c, idx) => (
                        <div key={idx} className="shrink-0 w-12 h-16 rounded-md border border-white/20 bg-black/60 overflow-hidden relative group">
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white/50">
                              {c.name.slice(0, 4)}
                            </div>
                          )}
                          <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] font-black text-center text-yellow-300 truncate px-0.5">
                            {c.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Instant Manual Launch Button */}
              <button
                onClick={launchBattleImmediately}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-sm sm:text-base tracking-widest uppercase shadow-[0_0_25px_rgba(234,179,8,0.4)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>START DUEL IMMEDIATELY &rarr;</span>
              </button>
            </div>
          ) : activeTab === 'wifi' ? (
            /* Wi-Fi Tab: Pass Code Controls */
            <div className="space-y-4">
              {/* Pass Code Quick Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. HOST WITH YOUR OWN PASS CODE */}
                <div className="p-4 rounded-2xl bg-black/60 border border-yellow-600/40 hover:border-yellow-400/80 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-black text-yellow-400 uppercase tracking-wide">
                          Host Wi-Fi Room
                        </h3>
                      </div>
                      <span className="text-[9px] font-bold text-yellow-300/60 uppercase">
                        Type Your Code
                      </span>
                    </div>

                    <p className="text-[11px] text-white/60">
                      Type your own custom pass code or generate one to share with your friend:
                    </p>

                    {/* Pass Code Input */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={hostPasscode}
                        onChange={(e) => setHostPasscode(e.target.value.toUpperCase())}
                        placeholder="e.g. DRAGON, 1234, MYPASS"
                        className="w-full px-3 py-2 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-mono font-black text-xs uppercase tracking-wider placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
                      />
                      <button
                        onClick={() => setHostPasscode(generateRandomPasscode())}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-yellow-400 transition-colors cursor-pointer shrink-0"
                        title="Randomize Code"
                      >
                        <Dices className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleHostRoom}
                    className="w-full py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>CREATE ROOM ({hostPasscode || 'AUTO'})</span>
                  </button>
                </div>

                {/* 2. JOIN BY TYPING HOST'S PASS CODE */}
                <div className="p-4 rounded-2xl bg-black/60 border border-amber-600/40 hover:border-amber-400/80 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                          <Zap className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-black text-amber-300 uppercase tracking-wide">
                          Join with Pass Code
                        </h3>
                      </div>
                      <span className="text-[9px] font-bold text-amber-300/60 uppercase">
                        Direct Connect
                      </span>
                    </div>

                    <p className="text-[11px] text-white/60">
                      Type the exact pass code of the other player to start the battle immediately:
                    </p>

                    {/* Join Pass Code Input */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={joinPasscode}
                        onChange={(e) => setJoinPasscode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && joinPasscode.trim()) {
                            handleJoinByPasscode(joinPasscode);
                          }
                        }}
                        placeholder="ENTER PASS CODE..."
                        className="w-full px-3 py-2 rounded-xl bg-black/90 border border-amber-500/40 text-yellow-300 font-mono font-black text-xs uppercase tracking-wider placeholder:text-white/30 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    disabled={!joinPasscode.trim() || isConnecting}
                    onClick={() => handleJoinByPasscode(joinPasscode)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>JOIN & START BATTLE &rarr;</span>
                  </button>
                </div>
              </div>

              {/* Host Active Status Panel */}
              {activeAction === 'host' && createdRoom && (
                <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/60 space-y-3 text-center animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-yellow-300/80 uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                      Active Room • Pass Code:
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-yellow-400 tracking-widest font-mono bg-black/90 px-4 py-1.5 rounded-xl border border-yellow-500/70 shadow-inner">
                        {createdRoom.id}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-yellow-300 transition-colors cursor-pointer"
                        title="Copy Pass Code"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-white/70">
                    Have player 2 type <strong className="text-yellow-400 font-mono">{createdRoom.id}</strong> in the Join box. Once they hit join, the battle will start automatically!
                  </p>

                  <div className="flex items-center justify-center gap-2 text-xs text-yellow-300/70">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                    <span>Waiting for challenger on Wi-Fi...</span>
                  </div>

                  {/* Open 2nd window option */}
                  <button
                    onClick={handleOpenSecondWindow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open 2nd Browser Tab (Test Side-by-Side)</span>
                  </button>
                </div>
              )}

              {/* Nearby Auto-Discovered Wi-Fi Rooms */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-white/60">
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-yellow-400" />
                    Nearby Active Wi-Fi Rooms ({discoveredRooms.length})
                  </span>
                  <button
                    onClick={() => multiplayerService.queryAvailableRooms()}
                    className="text-yellow-400 hover:underline flex items-center gap-1 text-[10px]"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {discoveredRooms.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-center text-[11px] text-white/40">
                    No open rooms detected on Wi-Fi yet. Enter your friend's pass code above or host your own room!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {discoveredRooms.map((room) => (
                      <div
                        key={room.id}
                        className="p-3 rounded-xl bg-black/60 border border-white/10 hover:border-yellow-500 flex items-center justify-between gap-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-yellow-400 truncate">{room.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono text-[9px] font-bold">
                              Code: {room.id}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/50 block">Host: {room.hostName}</span>
                        </div>
                        <button
                          onClick={() => handleJoinByPasscode(room.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[10px] uppercase tracking-wider transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          <span>JOIN & DUEL</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'bluetooth' ? (
            /* Bluetooth Tab */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/70 border border-blue-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-blue-400 shrink-0 ${isScanningBluetooth ? 'animate-pulse' : ''}`}>
                      <Bluetooth className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-blue-300 uppercase tracking-wider truncate">
                        Bluetooth Peer-to-Peer
                      </h4>
                      <p className="text-[10px] text-white/60 truncate">
                        Pair directly with nearby smartphones and tablets to start dueling.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleHostBluetoothBeacon}
                      className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/50 text-blue-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Radio className="w-3 h-3" />
                      <span>{isHostingBluetoothBeacon ? 'BEACON ACTIVE' : 'HOST BEACON'}</span>
                    </button>
                    <button
                      onClick={handleScanBluetooth}
                      disabled={isScanningBluetooth}
                      className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-black text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isScanningBluetooth ? 'animate-spin' : ''}`} />
                      <span>{isScanningBluetooth ? 'SCANNING...' : 'SCAN'}</span>
                    </button>
                  </div>
                </div>

                {/* Bluetooth Device List */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    Nearby Duelists ({bluetoothDevices.length})
                  </span>
                  <div className="space-y-1.5">
                    {bluetoothDevices.map((dev) => (
                      <div
                        key={dev.id}
                        className="p-3 rounded-xl bg-black/60 border border-white/10 hover:border-blue-400 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Smartphone className="w-4 h-4 text-blue-400" />
                          <div>
                            <span className="text-xs font-bold text-white block">{dev.name}</span>
                            <span className="text-[9px] text-emerald-400 font-medium flex items-center gap-1">
                              <Signal className="w-2.5 h-2.5" /> Signal: {dev.rssi} dBm (Strong)
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handlePairBluetooth(dev)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-black font-black text-[10px] uppercase tracking-wider shadow-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          <span>PAIR & DUEL</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Local Test Duel */
            <div className="p-4 rounded-2xl bg-black/70 border border-purple-500/40 space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/50 mx-auto flex items-center justify-center text-purple-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-purple-300 uppercase tracking-wider">
                Simulated 2-Player Test Environment
              </h3>
              <p className="text-xs text-white/70 max-w-md mx-auto">
                Spins up an opponent duel instance equipped with custom elemental cards and synchronizes art files, health, and clash swipes in real-time.
              </p>
              <button
                onClick={handleStartLocalTestMode}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
              >
                RUN LOCAL SIMULATION
              </button>
            </div>
          )}

          {/* Equipped Deck Preview Bar */}
          <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-white/60 font-medium">Your Deck to Synchronize:</span>
              <span className="text-yellow-400 font-bold">{equippedDeck.length} Cards</span>
            </div>
            <span className="text-[10px] text-yellow-200/50 uppercase tracking-widest font-mono">
              {equippedDeck.filter(c => c.image && (c.image.startsWith('data:') || c.image.startsWith('blob:'))).length} Custom Artwork
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-yellow-600/30 bg-black/80 flex items-center justify-between text-[10px] text-white/40">
          <span>Auto-starts duel on join • Auto-pauses on network disconnect</span>
          <span className="font-mono text-yellow-500/60">Live P2P v2.0</span>
        </div>
      </div>
    </div>
  );
};
