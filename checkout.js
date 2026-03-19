import Stripe from 'stripe';
import { getUserFromToken } from '../_supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  pro: {
    name: 'Professional',
    price: process.env.STRIPE_PRO_PRICE_ID,
    amount: 1900
  },
  business: {
    name: 'Business',
    price: process.env.STRIPE_BUSINESS_PRICE_ID,
    amount: 4900
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to upgrade your plan.' });

  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan selected.' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: PLANS[plan].price, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?payment=success&plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?payment=cancelled`,
      metadata: { user_id: user.id, plan }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: 'Payment session creation failed. Please try again.' });
  }
}
