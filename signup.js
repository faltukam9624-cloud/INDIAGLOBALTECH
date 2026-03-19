const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Name, email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (error) {
      if (error.message.includes('already registered')) return res.status(409).json({ error: 'Email already registered. Please sign in.' });
      return res.status(400).json({ error: error.message });
    }

    await supabase.from('profiles').insert({
      id: data.user.id, name, email,
      plan: 'free', usage_today: 0, usage_total: 0,
      created_at: new Date().toISOString()
    });

    const { data: session } = await supabase.auth.signInWithPassword({ email, password });

    return res.status(200).json({
      message: 'Account created!',
      token: session?.session?.access_token,
      user: { id: data.user.id, name, email, plan: 'free', usage_today: 0, usage_total: 0 }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
