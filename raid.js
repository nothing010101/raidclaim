// Vercel serverless proxy: forwards only wallet-auth and vault "sign" to the RaidLords server.
// Needed because the RaidLords server only allows browser calls from beta.raidlords.com (CORS).
const SB_URL = 'https://olzcjrajdvnvrcwqpflt.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9semNqcmFqZHZudnJjd3FwZmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDE0NzQsImV4cCI6MjEwNzgxNzQ3NH0.g3z4RYRKucxCRAuz-OD3O_FfDyyuM719kVqTE5EO2LA';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const { fn, payload, token } = b || {};
  let body;
  if (fn === 'nonce') body = { wallet: String(payload && payload.wallet || '') };
  else if (fn === 'verify') body = { wallet: String(payload && payload.wallet || ''), signature: String(payload && payload.signature || '') };
  else if (fn === 'sign') body = { action: 'sign' };
  else return res.status(400).json({ error: 'not allowed' });
  const path = fn === 'sign' ? 'vault' : 'wallet-auth';
  if (fn === 'sign' && !token) return res.status(401).json({ error: 'sign in first' });
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${SB_URL}/functions/v1/${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: ANON,
          authorization: 'Bearer ' + (fn === 'sign' ? token : ANON),
          origin: 'https://beta.raidlords.com',
          referer: 'https://beta.raidlords.com/play'
        },
        body: JSON.stringify(body)
      });
      const text = await r.text();
      last = { status: r.status, text };
      if (r.status !== 503 && r.status !== 546 && r.status !== 429) break;
    } catch (e) { last = { status: 502, text: JSON.stringify({ error: String(e.message || e) }) }; }
    await new Promise(z => setTimeout(z, 800 * (i + 1)));
  }
  res.status(last.status).setHeader('content-type', 'application/json').send(last.text || '{}');
};
