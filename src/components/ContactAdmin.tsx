import { Mail, MessageCircle, X, Headphones } from 'lucide-react';
import { useState } from 'react';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() || 'airtimeodogiyon@gmail.com';
const ADMIN_WHATSAPP = (import.meta.env.VITE_ADMIN_WHATSAPP as string | undefined)?.trim() || '+2347031261521';

export default function ContactAdmin() {
  const [open, setOpen] = useState(false);
  const whatsapp = ADMIN_WHATSAPP.replace(/[^0-9]/g, '');

  return (
    <section className="mt-5 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(true)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-rose-50/50">
        <span className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center"><Headphones className="w-5 h-5 text-rose-600" /></span>
        <span className="flex-1"><span className="block font-semibold text-gray-900">Help & Support</span><span className="block text-xs text-gray-500 mt-0.5">Contact FlirtHub Admin</span></span>
        <span className="text-gray-400 text-lg">›</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div><h2 className="font-bold text-gray-900">Help & Support</h2><p className="text-xs text-gray-500 mt-0.5">We're here to help with your FlirtHub account.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-gray-500 hover:text-gray-900" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <a href={`mailto:${ADMIN_EMAIL}`} className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 hover:bg-rose-50/50">
                <span className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center"><Mail className="w-5 h-5 text-rose-600" /></span>
                <span><span className="block text-xs text-gray-500">Email Support</span><span className="block font-semibold text-gray-900 break-all">{ADMIN_EMAIL}</span></span>
              </a>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 hover:bg-green-50/50">
                <span className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-green-600" /></span>
                <span><span className="block text-xs text-gray-500">WhatsApp Support</span><span className="block font-semibold text-gray-900">+234 703 126 1521</span></span>
              </a>
              <p className="text-[11px] text-gray-400 text-center pt-2">Account, payment, wallet, safety and technical support.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
