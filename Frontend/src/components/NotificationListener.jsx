import { useContext, useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { HUB_URL } from '../utils/api';

/**
 * Keeps a SignalR connection open while the user is logged in and shows
 * real-time notifications (booking accepted/declined, new messages) as toasts.
 * The server puts each connection in the logged-in user's own group, based on the JWT.
 */
export default function NotificationListener() {
  const { token } = useContext(AuthContext);

  useEffect(() => {
    if (!token) return undefined;

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (n) => {
      toast.success(`${n?.title ?? 'Update'}: ${n?.message ?? ''}`, { duration: 6000 });
    });
    connection.on('ReceiveMessage', (m) => {
      toast(`New message: ${m?.content ?? ''}`, { icon: '💬', duration: 5000 });
    });

    let cancelled = false;
    connection.start().catch((err) => {
      if (!cancelled) console.warn('Real-time connection failed:', err?.message ?? err);
    });

    return () => {
      cancelled = true;
      connection.stop();
    };
  }, [token]);

  return null;
}
