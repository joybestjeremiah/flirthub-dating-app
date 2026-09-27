import { useState } from 'react';
import { Ban, EyeOff, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserRow { user_id: string; display_name: string | null; city: string | null; age: number | null; balance: number; }

export default function AdminSanctionsOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [reason, setReason] = useState('Admin moderation');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const searchUsers = async () => {
    setMessage(null);
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() });
    if (error) return setMessage(error.message);
    setUsers((data ?? []) as UserRow[]);
  };

  const moderate = async (action: 'suspended' | 'hidden' | 'active') => {
    if (!selected) return setMessage('Select a user first.');
    if (!window.confirm(`${action === 'suspended' ? 'Suspend' : action === 'hidden' ? 'Hide from Discover' : 'Restore'} ${selected.display_name || 'this user'}?`)) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.rpc('admin_moderate_user', {
      p_user_id: selected.user_id,
      p_action: action,
      p_reason: reason.trim() || 'Admin moderation',
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage(action === 'suspended' ? 'User suspended.' : action === 'hidden' ? 'User hidden from Discover.' : 'User restored.');
    await searchUsers();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed right-4 bottom-6 z-[80] flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-white font-bold shadow-2xl hover:bg-red-700" title="User sanctions">
        <ShieldAlert className="w-5 h-5" /> User sanctions
      </button>
      {open && <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-3">
        <div className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
            <div><h2 className="font-bold text-lg text-gray-900">User sanctions</h2><p className="text-xs text-gray-500">Suspend, hide or restore users.</p></div>
            <button onClick={() => setOpen(false)} className="p-2 text-gray-500"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center border rounded-xl px-3 bg-gray-50"><Search className="w-4 h-4 text-gray-400 mr-2" /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchUsers(); }} placeholder="Search name or city" className="w-full py-3 bg-transparent outline-none text-sm" /></div>
              <button onClick={() => void searchUsers()} className="rounded-xl bg-gray-900 text-white px-4 font-semibold">Search</button>
            </div>
            {users.length > 0 && <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">{users.map(u => <button key={u.user_id} onClick={() => setSelected(u)} className={`w-full text-left rounded-xl border p-3 ${selected?.user_id === u.user_id ? 'border-red-400 bg-red-50' : 'border-gray-100'}`}><div className="font-semibold text-gray-900">{u.display_name || 'Unnamed user'}</div><div className="text-xs text-gray-500">{u.city || 'No city'}{u.age ? ` • ${u.age} years` : ''}</div></button>)}</div>}
            {selected && <div className="mt-4 rounded-xl border bg-gray-50 p-4"><div className="font-semibold">Selected: {selected.display_name || 'Unnamed user'}</div><div className="text-xs text-gray-500 mt-1 break-all">{selected.user_id}</div><input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="Reason" className="mt-3 w-full rounded-xl border px-3 py-3 bg-white" /><div className="grid grid-cols-3 gap-2 mt-3"><button disabled={busy} onClick={() => void moderate('suspended')} className="rounded-xl bg-red-600 text-white py-3 text-xs font-bold disabled:opacity-50"><Ban className="inline w-4 h-4 mr-1" />Suspend</button><button disabled={busy} onClick={() => void moderate('hidden')} className="rounded-xl bg-amber-500 text-white py-3 text-xs font-bold disabled:opacity-50"><EyeOff className="inline w-4 h-4 mr-1" />Hide</button><button disabled={busy} onClick={() => void moderate('active')} className="rounded-xl bg-emerald-600 text-white py-3 text-xs font-bold disabled:opacity-50"><RotateCcw className="inline w-4 h-4 mr-1" />Restore</button></div></div>}
            {message && <div className="mt-3 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">{message}</div>}
          </div>
        </div>
      </div>}
    </>
  );
}
