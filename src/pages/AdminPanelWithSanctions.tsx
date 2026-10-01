import { useState } from 'react';
import AdminPanel from './AdminPanel';
import AdminSanctionsOverlay from '@/components/AdminSanctionsOverlay';
import AdminReferralPanel from '@/components/AdminReferralPanel';

interface Props { onBack: () => void; }

export default function AdminPanelWithSanctions({ onBack }: Props) {
  const [showReferrals, setShowReferrals] = useState(false);
  return (
    <>
      <AdminPanel onBack={onBack} />
      <div className="fixed right-4 bottom-4 z-[70]">
        <button onClick={() => setShowReferrals(true)} className="rounded-full bg-rose-600 text-white px-5 py-3 font-semibold shadow-xl">Referral Commissions</button>
      </div>
      {showReferrals && <AdminReferralPanel onClose={() => setShowReferrals(false)} />}
      <AdminSanctionsOverlay />
    </>
  );
}
