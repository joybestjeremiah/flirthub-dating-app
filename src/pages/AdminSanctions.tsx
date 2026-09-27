import { useState } from 'react';
import { ArrowLeft, Ban, EyeOff, RotateCcw, Search, ShieldAlert, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props { onBack: () => void; }
interface UserRow { user_id: string; display_name: string | null; city: string | null; age: number | null; balance: number; }

type SanctionAction = 'suspended' | 'hidden' | 'active';

export default function AdminSanctions({ onBack }: Props) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [reason, setReason] = useState('Admin moderation');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const searchUsers = async () => {
    setMessage(null);
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() });
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    setUsers((data ?? []) as UserRow[]);
    setSelected(null);
  };

  const sanction = async (action: SanctionAction) => {
    if (!selected) {
      setMessage({ ok: false, text: 'Select a user first.' });
      return;
    }

    const label = action === 'suspended' ? 'Suspend' : action === 'hidden' ? 'Hide from Discover' : 'Restore';
    const cleanReason = reason.trim() || 'Admin moderation';
    if (!window.confirm(`${label} ${selected.display_name || 'this user'}?\n\nReason: ${cleanReason}`)) return;

    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_moderate_user', {
      p_user_id: selected.user_id,
      p_action: action,
      p_reason: cleanReason,
    });
    setBusy(false);

    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }

    setMessage({ ok: true, text: `${label} completed successfully.` });
    await searchUsers();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10" aria-label="Back to admin">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-bold">User Sanctions</span>
            </div>
          </div>
          <span className="text-xs text-white/60">Admin only</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <section className="rounded-2xl bg-white border p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sanction a user</h1>
              <p className="text-sm text-gray-500 mt-1">Search for a user, select them, choose an action, and record the reason.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center border rounded-xl bg-gray-50 px-3">
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void searchUsers(); }}
                placeholder="Search user name or city"
                className="w-full bg-transparent py-3 outline-none text-sm"
              />
            </div>
            <button onClick={() => void searchUsers()} disabled={busy} className="rounded-xl bg-gray-900 text-white px-5 py-3 font-semibold disabled:opacity-50">
              Search
            </button>
          </div>

          {users.length > 0 && (
            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.user_id}
                  onClick={() => setSelected(user)}
                  className={`w-full text-left rounded-xl border p-3 transition ${selected?.user_id === user.user_id ? 'border-rose-400 bg-rose-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="font-semibold text-gray-900">{user.display_name || 'Unnamed user'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {user.city || 'No city'}{user.age ? ` • ${user.age} years` : ''} • Balance ₦{Number(user.balance || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 break-all">{user.user_id}</div>
                </button>
              ))}
            </div>
          )}

          {users.length === 0 && query.trim() && (
            <p className="mt-4 text-sm text-gray-500">No matching users found.</p>
          )}

          {selected && (
            <div className="mt-5 rounded-2xl bg-gray-50 border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900">Selected: {selected.display_name || 'Unnamed user'}</div>
                  <div className="text-xs text-gray-500 mt-1">{selected.user_id}</div>
                </div>
                <UserCheck className="w-5 h-5 text-gray-400" />
              </div>

              <label className="block mt-4 text-sm font-semibold text-gray-700">Reason</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                className="w-full mt-2 rounded-xl border px-3 py-3 bg-white outline-none focus:border-rose-400"
                placeholder="Reason for the sanction"
              />

              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                <button disabled={busy} onClick={() => void sanction('suspended')} className="rounded-xl bg-red-600 text-white py-3 font-semibold disabled:opacity-50">
                  {busy ? <Loader2 className="inline w-4 h-4 mr-1 animate-spin" /> : <Ban className="inline w-4 h-4 mr-1" />}
                  Suspend
                </button>
                <button disabled={busy} onClick={() => void sanction('hidden')} className="rounded-xl bg-amber-500 text-white py-3 font-semibold disabled:opacity-50">
                  <EyeOff className="inline w-4 h-4 mr-1" />Hide from Discover
                </button>
                <button disabled={busy} onClick={() => void sanction('active')} className="rounded-xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50">
                  <RotateCcw className="inline w-4 h-4 mr-1" />Restore
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
