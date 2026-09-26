type VercelRequest = { method?: string; headers: Record<string, string | string[] | undefined> };
type VercelResponse = { status(code: number): VercelResponse; json(body: unknown): VercelResponse };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase server configuration missing' });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/expire_subscriptions`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await response.text();
    let data: unknown;
    try { data = JSON.parse(body); } catch { data = { raw: body }; }
    return res.status(response.ok ? 200 : 502).json({ ok: response.ok, result: data });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Expiration job unavailable' });
  }
}
