import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer, WebSocket } from 'ws';

function multiplayerWsPlugin() {
  return {
    name: 'multiplayer-relay',
    configureServer(server: any) {
      if (!server.httpServer) return;
      const wss = new WebSocketServer({ noServer: true });
      const rooms = new Map<string, Set<WebSocket>>();

      server.httpServer.on('upgrade', (req: any, socket: any, head: any) => {
        if (req.url && req.url.startsWith('/api/multiplayer-ws')) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws) => {
        let currentRoomId: string | null = null;

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'join_room' && msg.roomId) {
              currentRoomId = msg.roomId;
              if (!rooms.has(currentRoomId)) {
                rooms.set(currentRoomId, new Set());
              }
              rooms.get(currentRoomId)!.add(ws);
            } else if (currentRoomId && rooms.has(currentRoomId)) {
              const clients = rooms.get(currentRoomId)!;
              for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(data.toString());
                }
              }
            }
          } catch (e) {}
        });

        ws.on('close', () => {
          if (currentRoomId && rooms.has(currentRoomId)) {
            const clients = rooms.get(currentRoomId)!;
            clients.delete(ws);
            if (clients.size === 0) {
              rooms.delete(currentRoomId);
            } else {
              for (const client of clients) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ type: 'opponent_disconnected', roomId: currentRoomId }));
                }
              }
            }
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), multiplayerWsPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
