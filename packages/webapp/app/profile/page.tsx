'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { initTelegram, userFromInitDataUnsafe } from '../lib/tg';
import { Nav } from '../components/Nav';

export default function ProfilePage() {
  const [balances, setBalances] = useState<{ XTR: string; TON: string }>({ XTR: '0', TON: '0' });
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState('');

  const tgUser = useMemo(() => userFromInitDataUnsafe(), []);

  const load = async () => {
    setError('');
    const [b, m] = await Promise.all([apiGet('/balance'), apiGet('/me')]);
    setBalances(b.balances);
    setMe(m.user);
  };

  useEffect(() => {
    initTelegram();
    load().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const save = async (patch: any) => {
    setError('');
    try {
      await apiPost('/settings', patch);
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="cardInner">
          <div className="h2">Profile</div>
          <div className="small">Account & settings.</div>

          <div className="spacer" />

          <div className="roomCard">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{tgUser?.first_name ?? 'Telegram user'}</div>
                <div className="small">
                  tg id: <span className="mono">{tgUser?.id ?? '—'}</span>
                </div>
              </div>
              <div className="tag">LIVE</div>
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              XTR balance: <span className="mono">{balances.XTR}</span>
            </div>
            <div className="small">
              TON balance: <span className="mono">{balances.TON}</span>
            </div>
          </div>

          <div className="spacer" />

          <div className="h3">Settings</div>
          <div className="grid grid2">
            <div>
              <div className="small">Language</div>
              <select
                className="select"
                value={me?.language ?? 'en'}
                onChange={(e) => save({ language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </div>

            <div>
              <div className="small">Notifications</div>
              <select
                className="select"
                value={String(me?.notifications ?? true)}
                onChange={(e) => save({ notifications: e.target.value === 'true' })}
              >
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            </div>
          </div>

          {error ? <div className="small" style={{ color: '#ff87f0', marginTop: 12 }}>{error}</div> : null}
        </div>
      </div>

      <Nav />
    </div>
  );
}
