import AdminPanel from './AdminPanel';
import AdminSanctionsOverlay from '@/components/AdminSanctionsOverlay';

interface Props { onBack: () => void; }

export default function AdminPanelWithSanctions({ onBack }: Props) {
  return (
    <>
      <AdminPanel onBack={onBack} />
      <AdminSanctionsOverlay />
    </>
  );
}
