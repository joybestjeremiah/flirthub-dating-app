type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined> };
type VercelResponse = { status(code: number): VercelResponse; json(body: unknown): VercelResponse };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!supabaseUrl || !serviceKey || !cronSecret) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  try {
    const [expireResponse, payoutResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/rpc/expire_subscriptions`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
      fetch(`${supabaseUrl}/functions/v1/process-host-payouts`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'x-cron-secret': cronSecret,
          'Content-Type': 'application/json',
        },
      }),
    ]);

    const expireBody = await expireResponse.text();
    const payoutBody = await payoutResponse.text();
    let expiration: unknown;
    let payouts: unknown;
    try { expiration = JSON.parse(expireBody); } catch { expiration = { raw: expireBody }; }
    try { payouts = JSON.parse(payoutBody); } catch { payouts = { raw: payoutBody }; }

    const ok = expireResponse.ok && payoutResponse.ok;
    return res.status(ok ? 200 : 502).json({ ok, expiration, payouts });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Maintenance service unavailable' });
  }
}
