import { useEffect, useState } from 'react';
import { ArrowLeft, Wallet, Gift, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type Earnings = { available_balance: number; lifetime_earned: number; lifetime_withdrawn: number };
type Withdrawal = { id: string; amount: number; status: string; payout_method: string; account_name: string; account_number: string; bank_name: string | null; requested_at: string; admin_note: string | null };

export default function HostEarningsPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);\n  const [ledger, setLedger] = useState<Array<{ id: string; gross_amount: number; platform_fee: number; net_amount: number; created_at: string }>>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: e }, { data: w }, { data: l }] = await Promise.all([
      supabase.from('host_earnings').select('available_balance,lifetime_earned,lifetime_withdrawn').eq('user_id', user.id).maybeSingle(),
      supabase.from('host_withdrawals').select('id,amount,status,payout_method,account_name,account_number,bank_name,requested_at,admin_note').eq('host_id', user.id).order('requested_at', { ascending: false }).limit(20),\n      supabase.from('host_earning_ledger').select('id,gross_amount,platform_fee,net_amount,created_at').eq('host_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setEarnings((e as Earnings | null) ?? { available_balance: 0, lifetime_earned: 0, lifetime_withdrawn: 0 });
    setWithdrawals((w || []) as Withdrawal[]);\n    setLedger((l || []) as typeof ledger);
  };
  useEffect(() => { load(); }, [user?.id]);

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 5000) { setMessage('Minimum withdrawal is ₦5,000.'); return; }
    setBusy(true); setMessage(null);
    const { error } = await supabase.rpc('request_host_withdrawal', {
      p_amount: value, p_payout_method: 'bank', p_account_name: accountName, p_account_number: accountNumber, p_bank_name: bankName || null, p_bank_code: bankCode,
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setAmount(''); setAccountName(''); setAccountNumber(''); setBankName(''); setBankCode('');
    setMessage('Withdrawal request submitted. Your earnings are reserved while it is reviewed.');
    await load();
  };

  return <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3"><button onClick={onBack} className="p-2"><ArrowLeft className="w-5 h-5" /></button><h1 className="font-bold text-lg">Host Earnings</h1></div>
    </header>
    <main className="max-w-md mx-auto px-4 py-5 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[['Available', earnings?.available_balance || 0], ['Earned', earnings?.lifetime_earned || 0], ['Withdrawn', earnings?.lifetime_withdrawn || 0]].map(([label, value]) => <div key={String(label)} className="bg-white rounded-2xl border border-gray-100 p-3"><div className="text-[11px] text-gray-500">{label}</div><div className="text-lg font-bold text-gray-900 mt-1">₦{Number(value).toLocaleString()}</div></div>)}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 font-bold text-gray-900 mb-1"><Wallet className="w-5 h-5 text-rose-500" /> Request withdrawal</div>
        <p className="text-xs text-gray-500 mb-4">Minimum ₦5,000. FlirtHub reviews requests before payout.</p>
        {message && <div className="mb-3 rounded-xl bg-amber-50 text-amber-800 text-xs p-3">{message}</div>}
        <form onSubmit={requestWithdrawal} className="space-y-3">
          <input required type="number" min="5000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (NGN)" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input required value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Account name" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input required value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} placeholder="Account number" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="Bank name" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input required value={bankCode} onChange={e=>setBankCode(e.target.value)} placeholder="Paystack bank code" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <button disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold disabled:opacity-50">{busy ? 'Submitting...' : 'Request payout'}</button>
        </form>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 font-bold text-gray-900 mb-3"><Gift className="w-5 h-5 text-rose-500" /> Withdrawal history</div>
        <div className="space-y-2">{withdrawals.length === 0 ? <p className="text-sm text-gray-400">No withdrawals yet.</p> : withdrawals.map(w => <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"><div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">{w.status==='paid'?<CheckCircle className="w-4 h-4 text-green-600" />:w.status==='rejected'?<XCircle className="w-4 h-4 text-red-500" />:<Clock className="w-4 h-4 text-amber-500" />}</div><div className="flex-1"><div className="font-semibold text-sm">₦{Number(w.amount).toLocaleString()}</div><div className="text-xs text-gray-500 capitalize">{w.status} · {new Date(w.requested_at).toLocaleDateString()}</div></div></div>)}</div>
      </div>
    </main>
  </div>;
}
