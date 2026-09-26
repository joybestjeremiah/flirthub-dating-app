import { useEffect, useState } from 'react';
import { Loader2, Wallet, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface WalletModalProps { onClose: () => void; }

export default function WalletModal({ onClose }: WalletModalProps) {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('wallets').select('balance').maybeSingle();
    setBalance(Number(data?.balance ?? 0));
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const txRef = params.get('tx_ref');
    const reference = params.get('reference') || txRef;
    const transactionId = params.get('transaction_id');
    const status = params.get('status');
    if (reference && status === 'successful') {
      setLoading(true);
      supabase.functions.invoke('verify-wallet-topup', { body: { reference, transaction_id: transactionId || undefined } })
        .then(({ data, error }) => {
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error ?? 'Payment could not be verified.');
          setSuccess(true);
          window.history.replaceState({}, '', window.location.pathname);
          return load();
        })
        .catch((e) => setMessage(e instanceof Error ? e.message : 'Payment verification failed.'))
        .finally(() => setLoading(false));
    }
  }, []);

  const fund = async () => {
    setMessage('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100) { setMessage('Minimum funding amount is ₦100.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-wallet-topup', { body: { amount: value } });
      if (error) throw error;
      if (!data?.checkoutUrl) throw new Error(data?.error ?? 'Unable to start payment.');
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to start payment.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div><div className="flex items-center gap-2 font-bold text-gray-900"><Wallet className="w-5 h-5 text-rose-500" /> Wallet</div><p className="text-sm text-gray-500 mt-1">Balance: <span className="font-semibold text-gray-900">₦{balance.toLocaleString()}</span></p></div>
          <button onClick={onClose} className="p-2 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {success && <div className="rounded-xl bg-green-50 text-green-700 px-4 py-3 flex items-center gap-2 text-sm"><CheckCircle2 className="w-5 h-5" /> Wallet funded successfully.</div>}
          <label className="block text-sm font-medium text-gray-700">Amount to fund</label>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="e.g. 5000" className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-rose-200" />
          {message && <p className="text-sm text-red-600">{message}</p>}
          <button onClick={fund} disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold py-3 disabled:opacity-60">{loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Continue to Paystack'}</button>
          <p className="text-xs text-gray-400 text-center">Payments are processed securely by Paystack.</p>
        </div>
      </div>
    </div>
  );
}