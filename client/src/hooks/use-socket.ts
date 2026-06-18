import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Same resolution order as queryClient.ts so the socket connects to the SAME
// backend the API talks to. In local dev the API goes DIRECT to
// http://localhost:3001 (not through the Vite proxy), so the socket must too —
// connecting to the page origin (5173) and relying on the /socket.io proxy was
// silently failing, which is why no `new_message` events ever arrived and the
// inbox fell back to slow polling. Empty base = production/same-origin.
const BACKEND_URL = (
  (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).replace(/\/$/, '');

export const useSocket = (workspaceId: string | number | bigint | undefined) => {
  // useState (not useRef) so the component re-renders the moment the socket
  // instance exists — otherwise the listener-registration effect in
  // ConversationsInbox can run while `socket` is still null and never re-attach.
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    // Default transports (polling -> websocket upgrade) for reliability behind
    // proxies / self-signed HTTPS. Connect to the backend origin directly when
    // BACKEND_URL is set; fall back to same-origin when empty.
    const s = BACKEND_URL ? io(BACKEND_URL) : io();

    s.on('connect', () => {
      console.log('Socket connected:', s.id, '->', BACKEND_URL || '(same-origin)');
      s.emit('joinWorkspace', workspaceId.toString());
    });

    s.on('connect_error', (error) => {
      console.error('Socket connection error:', error?.message || error);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [workspaceId]);

  return socket;
};
