import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Shield, Users, Crown, Wallet, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Props { onBack: () => void; }
interface Stats { users: number; subscriptions: number; revenue: number; }

export default function AdminPanel({ onBack }: Props) {
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ users: 0, subscriptions: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [{ count: users }, { data: subs }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('amount,status'),
      ]);
      if (!active) return;
      const paid = (subs ?? []).filter((s) => s.status === 'active' || s.status === 'expired');
      setStats({ users: users ?? 0, subscriptions: paid.length, revenue: paid.reduce((sum, s) => sum + Number(s.amount || 0), 0) });
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><button onClick={onBack} className="p-2"><ArrowLeft className="w-5 h-5" /></button><div className="flex items-center gap-2"><Shield className="w-5 h-5" /><span className="font-bold">Admin Panel</span></div></div>
          <button onClick={signOut} className="text-sm text-white/70 hover:text-white">Sign out</button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-rose-500 animate-spin" /></div> : <>
          <h1 className="text-xl font-bold text-gray-900 mb-5">Platform overview</h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card icon={<Users className="w-5 h-5" />} label="Users" value={stats.users.toLocaleString()} />
            <Card icon={<Crown className="w-5 h-5" />} label="Paid subscriptions" value={stats.subscriptions.toLocaleString()} />
            <Card icon={<Wallet className="w-5 h-5" />} label="Subscription revenue" value={`₦${stats.revenue.toLocaleString()}`} />
          </div>
          <div className="mt-6 rounded-2xl bg-white border border-gray-100 p-5"><p className="font-semibold">Paystack payment system</p><p className="text-sm text-gray-500 mt-1">Payment records and subscription verification are handled through the Paystack/Supabase payment flow.</p></div>
        </>}
      </main>
    </div>
  );
}
function Card({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-5"><div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">{icon}</div><div className="text-2xl font-bold text-gray-900">{value}</div><div className="text-sm text-gray-500 mt-1">{label}</div></div>;
}
