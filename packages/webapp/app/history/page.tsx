'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { Nav } from '../components/Nav';

export default function HistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await apiGet('/history');
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div className="cardInner">
          <div className="h2">History</div>
          <div className="small">Your last settled rounds + provably-fair proof.</div>

          <div className="spacer" />

          {items.length ? (
            <div className="grid">
              {items.map((it) => (
                <div key={it.roundId} className="roomCard">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800 }}>{it.roomTitle}</div>
                    <div className="tag">{it.currency}</div>
                  </div>

                  <div className="small" style={{ marginTop: 8 }}>
                    Pot: <span className="mono">{it.totalPot}</span> • Fee: <span className="mono">{it.fee}</span> • Payout:{' '}
                    <span className="mono">{it.payout}</span>
                  </div>

                  <div className="small" style={{ marginTop: 6 }}>
                    Winner: <span className="mono">{it.winnerDisplayName}</span>
                  </div>

                  <details style={{ marginTop: 10 }}>
                    <summary className="small">Provably-fair proof</summary>
                    <div className="small" style={{ marginTop: 8 }}>
                      serverSeedHash: <span className="mono">{it.provablyFair.serverSeedHash}</span>
                    </div>
                    <div className="small">
                      clientSeedAgg: <span className="mono">{it.provablyFair.clientSeed}</span>
                    </div>
                    <div className="small">
                      serverSeed: <span className="mono">{it.provablyFair.serverSeed}</span>
                    </div>
                    <div className="small">
                      nonce: <span className="mono">{it.provablyFair.nonce}</span>
                    </div>
                    <div className="small">
                      digest: <span className="mono">{it.provablyFair.digest}</span>
                    </div>
                  </details>

                  <div className="small" style={{ marginTop: 10, opacity: 0.75 }}>
                    Settled: {new Date(it.settledAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small" style={{ opacity: 0.7 }}>
              No history yet.
            </div>
          )}

          {error ? <div className="small" style={{ color: '#ff87f0', marginTop: 12 }}>{error}</div> : null}
        </div>
      </div>

      <Nav />
    </div>
  );
}
