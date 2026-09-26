import { useEffect, useState } from 'react';
import { ArrowLeft, Crown, CheckCircle2, Clock3, XCircle, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Subscription } from '@/lib/types';
import { navigate } from '@/App';

export default function SubscriptionPage() {
  const { user, subscription, hasActiveSubscription, refreshSubscription } = useAuth();
  const [history, setHistory] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setHistory((data ?? []) as Subscription[]);
      await refreshSubscription();
      setLoading(false);
    })();
  }, [user?.id]);

  const status = (s: Subscription) => {
    if (s.status === 'active' && new Date(s.expires_at) > new Date()) return { label: 'Active', icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' };
    if (s.status === 'pending') return { label: 'Pending', icon: Clock3, cls: 'text-amber-600 bg-amber-50' };
    if (s.status === 'failed') return { label: 'Failed', icon: XCircle, cls: 'text-red-600 bg-red-50' };
    return { label: 'Expired', icon: Clock3, cls: 'text-gray-500 bg-gray-100' };
  };

  return <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
    <div className="max-w-md mx-auto px-4 py-5">
      <button onClick={() => navigate('/discover')} className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-6"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-6 shadow-lg">
        <div className="flex items-center gap-2"><Crown className="w-6 h-6" /><span className="font-bold">FlirtHub Premium</span></div>
        <h1 className="text-2xl font-black mt-4">{hasActiveSubscription ? 'Premium is active' : 'Premium access'}</h1>
        {hasActiveSubscription && subscription ? <p className="text-sm text-white/80 mt-2">Your {subscription.plan} plan expires {new Date(subscription.expires_at).toLocaleDateString()}.</p> : <p className="text-sm text-white/80 mt-2">Premium unlocks messaging after you match.</p>}
      </div>
      <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><CreditCard className="w-5 h-5 text-rose-500" /><h2 className="font-bold text-gray-900">Payment history</h2></div>
        {loading ? <div className="text-sm text-gray-500">Loading history…</div> : history.length === 0 ? <div className="text-sm text-gray-500">No subscription payments yet.</div> : <div className="space-y-3">{history.map((s) => { const x=status(s); const Icon=x.icon; return <div key={s.id} className="rounded-xl border border-gray-100 p-3"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-gray-900 capitalize">{s.plan} plan</div><div className="text-xs text-gray-500 mt-1">₦{Number(s.amount).toLocaleString()} · {new Date(s.created_at ?? s.starts_at ?? s.expires_at).toLocaleDateString()}</div></div><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${x.cls}`}><Icon className="w-3 h-3" />{x.label}</span></div>{s.paid_at && <div className="text-[11px] text-gray-400 mt-2">Paid {new Date(s.paid_at).toLocaleString()}</div>}{s.flutterwave_transaction_id && <div className="text-[10px] text-gray-400 mt-1 break-all">Transaction: {s.flutterwave_transaction_id}</div>}</div>})}</div>}
      </div>
    </div>
  </div>;
}
