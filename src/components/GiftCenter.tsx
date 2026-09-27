import { useEffect, useMemo, useState } from 'react';
import { Crown, Gift, Loader2, Search, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const PLANS = [
  { id: 'weekly', label: '7 Days Premium' },
  { id: 'monthly', label: '30 Days Premium' },
  { id: 'quarterly', label: '90 Days Premium' },
];

export default function GiftCenter({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [plan, setPlan] = useState('monthly');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('is_visible', true).order('display_name').limit(100);
      if (!active) return;
      if (error) setMessage('Unable to load people right now.');
      setProfiles((data ?? []) as Profile[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => profiles.filter((p) => (p.display_name ?? '').toLowerCase().includes(search.trim().toLowerCase())), [profiles, search]);

  const sendGift = async () => {
    if (!selected || sending) return;
    setSending(true);
    setMessage(null);
    const requestId = crypto.randomUUID();
    try {
      const { data, error } = await supabase.rpc('gift_subscription', {
        p_recipient_id: selected.id,
        p_plan: plan,
        p_request_id: requestId,
      });
      if (error || !data || data.success === false) {
        setMessage((data?.error as string) || error?.message || 'Gift could not be sent. Check your wallet balance.');
        return;
      }
      setMessage(`Premium gift sent to ${selected.display_name}.`);
      setSelected(null);
    } finally {
      setSending(false);
    }
  };

  return <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"><div className="w-full max-w-md max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
    <header className="px-5 py-4 border-b flex items-center justify-between"><div><div className="flex items-center gap-2 font-bold text-gray-900"><Gift className="w-5 h-5 text-rose-500" /> Gift Center</div><p className="text-xs text-gray-500 mt-1">Gift Premium using your wallet balance.</p></div><button onClick={onClose} className="p-2 text-gray-400"><X className="w-5 h-5" /></button></header>
    <div className="p-4 border-b"><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a person" className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-rose-400" /></div><div className="flex gap-2 mt-3 overflow-x-auto">{PLANS.map((item) => <button key={item.id} onClick={() => setPlan(item.id)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${plan === item.id ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{item.label}</button>)}</div></div>
    <div className="overflow-y-auto p-4 flex-1">{loading ? <div className="py-12 flex justify-center"><Loader2 className="w-7 h-7 text-rose-500 animate-spin" /></div> : filtered.length === 0 ? <div className="py-12 text-center text-sm text-gray-500">No people found.</div> : <div className="space-y-2">{filtered.map((p) => <button key={p.id} onClick={() => setSelected(p)} className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 p-3 text-left hover:bg-rose-50"><div className="w-11 h-11 rounded-full overflow-hidden bg-rose-100 shrink-0">{p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Crown className="w-5 h-5 text-rose-300" /></div>}</div><div className="min-w-0 flex-1"><div className="font-semibold text-sm text-gray-900 truncate">{p.display_name}</div><div className="text-xs text-gray-500">{p.city || 'FlirtHub member'}</div></div><Send className="w-4 h-4 text-rose-500" /></button>)}</div>}{message && <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700">{message}</div>}</div>
    {selected && <div className="p-4 border-t bg-gray-50"><div className="text-sm font-semibold text-gray-900">Gift {selected.display_name} {PLANS.find((p) => p.id === plan)?.label}</div><div className="text-xs text-gray-500 mt-1">The gift uses your wallet balance. Paystack is used to fund the wallet.</div><div className="flex gap-2 mt-3"><button disabled={sending} onClick={() => setSelected(null)} className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold">Cancel</button><button disabled={sending} onClick={() => void sendGift()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-semibold disabled:opacity-60">{sending ? 'Sending…' : 'Send gift'}</button></div></div>}
  </div></div>;
}
