import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Gift, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { onBack: () => void; }
interface Ledger { id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string; }
interface GiftTx { id: string; sender_id: string; recipient_id: string; plan: string; amount: number; created_at: string; }

export default function WalletHistoryPage({ onBack }: Props) {
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [gifts, setGifts] = useState<GiftTx[]>([]);
  const [balance, setBalance] = useState(0);
  const [tab, setTab] = useState<'wallet'|'gifts'>('wallet');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const [{ data: wallet }, { data: l }, { data: g }] = await Promise.all([
      supabase.from('wallets').select('balance').maybeSingle(),
      supabase.from('wallet_ledger').select('id,type,amount,balance_after,description,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('gift_transactions').select('id,sender_id,recipient_id,plan,amount,created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    setBalance(Number(wallet?.balance ?? 0));
    setLedger((l ?? []) as Ledger[]);
    setGifts((g ?? []) as GiftTx[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  return <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50"><div className="max-w-md mx-auto px-4 py-5">
    <div className="flex items-center gap-3 mb-5"><button onClick={onBack} className="p-2 rounded-xl bg-white shadow-sm"><ArrowLeft className="w-5 h-5" /></button><h1 className="text-xl font-bold">Wallet & Gifts</h1></div>
    <div className="rounded-3xl bg-gradient-to-r from-rose-500 to-pink-600 text-white p-6 shadow-lg mb-5"><div className="flex items-center gap-2 text-white/80 text-sm"><Wallet className="w-4 h-4" /> Available balance</div><div className="text-3xl font-bold mt-2">₦{balance.toLocaleString()}</div></div>
    <div className="grid grid-cols-2 bg-white rounded-xl p-1 mb-4 shadow-sm"><button onClick={() => setTab('wallet')} className={`py-2 rounded-lg text-sm font-semibold ${tab==='wallet'?'bg-rose-50 text-rose-600':''}`}>Wallet history</button><button onClick={() => setTab('gifts')} className={`py-2 rounded-lg text-sm font-semibold ${tab==='gifts'?'bg-rose-50 text-rose-600':''}`}>Gift history</button></div>
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">{loading ? <div className="p-8 text-center text-sm text-gray-500">Loading history...</div> : tab==='wallet' ? (ledger.length===0 ? <div className="p-8 text-center text-sm text-gray-500">No wallet transactions yet.</div> : ledger.map(x => <div key={x.id} className="p-4 border-b border-gray-100 flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${x.amount>=0?'bg-green-50 text-green-600':'bg-rose-50 text-rose-600'}`}>{x.amount>=0?<ArrowDownLeft className="w-5 h-5"/>:<ArrowUpRight className="w-5 h-5"/>}</div><div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{x.description || x.type}</div><div className="text-xs text-gray-400">{new Date(x.created_at).toLocaleString()}</div></div><div className={`font-bold text-sm ${x.amount>=0?'text-green-600':'text-rose-600'}`}>{x.amount>=0?'+':''}₦{Math.abs(x.amount).toLocaleString()}</div></div>)) : (gifts.length===0 ? <div className="p-8 text-center text-sm text-gray-500">No gifts yet.</div> : gifts.map(x => <div key={x.id} className="p-4 border-b border-gray-100 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center"><Gift className="w-5 h-5"/></div><div className="flex-1"><div className="font-semibold text-sm">{x.plan === 'monthly' ? 'Monthly' : 'Weekly'} Premium gift</div><div className="text-xs text-gray-400">{new Date(x.created_at).toLocaleString()}</div></div><div className="font-bold text-sm">₦{Number(x.amount).toLocaleString()}</div></div>))}</div>
  </div></div>;
}
