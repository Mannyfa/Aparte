import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import toast from 'react-hot-toast';
import api, { errorMessage, HUB_URL } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Loader } from '../components/ui';
import { initials } from '../utils/format';

const MAX = 2000;
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

export default function Conversation() {
  const { userId } = useParams();
  const { token, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login', { state: { from: `/messages/${userId}` } }); return undefined; }
    let cancelled = false;
    setLoading(true);
    api.get(`/messages/with/${userId}`)
      .then((res) => {
        if (cancelled) return;
        setOther(res.data?.user ?? null);
        setMessages(res.data?.messages ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(errorMessage(e, "Couldn't load this conversation."), { id: 'conv-error' });
        navigate('/messages');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, isAuthenticated, navigate]);

  useEffect(() => {
    if (!token) return undefined;
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('ReceiveMessage', (m) => {
      const senderId = m?.senderId ?? m?.SenderId;
      if (!senderId || String(senderId).toLowerCase() !== String(userId).toLowerCase()) return;
      const incoming = {
        id: m.id ?? m.Id ?? `live-${Date.now()}`,
        content: m.content ?? m.Content ?? '',
        timestamp: m.timestamp ?? m.Timestamp ?? new Date().toISOString(),
        isMine: false,
        isRead: true,
      };
      setMessages((prev) => (prev.some((x) => x.id === incoming.id) ? prev : [...prev, incoming]));
    });
    let cancelled = false;
    connection.start().catch((err) => {
      if (!cancelled) console.warn('Real-time connection failed:', err?.message ?? err);
    });
    return () => { cancelled = true; connection.stop(); };
  }, [token, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await api.post('/messages', { receiverId: userId, content });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, content, timestamp: new Date().toISOString(), isMine: true, isRead: false },
      ]);
      setText('');
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't send your message."));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="page flex max-w-2xl flex-col pb-4 pt-4" style={{ height: 'calc(100dvh - 4rem)' }}>
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <Link to="/messages" className="btn-ghost btn-sm -ml-2" aria-label="Back to messages"><ArrowLeft size={16} /></Link>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime font-mono text-xs text-ink">
          {initials(other?.name)}
        </span>
        <h1 className="truncate text-base font-medium">{other?.name ?? 'Conversation'}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-4">
        {loading ? (
          <Loader label="Loading messages" className="py-12" />
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.isMine ? 'rounded-br-md bg-ink text-cream' : 'rounded-bl-md border border-line bg-paper text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`mt-1 text-right font-mono text-[10px] ${m.isMine ? 'text-cream/60' : 'text-faint'}`}>{timeOf(m.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-line pt-3 pb-safe">
        <textarea
          rows={1}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="input max-h-32 min-h-[2.75rem] flex-1 resize-none"
          placeholder="Write a message…"
          aria-label="Message"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="btn-ink h-11 shrink-0" aria-label="Send message">
          <Send size={16} />
        </button>
      </div>
      {text.length > MAX - 200 && <p className="hint text-right">{text.length}/{MAX}</p>}
    </div>
  );
}
