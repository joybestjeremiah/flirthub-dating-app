import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Shield, Users, Crown, Wallet, Loader2, Search, PlusCircle, MinusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Props { onBack: () => void; }
interface Stats { users: number; subscriptions: number; revenue: number; }
interface UserRow { user_id: string; display_name: string | null; city: string | null; age: number | null; balance: number; }

export default function AdminPanel({ onBack }: Props) {
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ users: 0, subscriptions: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Admin wallet adjustment');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStats = async () => {
    setLoading(true);
    const [{ count: usersCount }, { data: subs }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('amount,status'),
    ]);
    const paid = (subs ?? []).filter((s) => s.status === 'active' || s.status === 'expired');
    setStats({ users: usersCount ?? 0, subscriptions: paid.length, revenue: paid.reduce((sum, s) => sum + Number(s.amount || 0), 0) });
    setLoading(false);
  };

  useEffect(() => { void loadStats(); }, []);

  const searchUsers = async () => {
    setMessage(null);
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() });
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    setUsers((data ?? []) as UserRow[]);
  };

  const adjustWallet = async (mode: 'credit' | 'debit') => {
    if (!selected) { setMessage({ ok: false, text: 'Select a user first.' }); return; }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) { setMessage({ ok: false, text: 'Enter an amount between ₦1 and ₦10,000,000.' }); return; }
    const action = mode === 'credit' ? 'Fund' : 'Debit';
    if (!window.confirm(`${action} ${selected.display_name || 'this user'} ${mode === 'credit' ? 'with' : 'by'} ₦${value.toLocaleString()}?`)) return;
    setBusy(true); setMessage(null);
    const rpc = mode === 'credit'
      ? supabase.rpc('admin_credit_wallet', { p_user_id: selected.user_id, p_amount: value, p_note: note.trim() || 'Admin wallet funding' })
      : supabase.rpc('admin_debit_wallet', { p_user_id: selected.user_id, p_amount: value, p_reason: note.trim() || 'Admin wallet debit' });
    const { data, error } = await rpc;
    setBusy(false);
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    if (mode === 'credit') {
      const result = Array.isArray(data) ? data[0] : data;
      const newBalance = Number(result?.new_balance ?? 0);
      setSelected((current) => current ? { ...current, balance: newBalance } : current);
      setUsers((rows) => rows.map((u) => u.user_id === selected.user_id ? { ...u, balance: newBalance } : u));
      setMessage({ ok: true, text: `Wallet funded successfully. New balance: ₦${newBalance.toLocaleString()}` });
    } else {
      await searchUsers();
      setMessage({ ok: true, text: 'Wallet debited successfully.' });
    }
    setAmount('');
    void loadStats();
  };

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

          <section className="mt-6 rounded-2xl bg-white border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-1"><Wallet className="w-5 h-5 text-rose-600" /><h2 className="font-bold text-gray-900">Wallet management</h2></div>
            <p className="text-sm text-gray-500 mb-4">Only authorized admins can perform wallet adjustments.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center border rounded-xl bg-gray-50 px-3"><Search className="w-4 h-4 text-gray-400 mr-2" /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void searchUsers(); }} placeholder="Search name or city" className="w-full bg-transparent py-3 outline-none text-sm" /></div>
              <button onClick={() => void searchUsers()} className="rounded-xl bg-gray-900 text-white px-5 py-3 text-sm font-semibold">Search</button>
            </div>
            {users.length > 0 && <div className="mt-4 space-y-2 max-h-64 overflow-auto">{users.map((user) => <button key={user.user_id} onClick={() => { setSelected(user); setMessage(null); }} className={`w-full text-left rounded-xl border p-3 ${selected?.user_id === user.user_id ? 'border-rose-400 bg-rose-50' : 'border-gray-100 bg-white'}`}><div className="font-semibold">{user.display_name || 'Unnamed user'}</div><div className="text-xs text-gray-500">{user.city || 'No city'}{user.age ? ` • ${user.age}` : ''} • Balance ₦{Number(user.balance || 0).toLocaleString()}</div></button>)}</div>}
            {selected && <div className="mt-4 rounded-xl bg-gray-50 p-4"><div className="font-semibold">Selected: {selected.display_name || 'Unnamed user'}</div><div className="text-sm text-gray-500 mb-3">Current balance: ₦{Number(selected.balance || 0).toLocaleString()}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="number" min="1" max="10000000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₦)" className="rounded-xl border bg-white px-3 py-3 outline-none" /><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" className="rounded-xl border bg-white px-3 py-3 outline-none" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3"><button disabled={busy} onClick={() => void adjustWallet('credit')} className="rounded-xl bg-rose-600 text-white py-3 font-semibold disabled:opacity-60"><PlusCircle className="inline w-4 h-4 mr-1" />{busy ? 'Processing…' : 'Fund wallet'}</button><button disabled={busy} onClick={() => void adjustWallet('debit')} className="rounded-xl bg-gray-800 text-white py-3 font-semibold disabled:opacity-60"><MinusCircle className="inline w-4 h-4 mr-1" />{busy ? 'Processing…' : 'Debit wallet'}</button></div></div>}
            {message && <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</div>}
          </section>

          <div className="mt-6 rounded-2xl bg-white border border-gray-100 p-5"><p className="font-semibold">Paystack payment system</p><p className="text-sm text-gray-500 mt-1">Payment records and subscription verification are handled through the Paystack/Supabase payment flow.</p></div>
        </>}
      </main>
    </div>
  );
}
function Card({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-5"><div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">{icon}</div><div className="text-2xl font-bold text-gray-900">{value}</div><div className="text-sm text-gray-500 mt-1">{label}</div></div>;
}
