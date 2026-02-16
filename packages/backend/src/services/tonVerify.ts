import { env } from '../env';

export type TonVerifyOk = {
  ok: true;
  msgHash?: string;
  txHash?: string;
  amountNano: bigint;
  from?: string;
  to: string;
  comment?: string;
  confirmedVia: 'toncenter' | 'tonapi';
};

export type TonVerifyFail = { ok: false; reason: string };

export type TonVerifyResult = TonVerifyOk | TonVerifyFail;

function withApiKey(url: string) {
  if (!env.toncenterKey) return url;
  const u = new URL(url);
  // toncenter supports api_key in query for many deployments
  if (!u.searchParams.get('api_key')) u.searchParams.set('api_key', env.toncenterKey);
  return u.toString();
}

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function pick(obj: any, paths: string[]): any {
  for (const p of paths) {
    const parts = p.split('.');
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (cur && typeof cur === 'object' && part in cur) cur = cur[part];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

function toBigIntLoose(v: any): bigint | undefined {
  try {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
    if (typeof v === 'string' && v.trim()) {
      // some APIs return decimal strings in nano
      const s = v.trim();
      if (/^\d+$/.test(s)) return BigInt(s);
    }
  } catch {}
  return undefined;
}

export type DecodedTonMessage = {
  msgHash: string;
  from?: string;
  to: string;
  valueNano: bigint;
  comment?: string;
};

export async function decodeTonMessageBoc(boc: string): Promise<DecodedTonMessage> {
  // Prefer TonAPI decode (works with TonConnect response BOC)
  if (env.tonapiKey) {
    const j = await fetchJson(`${env.tonapiBaseUrl}/v2/blockchain/messages/decode`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.tonapiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ boc }),
    });

    const msgHash = String(pick(j, ['hash', 'message.hash', 'data.hash', 'result.hash']) ?? '');
    const to = String(
      pick(j, [
        'destination',
        'destination.address',
        'dst',
        'message.destination',
        'message.destination.address',
        'result.destination',
        'result.destination.address',
      ]) ?? '',
    );
    const from = pick(j, ['source', 'source.address', 'src', 'message.source', 'message.source.address', 'result.source', 'result.source.address']);
    const valAny = pick(j, ['value', 'amount', 'valueNano', 'message.value', 'message.amount', 'result.value', 'result.amount']);
    const valueNano = toBigIntLoose(valAny);

    const comment = pick(j, ['comment', 'message.comment', 'body.text', 'body', 'result.comment']);
    if (!msgHash || !to || !valueNano) throw new Error('TonAPI decode: unexpected response shape');
    return { msgHash, from: from ? String(from) : undefined, to, valueNano, comment: comment ? String(comment) : undefined };
  }

  // Fallback: toncenter decodeMessage (not always enabled, but try)
  if (env.toncenterKey) {
    const j = await fetchJson(withApiKey(`${env.toncenterBaseUrl}/decodeMessage`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': env.toncenterKey },
      body: JSON.stringify({ boc }),
    });

    // toncenter often returns { ok: true, result: {...} }
    const payload = j?.result ?? j;
    const msgHash = String(pick(payload, ['hash', 'message_hash', 'msg_hash']) ?? '');
    const to = String(pick(payload, ['destination', 'dst', 'dest', 'to', 'message.destination', 'message.dst']) ?? '');
    const from = pick(payload, ['source', 'src', 'from', 'message.source', 'message.src']);
    const valueNano = toBigIntLoose(pick(payload, ['value', 'amount', 'valueNano', 'message.value', 'message.amount']));
    const comment = pick(payload, ['comment', 'message.comment', 'text']);

    if (!msgHash || !to || !valueNano) throw new Error('toncenter decodeMessage: unexpected response shape');
    return { msgHash, from: from ? String(from) : undefined, to, valueNano, comment: comment ? String(comment) : undefined };
  }

  throw new Error('TON decode requires TONAPI_KEY or TONCENTER_API_KEY');
}

