import { useEffect, useState } from 'react';
import { Gift, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PLAN_PRICES, PLAN_LABELS, type PlanKey } from '@/lib/types';

interface Props {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GiftSubscriptionModal({ recipientId, recipientName, onClose, onSuccess }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('weekly');
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBalance = async () => {
      const { data, error: balanceError } = await supabase
        .from('wallets')
        .select('balance')
        .maybeSingle();
      if (balanceError) setError('Unable to load your wallet balance.');
      else setBalance(Number(data?.balance ?? 0));
    };
    void loadBalance();
  }, []);

  const sendGift = async () => {
    setBusy(true);
    setError(null);
    const { error: giftError } = await supabase.rpc('gift_subscription', {
      p_recipient_id: recipientId,
      p_plan: selectedPlan,
    });
    setBusy(false);
    if (giftError) {
      setError(giftError.message.includes('Insufficient wallet balance')
        ? 'Insufficient wallet balance.'
        : giftError.message);
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-5 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <Gift className="w-8 h-8 mb-2" />
          <h2 className="text-xl font-bold">Gift Premium</h2>
          <p className="text-sm text-white/80">Send a subscription to {recipientName}</p>
        </div>
        <div className="p-5">
          <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3 text-sm">
            Wallet balance: <span className="font-bold">₦{(balance ?? 0).toLocaleString()}</span>
          </div>
          <div className="space-y-3">
            {(['weekly', 'monthly'] as PlanKey[]).map(plan => (
              <button key={plan} onClick={() => setSelectedPlan(plan)}
                className={`w-full p-4 rounded-xl border-2 text-left ${selectedPlan === plan ? 'border-rose-500 bg-rose-50' : 'border-gray-200'}`}>
                <div className="flex justify-between">
                  <span className="font-semibold">{PLAN_LABELS[plan]}</span>
                  <span className="font-bold text-rose-600">₦{PLAN_PRICES[plan].toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 text-red-600 px-3 py-2 text-sm">{error}</div>}
          <button onClick={sendGift} disabled={busy || balance === null}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
            Send Gift
          </button>
        </div>
      </div>
    </div>
  );
}
