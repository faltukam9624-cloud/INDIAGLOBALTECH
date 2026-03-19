import { getUserFromToken, getUserProfile } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const profile = await getUserProfile(user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  return res.status(200).json({
    user: {
      id: user.id,
      name: profile.name,
      email: profile.email,
      plan: profile.plan,
      usage_today: profile.usage_today,
      usage_total: profile.usage_total
    }
  });
}
