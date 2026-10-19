import {
  MultiplayerMode,
  ConnectionType,
  MultiplayerRole,
  MultiplayerRoom,
  SyncedDeckPayload,
  BluetoothDeviceOption,
} from '../types/multiplayer';

export type MultiplayerEventHandler = (event: {
  type: string;
  data?: any;
}) => void;

class MultiplayerService {
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private currentRoom: MultiplayerRoom | null = null;
  private role: MultiplayerRole = 'host';
  private eventHandlers: Set<MultiplayerEventHandler> = new Set();
  private isConnected = false;
  private heartbeatInterval: any = null;
  private isConnectingWs = false;

  constructor() {
    this.initBroadcastChannel();
    this.initWebSocket();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('battle_swipes_multiplayer_bus');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingRawMessage(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization error:', err);
      }
    }
  }

  public initWebSocket(onOpenCallback?: () => void) {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN && onOpenCallback) {
        onOpenCallback();
      }
      return;
    }

    try {
      this.isConnectingWs = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/multiplayer-ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnectingWs = false;
        if (onOpenCallback) onOpenCallback();
        // Request open rooms on connect
        this.queryAvailableRooms();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.handleIncomingRawMessage(parsed);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnectingWs = false;
        // Schedule auto-reconnect if needed
        setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.initWebSocket();
          }
        }, 3000);
      };

      this.ws.onerror = (err) => {
        this.isConnectingWs = false;
        console.warn('Multiplayer WebSocket notice (using fallback relay if needed):', err);
      };
    } catch (err) {
      this.isConnectingWs = false;
      console.warn('WebSocket connection init notice:', err);
    }
  }

  public subscribe(handler: MultiplayerEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private emit(type: string, data?: any) {
    this.eventHandlers.forEach((handler) => {
      try {
        handler({ type, data });
      } catch (e) {
        console.error('Multiplayer event handler error:', e);
      }
    });
  }

  private sendMessage(msg: any) {
    const payload = {
      ...msg,
      roomId: msg.roomId || this.currentRoom?.id,
      senderRole: this.role,
      timestamp: Date.now(),
    };

    // Send across BroadcastChannel (local tabs / test mode)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn('BroadcastChannel send error:', e);
      }
    }

    // Send across WebSocket (cross-device Wi-Fi/Internet)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        console.warn('WebSocket send error:', e);
      }
    } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      // Try to re-establish and send
      this.initWebSocket(() => {
        try {
          this.ws?.send(JSON.stringify(payload));
        } catch (e) {}
      });
    }
  }

  private handleIncomingRawMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    // Filter messages for other rooms (unless discovery/queries)
    const isGlobalQuery = msg.type === 'query_rooms' || msg.type === 'rooms_list' || msg.type === 'room_advertisement' || msg.type === 'bluetooth_devices_list';
    if (!isGlobalQuery && this.currentRoom && msg.roomId && msg.roomId !== this.currentRoom.id) {
      return;
    }
    // Ignore messages sent by ourselves
    if (msg.senderRole && msg.senderRole === this.role && !isGlobalQuery) {
      return;
    }

    switch (msg.type) {
      case 'rooms_list':
        this.emit('rooms_list_updated', msg.rooms || []);
        break;

      case 'query_rooms':
        if (this.role === 'host' && this.currentRoom && this.currentRoom.status === 'waiting') {
          this.broadcastRoomAd();
        }
        break;

      case 'room_advertisement':
        this.emit('room_discovered', msg.room);
        break;

      case 'room_created':
        if (msg.room) {
          this.currentRoom = msg.room;
          this.emit('room_created', msg.room);
        }
        break;

      case 'create_room_error':
        this.emit('create_room_error', { message: msg.message });
        break;

      case 'join_request':
        if (this.role === 'host' && this.currentRoom && (msg.roomId === this.currentRoom.id || msg.passCode === this.currentRoom.id)) {
          this.isConnected = true;
          this.emit('opponent_joined', {
            duelistName: msg.duelistName,
            avatarUrl: msg.avatarUrl,
            roomId: this.currentRoom.id,
          });
          this.sendMessage({
            type: 'join_accepted',
            room: this.currentRoom,
            hostName: this.currentRoom.hostName,
            hostAvatar: this.currentRoom.hostAvatar,
          });
        }
        break;

      case 'opponent_joined':
        this.isConnected = true;
        this.emit('opponent_joined', {
          duelistName: msg.duelistName,
          avatarUrl: msg.avatarUrl,
          roomId: msg.roomId,
        });
        break;

      case 'join_accepted':
        this.isConnected = true;
        if (msg.room) {
          this.currentRoom = msg.room;
        }
        this.emit('connected_to_host', {
          room: msg.room || this.currentRoom,
          hostName: msg.hostName || msg.duelistName || 'Host Duelist',
          hostAvatar: msg.hostAvatar || msg.avatarUrl,
        });
        break;

      case 'connected_to_host':
        this.isConnected = true;
        if (msg.room) {
          this.currentRoom = msg.room;
        }
        this.emit('connected_to_host', {
          room: msg.room || this.currentRoom,
          hostName: msg.hostName || msg.duelistName || 'Host Duelist',
          hostAvatar: msg.hostAvatar || msg.avatarUrl,
        });
        break;

      case 'join_error':
        this.emit('join_error', { message: msg.message, code: msg.code });
        break;

      case 'deck_sync':
      case 'deck_sync_received':
        this.emit('deck_sync_received', msg.payload);
        this.sendMessage({ type: 'deck_sync_ack' });
        break;

      case 'deck_sync_ack':
      case 'deck_sync_completed':
        this.emit('deck_sync_completed');
        break;

      case 'ready_to_duel':
        this.emit('opponent_ready');
        break;

      case 'start_battle':
      case 'battle_started':
        this.emit('battle_started', { isTournament: Boolean(msg.isTournament) });
        break;

      case 'card_played':
      case 'card_played_by_opponent':
        this.emit('card_played_by_opponent', {
          cardId: msg.cardId,
          card: msg.card,
          roundId: msg.roundId,
          duelistName: msg.duelistName,
        });
        break;

      case 'swipe_score':
      case 'swipe_score_received':
        this.emit('swipe_score_received', {
          score: msg.score,
          roundId: msg.roundId,
        });
        break;

      case 'sync_hp':
      case 'sync_hp_received':
        this.emit('sync_hp_received', {
          playerHP: msg.playerHP,
          opponentHP: msg.opponentHP,
          roundId: msg.roundId,
        });
        break;

      case 'pause':
      case 'match_paused':
        this.emit('match_paused', { reason: msg.reason });
        break;

      case 'resume':
      case 'match_resumed':
        this.emit('match_resumed');
        break;

      case 'disconnect':
      case 'opponent_disconnected':
        this.isConnected = false;
        this.emit('opponent_disconnected', { reason: msg.reason });
        break;

      case 'bluetooth_devices_list':
        this.emit('bluetooth_devices_updated', msg.devices || []);
        break;

      default:
        this.emit(msg.type, msg);
        break;
    }
  }

  public createRoom(
    mode: MultiplayerMode,
    connectionType: ConnectionType,
    hostName: string,
    hostAvatar?: string,
    customPasscode?: string
  ): MultiplayerRoom {
    // Sanitize custom passcode or generate a clean memorable code
    let cleanCode = (customPasscode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      const prefix = mode === 'arena' ? 'ARENA' : 'TOURNEY';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      cleanCode = `${prefix}-${randomSuffix}`;
    }

    const roomId = cleanCode;
    this.role = 'host';
    this.isConnected = false;

    this.currentRoom = {
      id: roomId,
      name: `${hostName}'s ${mode === 'arena' ? 'Arena Duel' : 'Tournament'}`,
      hostName,
      hostAvatar,
      mode,
      connectionType,
      playerCount: 1,
      createdAt: Date.now(),
      status: 'waiting',
    };

    // Make sure WS is ready and notify server
    this.initWebSocket(() => {
      this.sendMessage({
        type: 'create_room',
        roomId,
        passCode: roomId,
        name: this.currentRoom?.name,
        hostName,
        hostAvatar,
        mode,
        connectionType,
      });
    });

    // Also send immediately if socket is already open
    this.sendMessage({
      type: 'create_room',
      roomId,
      passCode: roomId,
      name: this.currentRoom.name,
      hostName,
      hostAvatar,
      mode,
      connectionType,
    });

    // Start advertising room
    this.startAdvertising();
    return this.currentRoom;
  }

  public joinRoom(
    passCodeOrId: string,
    mode: MultiplayerMode,
    connectionType: ConnectionType,
    guestName: string,
    guestAvatar?: string
  ) {
    const cleanCode = passCodeOrId.trim().toUpperCase();
    this.role = 'guest';
    this.isConnected = false;
    this.currentRoom = {
      id: cleanCode,
      name: `${guestName} Room`,
      hostName: 'Host',
      mode,
      connectionType,
      playerCount: 2,
      createdAt: Date.now(),
      status: 'syncing',
    };

    const sendJoin = () => {
      this.sendMessage({
        type: 'join_request',
        roomId: cleanCode,
        passCode: cleanCode,
        duelistName: guestName,
        avatarUrl: guestAvatar,
      });
    };

    this.initWebSocket(sendJoin);
    sendJoin();
  }

  public startBattle(isTournament: boolean) {
    this.sendMessage({
      type: 'start_battle',
      isTournament,
    });
  }

  private startAdvertising() {
    this.stopAdvertising();
    this.broadcastRoomAd();
    this.heartbeatInterval = setInterval(() => {
      this.broadcastRoomAd();
    }, 2000);
  }

  private broadcastRoomAd() {
    if (this.currentRoom && this.role === 'host' && this.currentRoom.status === 'waiting') {
      this.sendMessage({
        type: 'room_advertisement',
        room: this.currentRoom,
      });
    }
  }

  private stopAdvertising() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public queryAvailableRooms() {
    this.sendMessage({ type: 'query_rooms' });
  }

  public sendDeckSync(payload: SyncedDeckPayload) {
    this.sendMessage({
      type: 'deck_sync',
      payload,
    });
  }

  public sendReadyToDuel() {
    this.sendMessage({ type: 'ready_to_duel' });
  }

  public sendCardPlayed(cardId: string, roundId: number, duelistName: string, card?: any) {
    this.sendMessage({
      type: 'card_played',
      cardId,
      roundId,
      duelistName,
      card,
    });
  }

  public sendSwipeScore(score: number, roundId: number) {
    this.sendMessage({
      type: 'swipe_score',
      score,
      roundId,
    });
  }

  public sendSyncHP(playerHP: number, opponentHP: number, roundId: number) {
    this.sendMessage({
      type: 'sync_hp',
      playerHP,
      opponentHP,
      roundId,
    });
  }

  public sendPause(reason = 'Connection interrupted') {
    this.sendMessage({ type: 'pause', reason });
  }

  public sendResume() {
    this.sendMessage({ type: 'resume' });
  }

  // Bluetooth specific methods
  public registerBluetoothBeacon(deviceName: string, duelistName: string, avatar?: string, mode: MultiplayerMode = 'arena') {
    this.sendMessage({
      type: 'register_bluetooth_beacon',
      deviceName,
      duelistName,
      avatar,
      mode,
    });
  }

  public queryBluetoothBeacons() {
    this.sendMessage({
      type: 'query_bluetooth_beacons',
    });
  }

  public leaveRoom() {
    this.sendMessage({ type: 'disconnect' });
    this.stopAdvertising();
    this.currentRoom = null;
    this.isConnected = false;
  }

  public disconnect() {
    this.leaveRoom();
  }

  public getRole(): MultiplayerRole {
    return this.role;
  }

  public getCurrentRoom(): MultiplayerRoom | null {
    return this.currentRoom;
  }

  public isRoomConnected(): boolean {
    return this.isConnected;
  }
}

export const multiplayerService = new MultiplayerService();
