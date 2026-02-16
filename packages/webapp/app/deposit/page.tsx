'use client';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { Nav } from '../components/Nav';
import { TonConnectUIProvider, TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

function TonDepositInner() {
  const [ton, setTon] = useState('0.5');
  const [error, setError] = useState('');
  const [pendingBoc, setPendingBoc] = useState<string>('');
  const [pendingTonAmount, setPendingTonAmount] = useState<string>('');
  const [balances, setBalances] = useState<any>(null);

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const load = async () => {
    const b = await apiGet('/balance');
    setBalances(b.balances);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const sendTon = async () => {
    setError('');
    try {
      if (!wallet) throw new Error('Connect TON wallet first');
      const to = process.env.NEXT_PUBLIC_TON_RECEIVER_ADDRESS!;
      const amountNano = BigInt(Math.floor(Number(ton) * 1e9)).toString();

      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: to, amount: amountNano }],
      });

      const boc = (tx as any)?.boc as string | undefined;
      if (!boc) throw new Error('ton_boc_missing');

      setPendingBoc(boc);
      setPendingTonAmount(ton);

      await apiPost('/payments/ton/confirm', { boc, amountTon: ton, to });

      await load();
      setPendingBoc('');
      setPendingTonAmount('');
      alert('✅ TON deposit confirmed & credited.');
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('ton_not_found_yet')) {
        setError('TON tx not found on-chain yet. Wait 5-30 seconds and press “Confirm deposit”.');
        return;
      }
      setError(msg);
    }
  };

  const confirmPendingTon = async () => {
    setError('');
    try {
      if (!pendingBoc) throw new Error('No pending tx');
      const to = process.env.NEXT_PUBLIC_TON_RECEIVER_ADDRESS!;
      await apiPost('/payments/ton/confirm', { boc: pendingBoc, amountTon: pendingTonAmount || ton, to });
      await load();
      setPendingBoc('');
      setPendingTonAmount('');
      alert('✅ TON deposit confirmed & credited.');
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('ton_not_found_yet')) {
        setError('TON tx not found yet. Try again in a few seconds.');
        return;
      }
      setError(msg);
    }
  };

  return (
    <div className="container">
      <div className="card"><div className="cardInner">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="h2">Wallet</div>
            <div className="small">Balances: XTR {balances?.XTR ?? '…'} • TON {balances?.TON ?? '…'}</div>
          </div>
          <div>
            <TonConnectButton />
          </div>
        </div>

        <hr />

        <div className="h3">Telegram Stars (XTR)</div>
        <div className="small">
          Stars deposit is made via the bot invoice. Open the bot chat and send:
          <span className="mono"> /deposit 100</span> (example)
        </div>
        <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
          Gift-mode: user converts Gifts → Stars in Telegram, then deposits Stars here.
        </div>

        <hr />

        <div className="h3">TON deposit</div>
        <div className="grid grid2">
          <div>
            <div className="small">Amount TON</div>
            <input className="input" value={ton} onChange={(e) => setTon(e.target.value)} placeholder="0.5" />
          </div>
          <div className="row" style={{ alignItems: 'end', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={sendTon}>
              Send
            </button>
            {pendingBoc ? (
              <button className="btn ghost" onClick={confirmPendingTon}>
                Confirm deposit
              </button>
            ) : null}
          </div>
        </div>

        {error ? <div className="small" style={{ color: '#ff87f0', marginTop: 10 }}>{error}</div> : null}
      </div></div>

      <Nav />
    </div>
  );
}

export default function DepositPage() {
  const manifestUrl = process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL!;
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TonDepositInner />
    </TonConnectUIProvider>
  );
}
