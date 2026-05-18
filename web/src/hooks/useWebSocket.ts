import { useEffect, useRef, useState } from 'react';
import type { WsMessage } from '../lib/contracts';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const MAX_BACKOFF = 10000;

export function useWebSocket(onMessage: (msg: WsMessage) => void): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let unmounted = false;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      if (unmounted) return;
      setStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setStatus('connected');
        backoffRef.current = 1000;
      };

      ws.onmessage = (ev) => {
        try {
          const raw = JSON.parse(ev.data);
          const msg: WsMessage = {
            topic: raw.topic,
            payload: raw.payload ?? raw.data,
          };
          onMessageRef.current(msg);
        } catch {}
      };

      ws.onclose = () => {
        if (unmounted) return;
        setStatus('disconnected');
        timer = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
          connect();
        }, backoffRef.current);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, []);

  return status;
}
