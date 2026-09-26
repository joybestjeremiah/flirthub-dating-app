import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
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
    const response = await fetch(`${supabaseUrl}/functions/v1/process-host-payouts`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'x-cron-secret': cronSecret,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(response.ok ? 200 : 502).json(data);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Payout service unavailable',
    });
  }
}
