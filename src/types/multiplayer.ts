import { Card, Element, Rarity } from '../../types';

export type MultiplayerMode = 'arena' | 'tournament';
export type ConnectionType = 'wifi' | 'bluetooth' | 'test';
export type MultiplayerRole = 'host' | 'guest';

export interface SyncedCardData {
  id: string;
  name: string;
  element: Element;
  type: string;
  attack: number;
  defense: number;
  image: string; // Base64 or image URL
  description: string;
  rarity?: Rarity;
  isHero?: boolean;
  heroStatus?: string;
  isCustom?: boolean;
}

export interface SyncedDeckPayload {
  duelistName: string;
  avatarUrl?: string;
  deck: SyncedCardData[];
  equippedDeckName?: string;
  runesCount?: number;
  ready: boolean;
}

export interface MultiplayerRoom {
  id: string;
  name: string;
  hostName: string;
  hostAvatar?: string;
  mode: MultiplayerMode;
  connectionType: ConnectionType;
  playerCount: number;
  createdAt: number;
  status: 'waiting' | 'syncing' | 'playing' | 'paused';
}

export interface BluetoothDeviceOption {
  id: string;
  name: string;
  rssi: number; // Signal strength in dBm (-30 to -90)
  paired: boolean;
  nativeDevice?: any;
}

export type MultiplayerActionMessage =
  | { type: 'join_room'; roomId: string; role: MultiplayerRole; duelistName: string; avatarUrl?: string }
  | { type: 'deck_sync'; payload: SyncedDeckPayload }
  | { type: 'deck_sync_ack' }
  | { type: 'ready_to_duel' }
  | { type: 'start_battle'; isTournament?: boolean }
  | { type: 'battle_started'; isTournament?: boolean }
  | { type: 'card_played'; cardId: string; roundId: number; duelistName: string; card?: any }
  | { type: 'swipe_score'; score: number; roundId: number }
  | { type: 'swipe_result'; winner: 'player' | 'computer' | 'tie'; damage: number; roundId: number }
  | { type: 'sync_hp'; playerHP: number; opponentHP: number; roundId: number }
  | { type: 'pause'; reason?: string }
  | { type: 'resume' }
  | { type: 'disconnect' }
  | { type: 'surrender' }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number };
