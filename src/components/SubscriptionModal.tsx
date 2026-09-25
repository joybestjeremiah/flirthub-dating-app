import { useState } from 'react';
import { Crown, Check, Loader2, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLAN_PRICES, PLAN_DURATIONS, PLAN_LABELS, type PlanKey } from '@/lib/types';

interface Props {
  onClose: () => void;
  reason?: string;
}

export default function SubscriptionModal({ onClose, reason }: Props) {
  const { user, refreshSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubscribe = async () => {
    if (!user || !selectedPlan) return;
    setBusy(true);
    setError(null);

    const days = PLAN_DURATIONS[selectedPlan];
    const expires = new Date();
    expires.setDate(expires.getDate() + days);

    const { error: insertError } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan: selectedPlan,
      amount: PLAN_PRICES[selectedPlan],
      status: 'pending',
      starts_at: new Date().toISOString(),
      expires_at: expires.toISOString(),
    });

    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(true);
    await refreshSubscription();
    setTimeout(onClose, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="relative bg-gradient-to-br from-rose-500 via-pink-600 to-orange-500 px-6 py-8 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur mb-3">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Go Premium</h2>
          <p className="text-white/80 text-sm mt-1">Unlock chat, calls & private rooms</p>
        </div>

        <div className="p-6">
          {reason && (
            <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3 text-center font-medium">
              {reason}
            </div>
          )}

          {success ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-3">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Request Submitted!</h3>
              <p className="text-gray-500 text-sm mt-1">Your subscription is pending admin approval.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  Unlimited chat messaging
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  Audio & video calls
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  Create & join private rooms
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <button
                  onClick={() => setSelectedPlan('weekly')}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedPlan === 'weekly'
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-gray-200 hover:border-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{PLAN_LABELS.weekly}</div>
                      <div className="text-sm text-gray-500">7-day access</div>
                    </div>
                    <div className="text-2xl font-bold text-rose-600">
                      ₦{PLAN_PRICES.weekly.toLocaleString()}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedPlan('monthly')}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all relative ${
                    selectedPlan === 'monthly'
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-gray-200 hover:border-rose-300'
                  }`}
                >
                  <span className="absolute -top-2.5 right-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                    Best Value
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{PLAN_LABELS.monthly}</div>
                      <div className="text-sm text-gray-500">30-day access</div>
                    </div>
                    <div className="text-2xl font-bold text-rose-600">
                      ₦{PLAN_PRICES.monthly.toLocaleString()}
                    </div>
                  </div>
                </button>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5 mb-3">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubscribe}
                disabled={!selectedPlan || busy}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow-lg shadow-rose-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                Subscribe Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
