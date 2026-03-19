import { supabase, getUserProfile } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid')) return res.status(401).json({ error: 'Invalid email or password' });
      return res.status(401).json({ error: error.message });
    }

    const profile = await getUserProfile(data.user.id);

    return res.status(200).json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        name: profile?.name || data.user.user_metadata?.name || 'User',
        email: data.user.email,
        plan: profile?.plan || 'free',
        usage_today: profile?.usage_today || 0,
        usage_total: profile?.usage_total || 0
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
