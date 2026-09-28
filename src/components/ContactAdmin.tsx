import { Mail, MessageCircle, X, Headphones } from 'lucide-react';
import { useState } from 'react';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() || 'airtimeodogiyon@gmail.com';
const ADMIN_WHATSAPP = (import.meta.env.VITE_ADMIN_WHATSAPP as string | undefined)?.trim() || '+2347031261521';

export default function ContactAdmin() {
  const [open, setOpen] = useState(false);
  const whatsapp = ADMIN_WHATSAPP.replace(/[^0-9]/g, '');

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Contact Admin" className="fixed bottom-24 right-4 z-[70] flex items-center gap-2 rounded-full bg-gray-900 px-4 py-3 text-white text-sm font-semibold shadow-xl hover:bg-gray-800">
        <Headphones className="w-4 h-4" /> Contact Admin
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div><h2 className="font-bold text-gray-900">Contact Admin</h2><p className="text-xs text-gray-500 mt-0.5">Need help with your FlirtHub account?</p></div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-gray-500 hover:text-gray-900" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <a href={`mailto:${ADMIN_EMAIL}`} className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50">
                <span className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center"><Mail className="w-5 h-5 text-rose-600" /></span>
                <span><span className="block text-xs text-gray-500">Email Admin</span><span className="block font-semibold text-gray-900 break-all">{ADMIN_EMAIL}</span></span>
              </a>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-gray-50">
                <span className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-green-600" /></span>
                <span><span className="block text-xs text-gray-500">WhatsApp Admin</span><span className="block font-semibold text-gray-900">+234 703 126 1521</span></span>
              </a>
              <p className="text-[11px] text-gray-400 text-center pt-2">For account, payment, wallet, safety or technical support.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
