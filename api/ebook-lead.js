// POST /api/ebook-lead
// Saves the buyer's registration (name, email, WhatsApp) and returns the Instamojo checkout URL.
// Env vars (Vercel): EBOOK_BUY_URL (Instamojo product link), SUPABASE_URL, SUPABASE_SERVICE_KEY (optional, for saving leads)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
  const phone = String(body.phone || '').replace(/[^\d]/g, '').slice(-12);
  const consent = body.consent === true || body.consent === 'true';

  // honeypot: bots fill this hidden field
  if (body.website) return res.status(200).json({ ok: true, redirect: null });

  if (name.length < 2) return res.status(400).json({ ok: false, error: 'Kripya apna poora naam likhein.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'Sahi email ID daalein.' });
  if (phone.length < 10) return res.status(400).json({ ok: false, error: 'Sahi 10-digit WhatsApp/mobile number daalein.' });
  if (!consent) return res.status(400).json({ ok: false, error: 'Aage badhne ke liye sahmati (checkbox) zaroori hai.' });

  // Save lead. A failure here must NOT block the sale, so we only log it.
  let saved = false;
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      const r = await fetch(url.replace(/\/$/, '') + '/rest/v1/ebook_leads', {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ name, email, phone, consent, source: String(body.source || 'ebook-page').slice(0, 40) })
      });
      saved = r.ok;
      if (!r.ok) console.error('ebook_leads insert failed', r.status, await r.text());
    } else {
      console.log('ebook lead (Supabase not configured):', JSON.stringify({ name, email, phone }));
    }
  } catch (e) {
    console.error('ebook lead save error', e && e.message);
  }

  // Build the Instamojo checkout URL (prefill is best-effort; Instamojo may ignore it)
  let redirect = null;
  const base = process.env.EBOOK_BUY_URL;
  if (base && /^https:\/\//i.test(base)) {
    try {
      const u = new URL(base);
      if (/instamojo\.com$|imjo\.in$/i.test(u.hostname)) {
        u.searchParams.set('data_name', name);
        u.searchParams.set('data_email', email);
        u.searchParams.set('data_phone', phone.slice(-10));
      }
      redirect = u.toString();
    } catch (_) { redirect = base; }
  }

  return res.status(200).json({ ok: true, saved, redirect });
};

function safeJson(s) { try { return JSON.parse(s); } catch (_) { return {}; } }
