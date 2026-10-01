import { useEffect, useState } from 'react';
import { Gift, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props { onClose: () => void; }
interface Stats { total_referrals: number; pending_referrals: number; rewarded_referrals: number; total_commission: number; }
interface Row { id: string; referrer_name: string | null; referred_name: string | null; status: string; reward_amount: number; created_at: string; rewarded_at: string | null; }

export default function AdminReferralPanel({ onClose }: Props) {
  const [stats, setStats] = useState<Stats>({ total_referrals: 0, pending_referrals: 0, rewarded_referrals: 0, total_commission: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const [{ data: s, error: se }, { data: r, error: re }] = await Promise.all([
      supabase.rpc('admin_referral_stats'),
      supabase.rpc('admin_referral_recent', { p_limit: 100 }),
    ]);
    if (!se && s?.[0]) setStats(s[0] as Stats);
    if (!re) setRows((r ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  return <div className="fixed inset-0 z-[80] bg-black/50 p-4 overflow-y-auto"><div className="max-w-5xl mx-auto mt-8 bg-white rounded-3xl shadow-2xl overflow-hidden"><div className="flex items-center justify-between px-5 py-4 bg-gray-900 text-white"><div className="flex items-center gap-2"><Gift className="w-5 h-5" /><h2 className="font-bold">Referral Commissions</h2></div><div className="flex gap-2"><button onClick={() => void load()} className="p-2 hover:bg-white/10 rounded-lg"><RefreshCw className="w-4 h-4" /></button><button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button></div></div><div className="p-5"><div className="grid sm:grid-cols-4 gap-3"><Card label="Total referrals" value={stats.total_referrals.toLocaleString()} /><Card label="Pending" value={stats.pending_referrals.toLocaleString()} /><Card label="Rewarded" value={stats.rewarded_referrals.toLocaleString()} /><Card label="Commission paid" value={`₦${Number(stats.total_commission).toLocaleString()}`} /></div><div className="mt-4 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800"><b>Commission rule:</b> ₦300 is automatically credited to the referrer’s wallet when the referred customer completes a successful Premium subscription payment. Each referral can earn the commission only once.</div><div className="mt-5 overflow-x-auto">{loading ? <div className="py-10 text-center text-gray-500">Loading…</div> : rows.length === 0 ? <div className="py-10 text-center text-gray-500">No referrals yet.</div> : <table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500"><th className="p-3">Referrer</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3">Commission</th><th className="p-3">Date</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b last:border-0"><td className="p-3 font-semibold">{r.referrer_name || 'Unnamed'}</td><td className="p-3">{r.referred_name || 'Unnamed'}</td><td className="p-3 capitalize">{r.status}</td><td className="p-3 font-semibold">₦{Number(r.reward_amount || 0).toLocaleString()}</td><td className="p-3 text-gray-500">{new Date(r.rewarded_at || r.created_at).toLocaleString()}</td></tr>)}</tbody></table>}</div></div></div></div>;
}
function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border p-4"><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-bold mt-1">{value}</div></div>; }
