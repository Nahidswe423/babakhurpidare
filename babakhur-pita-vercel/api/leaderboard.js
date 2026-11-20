// Vercel serverless function: shared leaderboard stored in Upstash Redis (REST API, no dependencies)
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = 'babakhur:scores';

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Database not configured' });
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const name = String(body.name || '').replace(/[<>]/g, '').trim().slice(0, 16);
      const score = Math.floor(Number(body.score));
      if (!name || !Number.isFinite(score) || score < 0 || score > 20000) {
        return res.status(400).json({ error: 'Invalid input' });
      }
      // GT: only update if the new score is higher than the stored one
      await redis(['ZADD', KEY, 'GT', score, name]);
      return res.status(200).json({ ok: true });
    }
    const flat = await redis(['ZREVRANGE', KEY, 0, 9, 'WITHSCORES']);
    const rows = [];
    for (let i = 0; i < flat.length; i += 2) rows.push({ name: flat[i], score: Number(flat[i + 1]) });
    return res.status(200).json({ rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
