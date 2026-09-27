import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Gift, Loader2, Wallet, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Entry { id: string; type: string; amount: number; description: string; created_at: string; positive: boolean; }

export default function WalletHistoryModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [{ data: wallet, error: walletError }, { data: ledger, error: ledgerError }] = await Promise.all([
        supabase.from('wallets').select('balance').maybeSingle(),
        supabase.from('wallet_ledger').select('id,type,amount,description,created_at').order('created_at', { ascending: false }).limit(50),
      ]);
      if (!active) return;
      if (walletError || ledgerError) setError('Unable to load wallet history.');
      setBalance(Number(wallet?.balance ?? 0));
      setEntries((ledger ?? []).map((row) => ({ id: row.id, type: String(row.type ?? 'transaction'), amount: Number(row.amount ?? 0), description: String(row.description ?? 'Wallet transaction'), created_at: row.created_at, positive: Number(row.amount ?? 0) > 0 })));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  return <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"><div className="w-full max-w-md max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
    <header className="px-5 py-4 border-b flex items-center justify-between"><div><div className="flex items-center gap-2 font-bold text-gray-900"><Wallet className="w-5 h-5 text-rose-500" /> Wallet history</div><div className="text-sm text-gray-500 mt-1">Balance <span className="font-bold text-gray-900">₦{balance.toLocaleString()}</span></div></div><button onClick={onClose} className="p-2 text-gray-400"><X className="w-5 h-5" /></button></header>
    <div className="overflow-y-auto p-4">{loading ? <div className="py-12 flex justify-center"><Loader2 className="w-7 h-7 text-rose-500 animate-spin" /></div> : error ? <div className="py-10 text-center text-sm text-red-600">{error}</div> : entries.length === 0 ? <div className="py-12 text-center text-sm text-gray-500">No wallet transactions yet.</div> : <div className="space-y-2">{entries.map((entry) => <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.positive ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>{entry.type.toLowerCase().includes('gift') ? <Gift className="w-5 h-5" /> : entry.positive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}</div><div className="min-w-0 flex-1"><div className="font-semibold text-sm text-gray-900 truncate">{entry.description}</div><div className="text-[11px] text-gray-400">{new Date(entry.created_at).toLocaleString()}</div></div><div className={`font-bold text-sm ${entry.positive ? 'text-green-600' : 'text-gray-900'}`}>{entry.positive ? '+' : ''}₦{Math.abs(entry.amount).toLocaleString()}</div></div>)}</div>}</div>
  </div></div>;
}
