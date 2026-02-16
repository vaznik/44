'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from './lib/api';
import { Nav } from './components/Nav';

type Room = any;

export default function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [balances, setBalances] = useState<any>(null);
  const [currency, setCurrency] = useState<'ALL' | 'XTR' | 'TON'>('ALL');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      // Ensure global room exists
      await apiGet('/bootstrap').catch(() => {});
      const b = await apiGet('/balance');
      const r = await apiGet('/rooms');
      setBalances(b.balances);
      setRooms(r.rooms);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    let list = rooms;
    if (currency !== 'ALL') list = list.filter((x) => x.currency === currency);
    return list;
  }, [rooms, currency]);

  const global = filtered.find((r) => r.kind === 'GLOBAL');
  const privates = filtered.filter((r) => r.kind === 'PRIVATE');

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Pot Roulette</div>
          <div className="small">One winner takes the pot (−1% fee).</div>
        </div>

        <div className="pill">
          <div className="small">XTR</div>
          <div className="mono">{balances?.XTR ?? '…'}</div>
          <div className="dot" />
          <div className="small">TON</div>
          <div className="mono">{balances?.TON ?? '…'}</div>
        </div>
      </div>

      <div className="card"><div className="cardInner">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="h2">Lobby</div>
            <div className="small">Choose a room and place your bet.</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
              <option value="ALL">All</option>
              <option value="XTR">Stars (XTR)</option>
              <option value="TON">TON</option>
            </select>
            <Link className="btn" href="/create">
              + Create room
            </Link>
          </div>
        </div>

        {global ? (
          <div className="roomCard highlight">
            <div className="roomTop">
              <div>
                <div className="roomTitle">{global.title}</div>
                <div className="small">
                  {global.currency} • players: {global.round.participantsCount} • pot: <span className="mono">{global.round.totalPot}</span>
                </div>
              </div>
              <Link className="btn" href={`/room/${global.id}`}>
                Open
              </Link>
            </div>
            <div className="roomMeta">
              <div className="metaItem">
                <div className="small">Round ends</div>
                <div className="mono">{new Date(global.round.endsAt).toLocaleTimeString()}</div>
              </div>
              <div className="metaItem">
                <div className="small">Fee</div>
                <div className="mono">{(global.feeBps / 100).toFixed(2)}%</div>
              </div>
              <div className="metaItem">
                <div className="small">Limit</div>
                <div className="mono">∞</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="h3" style={{ marginTop: 18 }}>
          Private rooms
        </div>

        {privates.length ? (
          <div className="grid">
            {privates.map((r) => (
              <Link key={r.id} className="roomCard" href={`/room/${r.id}`}>
                <div className="roomTop">
                  <div>
                    <div className="roomTitle">{r.title}</div>
                    <div className="small">
                      {r.currency} • players: {r.round.participantsCount}/{r.maxPlayers ?? '∞'} • pot:{' '}
                      <span className="mono">{r.round.totalPot}</span>
                    </div>
                  </div>
                  <div className="tag">Join</div>
                </div>
                <div className="roomMeta">
                  <div className="metaItem">
                    <div className="small">Min bet</div>
                    <div className="mono">{r.minBet}</div>
                  </div>
                  <div className="metaItem">
                    <div className="small">Max bet</div>
                    <div className="mono">{r.maxBet ?? '∞'}</div>
                  </div>
                  <div className="metaItem">
                    <div className="small">Pot cap</div>
                    <div className="mono">{r.maxTotalPot ?? '∞'}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="small" style={{ opacity: 0.7 }}>
            No private rooms yet.
          </div>
        )}

        {error ? <div className="small" style={{ color: '#ff87f0', marginTop: 12 }}>{error}</div> : null}
      </div></div>

      <Nav />
    </div>
  );
}
