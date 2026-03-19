import Stripe from 'stripe';
import { supabase } from '../_supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await supabase.from('profiles').update({
            plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan_updated_at: new Date().toISOString()
          }).eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase.from('profiles').update({
          plan: 'free',
          stripe_subscription_id: null,
          plan_updated_at: new Date().toISOString()
        }).eq('stripe_customer_id', sub.customer);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('Payment failed for customer:', invoice.customer);
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
