import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { CalendarDays, Copy, Link2, RefreshCw, Trash2, Lock, Plus, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../utils/api';
import { invalidate } from '../utils/cache';
import { EmptyState, StatusBadge } from './ui';
import { Bone } from './Skeletons';
import { formatDateTime } from '../utils/format';

/** API dates are UTC calendar days ("2026-12-10T00:00:00Z"): read the day part as a local date. */
const day = (iso) => parseISO(String(iso).slice(0, 10));
const nightsOf = (start, end) => {
  const out = [];
  for (let d = day(start); d < day(end); d = addDays(d, 1)) out.push(d);
  return out;
};
const range = (start, end) => `${format(day(start), 'd MMM')} → ${format(day(end), 'd MMM yyyy')}`;

const FEED_SOURCES = ['Airbnb', 'Booking.com', 'VRBO', 'Other'];

export default function HostCalendar({ initialPropertyId }) {
  const [properties, setProperties] = useState(null);
  const [propertyId, setPropertyId] = useState(initialPropertyId || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Range being selected to block (nights, inclusive)
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [note, setNote] = useState('');

  const [feedForm, setFeedForm] = useState({ name: 'Airbnb', url: '' });

  useEffect(() => {
    api.get('/Properties/host')
      .then((res) => {
        setProperties(res.data);
        setPropertyId((current) => current || res.data[0]?.id || null);
      })
      .catch((error) => { toast.error(errorMessage(error, "Couldn't load your listings.")); setProperties([]); });
  }, []);

  const load = async (id = propertyId) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/Calendar/property/${id}`);
      setData(res.data);
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't load the calendar."));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (propertyId) load(propertyId); }, [propertyId]);

  const { bookedNights, hostNights, feedNights } = useMemo(() => {
    const b = [], h = [], f = [];
    for (const x of data?.bookings ?? []) b.push(...nightsOf(x.start, x.end));
    for (const x of data?.blocks ?? []) (x.source === 'feed' ? f : h).push(...nightsOf(x.start, x.end));
    return { bookedNights: b, hostNights: h, feedNights: f };
  }, [data]);

  const afterChange = () => { invalidate('/Properties'); load(); };

  const blockSelected = async () => {
    if (!selStart) return;
    const lastNight = selEnd || selStart;
    setBusy(true);
    try {
      const res = await api.post(`/Calendar/property/${propertyId}/blocks`, {
        startDate: format(selStart, 'yyyy-MM-dd'),
        endDate: format(addDays(lastNight, 1), 'yyyy-MM-dd'),
        note: note.trim() || null,
      });
      toast.success(res.data?.message || 'Dates blocked.');
      setSelStart(null); setSelEnd(null); setNote('');
      afterChange();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't block those dates."));
    } finally {
      setBusy(false);
    }
  };

  const unblock = async (block) => {
    try {
      await api.delete(`/Calendar/blocks/${block.id}`);
      toast.success('Dates unblocked.');
      afterChange();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't unblock those dates."));
    }
  };

  const addFeed = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/Calendar/property/${propertyId}/feeds`, feedForm);
      (res.data?.synced ? toast.success : toast.error)(res.data?.message || 'Calendar connected.');
      setFeedForm({ name: 'Airbnb', url: '' });
      afterChange();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't connect that calendar."));
    } finally {
      setBusy(false);
    }
  };

  const syncFeed = async (feed) => {
    setBusy(true);
    try {
      const res = await api.post(`/Calendar/feeds/${feed.id}/sync`);
      toast.success(res.data?.message || 'Synced.');
    } catch (error) {
      toast.error(errorMessage(error, 'Sync failed.'));
    } finally {
      setBusy(false);
      afterChange();
    }
  };

  const removeFeed = async (feed) => {
    if (!window.confirm(`Disconnect ${feed.name}? Dates imported from it will open up on Apartey.`)) return;
    try {
      const res = await api.delete(`/Calendar/feeds/${feed.id}`);
      toast.success(res.data?.message || 'Disconnected.');
      afterChange();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't disconnect that calendar."));
    }
  };

  const copyExport = async () => {
    try { await navigator.clipboard.writeText(data.exportUrl); toast.success('Link copied'); }
    catch { toast.error('Copy failed. Select the link and copy it manually.'); }
  };

  const resetExport = async () => {
    if (!window.confirm('Create a new export link? The current one stops working, so you’ll need to paste the new link into Airbnb / Booking.com again.')) return;
    try {
      const res = await api.post(`/Calendar/property/${propertyId}/export-link/reset`);
      setData((d) => ({ ...d, exportUrl: res.data.exportUrl }));
      toast.success(res.data?.message || 'New link created.');
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create a new link."));
    }
  };

  const nightsSelected = selStart ? differenceInCalendarDays(selEnd || selStart, selStart) + 1 : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3">Calendar</p>
          <h1 className="text-3xl font-light tracking-[-0.035em] md:text-4xl">Availability & sync</h1>
          <p className="mt-2 text-sm text-muted">Block dates you're not available, and keep Airbnb or Booking.com in sync so nobody double-books.</p>
        </div>
        {properties?.length > 0 && (
          <select value={propertyId || ''} onChange={(e) => { setPropertyId(e.target.value); setSelStart(null); setSelEnd(null); }} className="input w-full sm:w-64">
            {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
      </div>

      {properties === null || (loading && !data) ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]" aria-hidden="true">
          <Bone className="h-80 w-full rounded-2xl" /><Bone className="h-80 w-full rounded-2xl" />
        </div>
      ) : properties.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No listings yet">Create a listing first, then manage its calendar here.</EmptyState>
      ) : data && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            {/* Month view */}
            <div className="card card-pad overflow-x-auto">
              <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink" /> Booked</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-300" /> Blocked by you</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sky-300" /> From other sites</span>
              </div>
              <div className="host-calendar">
                <DatePicker
                  inline
                  monthsShown={2}
                  selectsRange
                  startDate={selStart}
                  endDate={selEnd}
                  onChange={([s, e]) => { setSelStart(s); setSelEnd(e); }}
                  minDate={new Date()}
                  excludeDates={bookedNights}
                  highlightDates={[
                    { 'hc-booked': bookedNights },
                    { 'hc-host': hostNights },
                    { 'hc-feed': feedNights },
                  ]}
                />
              </div>
              {selStart && (
                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center animate-fade-in">
                  <p className="text-sm sm:flex-1">
                    Block <span className="mono">{nightsSelected}</span> night{nightsSelected === 1 ? '' : 's'}:{' '}
                    {format(selStart, 'd MMM')}{selEnd ? ` → ${format(selEnd, 'd MMM')}` : ''}
                  </p>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Note (optional)" className="input sm:w-44" />
                  <div className="flex gap-2">
                    <button onClick={() => { setSelStart(null); setSelEnd(null); }} className="btn-ghost btn-sm">Clear</button>
                    <button onClick={blockSelected} disabled={busy} className="btn-ink btn-sm"><Lock size={13} /> Block</button>
                  </div>
                </div>
              )}
              {!selStart && <p className="hint">Tap a first and last night to block them.</p>}
            </div>

            {/* Lists */}
            <div className="space-y-4">
              <div className="card card-pad">
                <p className="eyebrow mb-3">Upcoming bookings</p>
                {data.bookings.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {data.bookings.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0"><p className="truncate">{b.guestName}</p><p className="font-mono text-[11px] text-faint">{range(b.start, b.end)}</p></div>
                        <StatusBadge status={b.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card card-pad">
                <p className="eyebrow mb-3">Blocked dates</p>
                {data.blocks.length === 0 ? <p className="text-sm text-muted">Nothing blocked.</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {data.blocks.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate">{b.source === 'feed' ? (b.feedName || 'Other site') : (b.note || 'Blocked by you')}</p>
                          <p className="font-mono text-[11px] text-faint">{range(b.start, b.end)}</p>
                        </div>
                        {b.source === 'host'
                          ? <button onClick={() => unblock(b)} className="btn-ghost btn-sm" aria-label="Unblock"><Trash2 size={13} /></button>
                          : <span className="chip-neutral">Synced</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Sync */}
          <div className="card card-pad">
            <p className="eyebrow mb-1">Sync with Airbnb, Booking.com & others</p>
            <p className="mb-5 text-sm text-muted">Two steps: give them Apartey's link, and add theirs here. Calendars refresh every 30 minutes.</p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">1. Apartey's calendar link</p>
                <p className="mb-3 text-xs text-muted">Paste this into Airbnb (Calendar → Availability → Connect calendars → Import) or Booking.com (Rates & availability → Sync calendars → Import).</p>
                <div className="flex gap-2">
                  <input readOnly value={data.exportUrl} onFocus={(e) => e.target.select()} className="input mono min-w-0 flex-1 text-xs" />
                  <button onClick={copyExport} className="btn-ink btn-sm shrink-0"><Copy size={13} /> Copy</button>
                </div>
                <button onClick={resetExport} className="btn-ghost btn-sm -ml-3 mt-1 text-xs">Create a new link</button>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">2. Their calendar links</p>
                <p className="mb-3 text-xs text-muted">On the other site, find “Export calendar” and copy the link (it usually ends in .ics).</p>
                {data.feeds.length > 0 && (
                  <ul className="mb-3 divide-y divide-line rounded-xl border border-line text-sm">
                    {data.feeds.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate"><Link2 size={13} className="shrink-0 text-muted" /> {f.name}</p>
                          {f.lastError
                            ? <p className="flex items-center gap-1 text-[11px] text-red-700"><AlertTriangle size={11} /> {f.lastError}</p>
                            : <p className="flex items-center gap-1 font-mono text-[11px] text-faint">{f.lastSyncedAt ? <><Check size={11} /> {f.eventCount} dates · {formatDateTime(f.lastSyncedAt)}</> : 'Not synced yet'}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => syncFeed(f)} disabled={busy} className="btn-ghost btn-sm" aria-label={`Sync ${f.name} now`}><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /></button>
                          <button onClick={() => removeFeed(f)} className="btn-ghost btn-sm" aria-label={`Disconnect ${f.name}`}><Trash2 size={13} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={addFeed} className="flex flex-col gap-2 sm:flex-row">
                  <select value={feedForm.name} onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })} className="input sm:w-36">
                    {FEED_SOURCES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <input type="url" required value={feedForm.url} onChange={(e) => setFeedForm({ ...feedForm, url: e.target.value })}
                    placeholder="https://www.airbnb.com/calendar/ical/….ics" className="input min-w-0 flex-1" />
                  <button type="submit" disabled={busy} className="btn-outline shrink-0"><Plus size={14} /> Connect</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
