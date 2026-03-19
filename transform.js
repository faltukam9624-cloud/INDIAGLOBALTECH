import { getUserFromToken, getUserProfile, supabase } from './_supabase.js';

const LIMITS = { free: 10, pro: 999999, business: 999999 };

const DEFAULT_SYSTEM = (outputType, tone) =>
  `You are an elite professional business communication specialist at IndiaGlobalTech. Transform the user's input (any language, informal, or broken English) into a polished, professional ${outputType || 'business communication'} in English. Tone: ${tone || 'formal'}. Output ONLY the final content — no preamble, no labels. Max 250 words.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, tone, outputType, systemPrompt } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });

  const user = await getUserFromToken(req);
  if (user) {
    const profile = await getUserProfile(user.id);
    const plan = profile?.plan || 'free';
    const usageToday = profile?.usage_today || 0;
    const limit = LIMITS[plan] || LIMITS.free;

    if (usageToday >= limit) {
      return res.status(429).json({
        error: plan === 'free'
          ? 'Daily limit reached (10/day on Free plan). Upgrade to Pro for unlimited access.'
          : 'Usage limit reached.',
        upgrade: plan === 'free'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const lastUsed = profile?.last_used_date;
    await supabase.from('profiles').update({
      usage_today: lastUsed === today ? usageToday + 1 : 1,
      usage_total: (profile?.usage_total || 0) + 1,
      last_used_date: today
    }).eq('id', user.id);

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      tool: outputType || 'email',
      plan,
      created_at: new Date().toISOString()
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt || DEFAULT_SYSTEM(outputType, tone),
        messages: [{ role: 'user', content: text }]
      })
    });

    const data = await response.json();
    const result = data.content?.[0]?.text;
    if (!result) return res.status(500).json({ error: 'No response from AI. Please try again.' });
    return res.status(200).json({ result });
  } catch (err) {
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
