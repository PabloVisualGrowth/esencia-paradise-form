const N8N_WEBHOOK = 'https://esencia-paradise-n8n.rh6pum.easypanel.host/webhook/ad8b0ef9-ad63-4466-8a4a-c652f7b53f52';

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body || {};

    // n8n webhook is GET — forward all fields as query params
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    }

    const url = `${N8N_WEBHOOK}?${params.toString()}`;

    // Abort if n8n doesn't respond within 15 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const status = response.status;

    // Read body with a separate timeout to avoid hanging on non-2xx responses
    let text = '{}';
    try {
      const bodyTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('body timeout')), 5000)
      );
      text = await Promise.race([response.text(), bodyTimeout]);
    } catch {
      // Body read timed out or failed — build a minimal response from the status
      if (status === 409) {
        text = JSON.stringify({ ok: false, error: 'duplicate_email' });
      }
    }

    return res.status(status).send(text);
  } catch (err) {
    console.error('Proxy error:', err);
    if (err.name === 'AbortError') {
      return res.status(504).json({ ok: false, error: 'timeout' });
    }
    return res.status(500).json({ error: err.message });
  }
};
