'use client';
import { useState } from 'react';
import { apiPost } from '../lib/api';
import { Nav } from '../components/Nav';
import { useRouter } from 'next/navigation';

export default function CreateRoomPage() {
  const r = useRouter();
  const [currency, setCurrency] = useState<'XTR' | 'TON'>('XTR');
  const [title, setTitle] = useState('Private room');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [minBet, setMinBet] = useState('0');
  const [maxBet, setMaxBet] = useState('');
  const [maxTotalPot, setMaxTotalPot] = useState('');
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(30);
  const [startMode, setStartMode] = useState<'TIMER' | 'FILL'>('TIMER');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      const body: any = {
        currency,
        title,
        maxPlayers,
        minBet,
        roundDurationSeconds,
        startMode,
      };
      if (maxBet.trim()) body.maxBet = maxBet.trim();
      if (maxTotalPot.trim()) body.maxTotalPot = maxTotalPot.trim();

      const res = await apiPost('/rooms', body);
      r.push(`/room/${res.roomId}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="cardInner">
          <div className="h2">Create private room</div>
          <div className="small">Limit players / bets and run a round by timer or by full room.</div>

          <div className="spacer" />

          <div className="grid">
            <div>
              <div className="small">Title</div>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid2">
              <div>
                <div className="small">Currency</div>
                <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                  <option value="XTR">Stars (XTR)</option>
                  <option value="TON">TON</option>
                </select>
              </div>
              <div>
                <div className="small">Max players</div>
                <input className="input" type="number" value={maxPlayers} min={2} max={100} onChange={(e) => setMaxPlayers(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid3">
              <div>
                <div className="small">Min bet</div>
                <input className="input" value={minBet} onChange={(e) => setMinBet(e.target.value)} placeholder="0" />
              </div>
              <div>
                <div className="small">Max bet</div>
                <input className="input" value={maxBet} onChange={(e) => setMaxBet(e.target.value)} placeholder="∞" />
              </div>
              <div>
                <div className="small">Pot cap</div>
                <input className="input" value={maxTotalPot} onChange={(e) => setMaxTotalPot(e.target.value)} placeholder="∞" />
              </div>
            </div>

            <div className="grid grid2">
              <div>
                <div className="small">Round duration (sec)</div>
                <input
                  className="input"
                  type="number"
                  value={roundDurationSeconds}
                  min={10}
                  max={3600}
                  onChange={(e) => setRoundDurationSeconds(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="small">Start mode</div>
                <select className="select" value={startMode} onChange={(e) => setStartMode(e.target.value as any)}>
                  <option value="TIMER">By timer</option>
                  <option value="FILL">Start when filled</option>
                </select>
              </div>
            </div>

            <button className="btn" onClick={submit}>
              Create
            </button>

            {error ? <div className="small" style={{ color: '#ff87f0' }}>{error}</div> : null}
          </div>
        </div>
      </div>

      <Nav />
    </div>
  );
}
