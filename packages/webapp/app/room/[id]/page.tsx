'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { Nav } from '../../components/Nav';
import { useParams } from 'next/navigation';

function hashToHue(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
function colorFor(id: string) {
  const hue = hashToHue(id);
  return `hsl(${hue} 86% 58%)`;
}

function genClientSeed() {
  return 'seed_' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

function nanoToDecimal(nano: string) {
  try {
    let n = BigInt(nano);
    const neg = n < 0n;
    if (neg) n = -n;
    const base = 1000000000n;
    const whole = n / base;
    const frac = (n % base).toString().padStart(9, '0').replace(/0+$/, '');
    const s = frac ? `${whole.toString()}.${frac}` : whole.toString();
    return neg ? `-${s}` : s;
  } catch {
    return nano;
  }
}


export default function RoomPage() {
  const params = useParams();
  const id = params.id as string;

  const [room, setRoom] = useState<any>(null);
  const [amount, setAmount] = useState('10');
  const [clientSeed, setClientSeed] = useState('');
  const [error, setError] = useState('');
  const [rotation, setRotation] = useState(0);

  const load = async () => {
    const res = await apiGet(`/rooms/${id}`);
    setRoom(res.room);
  };

  useEffect(() => {
    const key = `clientSeed:${id}`;
    const existing = localStorage.getItem(key);
    if (existing) setClientSeed(existing);
    else {
      const s = genClientSeed();
      localStorage.setItem(key, s);
      setClientSeed(s);
    }

    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [id]);

  // Spin animation when a new settledAt appears
  useEffect(() => {
    const settledAt = room?.settled?.settledAt;
    if (!settledAt) return;
    const outcome = room?.settled?.outcome;
    if (!outcome) return;

    try {
      const ticket = BigInt(outcome.winningTicket);
      const total = BigInt(outcome.totalWeight || outcome.totalPotNano || '0');
      const angle = total > 0n ? Number((ticket * 36000n) / total) / 100 : 0;
      const extra = 360 * (5 + Math.floor(Math.random() * 3));
      setRotation(extra - angle);
    } catch {
      setRotation(360 * 6);
    }
  }, [room?.settled?.settledAt]);

  const participants = room?.participants ?? [];
  const gradient = useMemo(() => {
    if (!participants.length) return 'conic-gradient(from 0deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))';
    let start = 0;
    const parts: string[] = [];
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const pct = Math.max(0.2, p.percentBps / 100); // percent
      const end = i === participants.length - 1 ? 100 : Math.min(100, start + pct);
      const c = colorFor(p.userId);
      parts.push(`${c} ${start}% ${end}%`);
      start = end;
    }
    return `conic-gradient(from 0deg, ${parts.join(', ')})`;
  }, [participants]);

  const msLeft = room?.round?.endsAt ? new Date(room.round.endsAt).getTime() - Date.now() : 0;
  const secLeft = Math.max(0, Math.floor(msLeft / 1000));

  const bet = async () => {
    setError('');
    try {
      if (!amount.trim()) throw new Error('Enter amount');
      if (!clientSeed.trim()) throw new Error('Client seed missing');

      const idempotencyKey = crypto.randomUUID?.() ?? ('k_' + Math.random().toString(16).slice(2));

      await apiPost(`/rooms/${id}/bet`, {
        amount: amount.trim(),
        clientSeed: clientSeed.trim(),
        idempotencyKey,
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  if (!room) {
    return (
      <div className="container">
        <div className="card">
          <div className="cardInner">
            <div className="h2">Loading…</div>
          </div>
        </div>
        <Nav />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="cardInner">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="h2">{room.title}</div>
              <div className="small">
                {room.currency} • pot <span className="mono">{room.round.totalPot}</span> • players {room.round.participantsCount}{' '}
                {room.maxPlayers ? `/ ${room.maxPlayers}` : ''}
              </div>
            </div>
            <div className="pill">
              <div className="small">Ends in</div>
              <div className="mono">{secLeft}s</div>
            </div>
          </div>

          <div className="spacer" />

          <div className="wheelWrap">
            <div className="wheel" style={{ background: gradient, transform: `rotate(${rotation}deg)` }} />
            <div className="wheelGlass" />
            <div className="pointer" />
            <div className="wheelCenter">
              <div className="small">POT</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 800 }}>
                {room.round.totalPot}
              </div>
            </div>
          </div>

          <div className="spacer" />

          <div className="grid grid2">
            <div>
              <div className="small">Bet amount ({room.currency})</div>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={room.currency === 'XTR' ? '10' : '0.2'} />
              <div className="small" style={{ marginTop: 6 }}>
                Fee: {(room.feeBps / 100).toFixed(2)}% of the pot (winner pays).
              </div>
            </div>
            <div>
              <div className="small">Provably fair</div>
              <div className="small">
                Server commit: <span className="mono">{String(room.provablyFair.serverSeedHash).slice(0, 16)}…</span>
              </div>
              <div className="small">
                Client seed: <span className="mono">{clientSeed.slice(0, 12)}…</span>
              </div>
              <div className="small" style={{ opacity: 0.7 }}>
                Seed must stay the same inside a round (to prevent manipulation).
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <button className="btn" onClick={bet} disabled={secLeft <= 1}>
              Place bet
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                const s = genClientSeed();
                localStorage.setItem(`clientSeed:${id}`, s);
                setClientSeed(s);
              }}
            >
              New seed
            </button>
          </div>

          {error ? <div className="small" style={{ color: '#ff87f0', marginTop: 10 }}>{error}</div> : null}

          <div className="spacer" />

          <div className="h3">Players</div>
          {participants.length ? (
            <div className="list">
              {participants.map((p: any) => (
                <div key={p.userId} className="listItem">
                  <div className="avatar" style={{ background: colorFor(p.userId) }} />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700 }}>{p.displayName}</div>
                      <div className="mono">{p.amount}</div>
                    </div>
                    <div className="bar">
                      <div className="barFill" style={{ width: `${Math.min(100, p.percentBps / 100)}%`, background: colorFor(p.userId) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small" style={{ opacity: 0.7 }}>
              No bets yet.
            </div>
          )}

          {room.settled ? (
            <>
              <div className="spacer" />
              <div className="h3">Last result</div>
              <div className="roomCard">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="small">
                    Winner: <span className="mono">{room.settled.outcome.winnerUserId.slice(0, 8)}…</span>
                  </div>
                  <div className="small">
                    Payout: <span className="mono">{nanoToDecimal(room.settled.outcome.payoutNano)}</span>
                  </div>
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  Reveal: serverSeed <span className="mono">{room.settled.reveal.serverSeed.slice(0, 16)}…</span> • digest{' '}
                  <span className="mono">{room.settled.reveal.digest.slice(0, 16)}…</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <Nav />
    </div>
  );
}