export async function toncenterFindIncomingMessage(params: { receiver: string; msgHash?: string; txHash?: string }) {
  const url = withApiKey(`${env.toncenterBaseUrl}/getTransactions?address=${encodeURIComponent(params.receiver)}&limit=50`);
  const j = await fetchJson(url, { headers: env.toncenterKey ? { 'X-API-Key': env.toncenterKey } : undefined });

  const list: any[] = Array.isArray(j?.result) ? j.result : [];
  for (const tx of list) {
    const txh = String(pick(tx, ['transaction_id.hash', 'tx_id.hash', 'hash']) ?? '');
    const inHash = String(pick(tx, ['in_msg.hash', 'in_msg.msg_hash']) ?? '');
    if (params.txHash && txh === params.txHash) return tx;
    if (params.msgHash && inHash === params.msgHash) return tx;
  }
  return null;
}

export async function tonapiMessageLookup(msgHash: string): Promise<boolean> {
  if (!env.tonapiKey) return false;
  try {
    await fetchJson(`${env.tonapiBaseUrl}/v2/blockchain/messages/${encodeURIComponent(msgHash)}`, {
      headers: { Authorization: `Bearer ${env.tonapiKey}` },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify TON deposit sent via TonConnect.
 *
 * - Client sends BOC (TonConnect sendTransaction response).
 * - Backend decodes BOC (TonAPI or toncenter) to get msgHash + destination + value.
 * - Backend confirms that message is actually included on-chain:
 *   - Prefer toncenter `getTransactions` on receiver address and match in_msg.hash == msgHash
 *   - Fallback tonapi message lookup by hash
 */
export async function verifyTonDeposit(params: {
  boc?: string;
  txHash?: string;
  expectedTo: string;
  expectedAmountNano: bigint;
}): Promise<TonVerifyResult> {
  try {
    let decoded: DecodedTonMessage | null = null;
    let msgHash: string | undefined;
    let to = params.expectedTo;
    let amountNano = params.expectedAmountNano;
    let from: string | undefined;
    let comment: string | undefined;

    if (params.boc) {
      decoded = await decodeTonMessageBoc(params.boc);
      msgHash = decoded.msgHash;
      to = decoded.to;
      amountNano = decoded.valueNano;
      from = decoded.from;
      comment = decoded.comment;
    }

    // basic validation: receiver + amount must match
    if (to !== params.expectedTo) return { ok: false, reason: 'DESTINATION_MISMATCH' };
    if (amountNano !== params.expectedAmountNano) return { ok: false, reason: 'AMOUNT_MISMATCH' };

    // On-chain confirmation
    if (env.toncenterKey) {
      const tx = await toncenterFindIncomingMessage({ receiver: params.expectedTo, msgHash, txHash: params.txHash });
      if (!tx) return { ok: false, reason: 'NOT_FOUND_YET' };

      const inVal = toBigIntLoose(pick(tx, ['in_msg.value', 'in_msg.amount', 'in_msg.valueNano'])) ?? BigInt(0);
      const inTo = String(pick(tx, ['in_msg.destination', 'in_msg.dest', 'in_msg.to', 'in_msg.dst']) ?? params.expectedTo);
      if (inTo !== params.expectedTo) return { ok: false, reason: 'DESTINATION_MISMATCH' };
      if (inVal !== params.expectedAmountNano) return { ok: false, reason: 'AMOUNT_MISMATCH' };

      const txHash = String(pick(tx, ['transaction_id.hash', 'hash']) ?? '');
      const msgHash2 = String(pick(tx, ['in_msg.hash']) ?? msgHash ?? '');
      const inFrom = pick(tx, ['in_msg.source', 'in_msg.from', 'in_msg.src']);
      return {
        ok: true,
        confirmedVia: 'toncenter',
        txHash: txHash || undefined,
        msgHash: msgHash2 || undefined,
        amountNano: params.expectedAmountNano,
        to: params.expectedTo,
        from: inFrom ? String(inFrom) : from,
        comment,
      };
    }

    if (msgHash && env.tonapiKey) {
      const ok = await tonapiMessageLookup(msgHash);
      if (!ok) return { ok: false, reason: 'NOT_FOUND_YET' };
      return { ok: true, confirmedVia: 'tonapi', msgHash, amountNano: params.expectedAmountNano, to: params.expectedTo, from, comment };
    }

    return { ok: false, reason: 'TON_VERIFIER_NOT_CONFIGURED' };
  } catch (e: any) {
    return { ok: false, reason: 'EXCEPTION:' + (e?.message ?? String(e)) };
  }
}
