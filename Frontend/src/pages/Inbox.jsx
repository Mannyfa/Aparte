import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import toast from 'react-hot-toast';
import api, { errorMessage, HUB_URL } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { EmptyState } from '../components/ui';
import { ListSkeleton } from '../components/Skeletons';
import { initials } from '../utils/format';

const relativeTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Inbox() {
  const { token, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/messages/inbox');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(errorMessage(e, 'Failed to load your messages.'), { id: 'inbox-error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login', { state: { from: '/messages' } }); return; }
    load();
  }, [isAuthenticated, navigate, load]);

  useEffect(() => {
    if (!token) return undefined;
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('ReceiveMessage', () => { load(); });
    let cancelled = false;
    connection.start().catch((err) => {
      if (!cancelled) console.warn('Real-time connection failed:', err?.message ?? err);
    });
    return () => { cancelled = true; connection.stop(); };
  }, [token, load]);

  if (!isAuthenticated) return null;

  return (
    <div className="page max-w-2xl pb-24 pt-8">
      <p className="eyebrow mb-3">Messages</p>
      <h1 className="mb-6 text-3xl font-light tracking-[-0.03em]">Your conversations</h1>

      {loading ? (
        <ListSkeleton rows={4} label="Loading messages" />
      ) : items.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No messages yet">
          When you message a host, or a guest messages you, the conversation will show up here.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((c) => (
            <li key={c.userId}>
              <Link to={`/messages/${c.userId}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-sand/50">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime font-mono text-xs text-ink">
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-sm ${c.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>{c.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">{relativeTime(c.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-3">
                    <p className={`truncate text-[13px] ${c.unreadCount > 0 ? 'text-ink' : 'text-muted'}`}>
                      {c.lastMessage ? `${c.lastIsMine ? 'You: ' : ''}${c.lastMessage}` : 'No messages yet'}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="grid h-5 min-w-[1.25rem] shrink-0 place-items-center rounded-full bg-lime px-1.5 font-mono text-[11px] text-ink">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
