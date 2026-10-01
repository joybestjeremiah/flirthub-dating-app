import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Gift, Share2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function ReferralPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from('profiles').select('referral_code').eq('id', user.id).maybeSingle();
      if (profile?.referral_code) setCode(profile.referral_code);
      const { count: referrals } = await supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id);
      setCount(referrals ?? 0);
    })();
  }, [user?.id]);

  const link = code ? `${window.location.origin}/?ref=${encodeURIComponent(code)}` : '';
  const copy = async () => { if (!link) return; await navigator.clipboard.writeText(link); setMessage('Referral link copied.'); };
  const share = async () => {
    if (!link) return;
    if (navigator.share) await navigator.share({ title: 'Join FlirtHub', text: 'Join me on FlirtHub — meet people, chat and make connections.', url: link });
    else await copy();
  };

  return <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 px-4 py-6">
    <div className="max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 mb-6"><ArrowLeft className="w-5 h-5" /> Back</button>
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mb-4"><Gift className="w-7 h-7 text-rose-600" /></div>
        <h1 className="text-2xl font-bold text-gray-900">Invite friends</h1>
        <p className="text-sm text-gray-500 mt-2">Share your FlirtHub referral link and invite genuine friends to join.</p>
        <div className="mt-6 rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-500">Your referral code</div><div className="text-xl font-bold text-rose-600 mt-1">{code || 'Generating...'}</div></div>
        <div className="mt-4 flex gap-2"><button onClick={() => void copy()} className="flex-1 rounded-xl bg-gray-900 text-white py-3 font-semibold flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> Copy link</button><button onClick={() => void share()} className="flex-1 rounded-xl bg-rose-600 text-white py-3 font-semibold flex items-center justify-center gap-2"><Share2 className="w-4 h-4" /> Share</button></div>
        {message && <div className="text-sm text-emerald-600 mt-3">{message}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-gray-100 p-4"><Users className="w-5 h-5 text-rose-500" /><div className="text-2xl font-bold mt-2">{count}</div><div className="text-xs text-gray-500">Friends referred</div></div><div className="rounded-2xl border border-gray-100 p-4"><Gift className="w-5 h-5 text-amber-500" /><div className="text-sm font-bold mt-2">Rewards</div><div className="text-xs text-gray-500">Admin can configure rewards</div></div></div>
      </div>
    </div>
  </div>;
}
