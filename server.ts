import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface RoomData {
  id: string;
  name: string;
  hostName: string;
  hostAvatar?: string;
  mode: 'arena' | 'tournament';
  connectionType: 'wifi' | 'bluetooth' | 'test';
  playerCount: number;
  createdAt: number;
  status: 'waiting' | 'syncing' | 'playing' | 'paused';
  hostWs?: WebSocket;
  guestWs?: WebSocket;
}

interface BluetoothBeacon {
  id: string;
  name: string;
  avatar?: string;
  duelistName: string;
  mode: 'arena' | 'tournament';
  rssi: number;
  lastSeen: number;
  ws: WebSocket;
}

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/multiplayer-ws' });

// In-memory room store
const rooms = new Map<string, RoomData>();
const bluetoothBeacons = new Map<string, BluetoothBeacon>();

app.use(express.json({ limit: '15mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    roomsCount: rooms.size,
    beaconsCount: bluetoothBeacons.size,
    connections: wss.clients.size,
    timestamp: Date.now(),
  });
});

// Rooms listing endpoint
app.get('/api/rooms', (req, res) => {
  const waitingRooms = Array.from(rooms.values())
    .filter((r) => r.status === 'waiting')
    .map(({ hostWs, guestWs, ...safeRoom }) => safeRoom);
  res.json(waitingRooms);
});

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  let boundRoomId: string | null = null;
  let boundRole: 'host' | 'guest' | null = null;
  let boundBeaconId: string | null = null;

  const sendTo = (targetWs: WebSocket | undefined, payload: any) => {
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      try {
        targetWs.send(JSON.stringify(payload));
      } catch (err) {
        console.warn('WebSocket send error:', err);
      }
    }
  };

  const broadcastWaitingRooms = () => {
    const list = Array.from(rooms.values())
      .filter((r) => r.status === 'waiting')
      .map(({ hostWs, guestWs, ...safeRoom }) => safeRoom);

    const msg = JSON.stringify({ type: 'rooms_list', rooms: list });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(msg);
        } catch (e) {}
      }
    });
  };

  const broadcastBeacons = () => {
    const now = Date.now();
    const activeBeacons: any[] = [];
    bluetoothBeacons.forEach((beacon, id) => {
      if (now - beacon.lastSeen < 60000 && beacon.ws.readyState === WebSocket.OPEN) {
        activeBeacons.push({
          id: beacon.id,
          name: beacon.name,
          avatar: beacon.avatar,
          duelistName: beacon.duelistName,
          mode: beacon.mode,
          rssi: beacon.rssi,
          paired: false,
        });
      } else {
        bluetoothBeacons.delete(id);
      }
    });

    const msg = JSON.stringify({ type: 'bluetooth_devices_list', devices: activeBeacons });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(msg);
        } catch (e) {}
      }
    });
  };

  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'ping':
          sendTo(ws, { type: 'pong', timestamp: Date.now() });
          break;

        case 'query_rooms': {
          const list = Array.from(rooms.values())
            .filter((r) => r.status === 'waiting')
            .map(({ hostWs, guestWs, ...safeRoom }) => safeRoom);
          sendTo(ws, { type: 'rooms_list', rooms: list });
          break;
        }

        case 'create_room': {
          const rawId = (msg.roomId || msg.passCode || '').toString().trim().toUpperCase();
          const roomId = rawId || `ARENA-${Math.floor(1000 + Math.random() * 9000)}`;

          // If room exists and old host disconnected, cleanup old room
          const existing = rooms.get(roomId);
          if (existing && existing.hostWs && existing.hostWs !== ws && existing.hostWs.readyState === WebSocket.OPEN) {
            // Room is active with another host
            sendTo(ws, {
              type: 'create_room_error',
              message: `Room with pass code "${roomId}" is already hosted by another duelist. Please pick a different pass code.`,
            });
            return;
          }

          const room: RoomData = {
            id: roomId,
            name: msg.name || `${msg.hostName || 'Duelist'}'s Arena`,
            hostName: msg.hostName || 'Host Duelist',
            hostAvatar: msg.hostAvatar,
            mode: msg.mode || 'arena',
            connectionType: msg.connectionType || 'wifi',
            playerCount: 1,
            createdAt: Date.now(),
            status: 'waiting',
            hostWs: ws,
          };

          rooms.set(roomId, room);
          boundRoomId = roomId;
          boundRole = 'host';

          const { hostWs, guestWs, ...safeRoom } = room;
          sendTo(ws, { type: 'room_created', room: safeRoom });

          // Broadcast new room to all waiting query clients
          broadcastWaitingRooms();
          break;
        }

        case 'join_request': {
          const searchCode = (msg.roomId || msg.passCode || '').toString().trim().toUpperCase();
          const room = rooms.get(searchCode);

          if (!room) {
            sendTo(ws, {
              type: 'join_error',
              message: `No active room found with pass code "${searchCode}". Make sure the host has created the room first.`,
              code: searchCode,
            });
            return;
          }

          if (room.status === 'playing') {
            sendTo(ws, {
              type: 'join_error',
              message: `Room "${searchCode}" is already in an active battle.`,
              code: searchCode,
            });
            return;
          }

          // Register guest
          room.guestWs = ws;
          room.playerCount = 2;
          room.status = 'syncing';
          boundRoomId = room.id;
          boundRole = 'guest';

          const { hostWs, guestWs, ...safeRoom } = room;

          // Notify host that guest connected
          sendTo(room.hostWs, {
            type: 'opponent_joined',
            duelistName: msg.duelistName || 'Challenger',
            avatarUrl: msg.avatarUrl,
            roomId: room.id,
            room: safeRoom,
          });

          // Confirm to guest that connection succeeded
          sendTo(ws, {
            type: 'connected_to_host',
            duelistName: room.hostName,
            avatarUrl: room.hostAvatar,
            roomId: room.id,
            room: safeRoom,
          });

          // Update room list
          broadcastWaitingRooms();
          break;
        }

        case 'deck_sync': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'deck_sync_received',
              payload: msg.payload,
              senderRole: boundRole,
            });
          }
          break;
        }

        case 'deck_sync_ack': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'deck_sync_completed',
              senderRole: boundRole,
            });
          }
          break;
        }

        case 'start_battle': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            room.status = 'playing';
            // Broadcast start_battle to BOTH host and guest simultaneously
            const payload = {
              type: 'battle_started',
              isTournament: Boolean(msg.isTournament || room.mode === 'tournament'),
            };
            sendTo(room.hostWs, payload);
            sendTo(room.guestWs, payload);
          }
          break;
        }

        case 'card_played': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'card_played_by_opponent',
              cardId: msg.cardId,
              card: msg.card,
              roundId: msg.roundId,
              duelistName: msg.duelistName,
            });
          }
          break;
        }

        case 'swipe_score': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'swipe_score_received',
              score: msg.score,
              roundId: msg.roundId,
            });
          }
          break;
        }

        case 'sync_hp': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'sync_hp_received',
              playerHP: msg.playerHP,
              opponentHP: msg.opponentHP,
              roundId: msg.roundId,
            });
          }
          break;
        }

        case 'pause': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'match_paused',
              reason: msg.reason || 'Opponent paused or connection unstable',
            });
          }
          break;
        }

        case 'resume': {
          const room = boundRoomId ? rooms.get(boundRoomId) : null;
          if (room) {
            const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
            sendTo(targetWs, {
              type: 'match_resumed',
            });
          }
          break;
        }

        // Bluetooth Beacon Protocol
        case 'register_bluetooth_beacon': {
          const beaconId = `bt-${(msg.duelistName || 'player').toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
          boundBeaconId = beaconId;
          bluetoothBeacons.set(beaconId, {
            id: beaconId,
            name: msg.deviceName || `${msg.duelistName || 'Duelist'}'s Device`,
            duelistName: msg.duelistName || 'Duelist',
            avatar: msg.avatar,
            mode: msg.mode || 'arena',
            rssi: Math.floor(-45 - Math.random() * 20),
            lastSeen: Date.now(),
            ws,
          });

          sendTo(ws, { type: 'bluetooth_beacon_registered', beaconId });
          broadcastBeacons();
          break;
        }

        case 'query_bluetooth_beacons': {
          broadcastBeacons();
          break;
        }

        case 'disconnect':
        case 'leave_room': {
          if (boundRoomId) {
            const room = rooms.get(boundRoomId);
            if (room) {
              const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
              sendTo(targetWs, {
                type: 'opponent_disconnected',
                reason: 'Challenger left the lobby',
              });
              rooms.delete(boundRoomId);
              broadcastWaitingRooms();
            }
            boundRoomId = null;
          }
          break;
        }
      }
    } catch (e) {
      console.error('WebSocket message processing error:', e);
    }
  });

  ws.on('close', () => {
    if (boundBeaconId) {
      bluetoothBeacons.delete(boundBeaconId);
      broadcastBeacons();
    }

    if (boundRoomId) {
      const room = rooms.get(boundRoomId);
      if (room) {
        const targetWs = ws === room.hostWs ? room.guestWs : room.hostWs;
        sendTo(targetWs, {
          type: 'opponent_disconnected',
          reason: 'Challenger disconnected from the network',
        });
        rooms.delete(boundRoomId);
        broadcastWaitingRooms();
      }
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Elemental Duel Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
