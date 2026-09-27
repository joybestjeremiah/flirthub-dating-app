import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Shield, Users, Crown, Wallet, Loader2, Search, PlusCircle, MinusCircle, Flag, Clock, Send, History, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Props { onBack: () => void; }
interface Stats { users: number; subscriptions: number; revenue: number; }
interface UserRow { user_id: string; display_name: string | null; city: string | null; age: number | null; balance: number; }
interface ReportRow { id: string; reporter: string; reported: string; reason: string; details: string | null; status: string; created_at: string; }
interface WithdrawalRow { id: string; host_id: string; amount: number; status: string; payout_method: string; account_name: string; account_number: string; bank_name: string | null; requested_at: string; }
interface AuditRow { id: string; admin_id: string; action: string; target_user_id: string | null; target_id: string | null; details: Record<string, unknown> | null; created_at: string; }

export default function AdminPanel({ onBack }: Props) {
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ users: 0, subscriptions: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Admin wallet adjustment');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [notifyUser, setNotifyUser] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [premiumUser, setPremiumUser] = useState('');
  const [premiumDays, setPremiumDays] = useState('30');

  const loadStats = async () => {
    const [{ count: usersCount }, { data: subs }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('amount,status'),
    ]);
    const paid = (subs ?? []).filter((s) => s.status === 'active' || s.status === 'expired');
    setStats({ users: usersCount ?? 0, subscriptions: paid.length, revenue: paid.reduce((sum, s) => sum + Number(s.amount || 0), 0) });
  };

  const loadOperations = async () => {
    const [r, w, a] = await Promise.all([
      supabase.from('reports').select('id,reporter,reported,reason,details,status,created_at').in('status', ['pending', 'investigating']).order('created_at', { ascending: false }).limit(50),
      supabase.from('host_withdrawals').select('id,host_id,amount,status,payout_method,account_name,account_number,bank_name,requested_at').in('status', ['pending', 'processing']).order('requested_at', { ascending: false }).limit(50),
      supabase.rpc('admin_audit_recent', { p_limit: 50 }),
    ]);
    if (r.error) setMessage({ ok: false, text: `Reports: ${r.error.message}` });
    if (w.error) setMessage({ ok: false, text: `Withdrawals: ${w.error.message}` });
    if (a.error) setMessage({ ok: false, text: `Audit: ${a.error.message}` });
    setReports((r.data ?? []) as ReportRow[]);
    setWithdrawals((w.data ?? []) as WithdrawalRow[]);
    setAudit((a.data ?? []) as AuditRow[]);
  };

  const refreshAll = async () => {
    setLoading(true); setMessage(null);
    await Promise.all([loadStats(), loadOperations()]);
    setLoading(false);
  };

  useEffect(() => { void refreshAll(); }, []);

  const searchUsers = async () => {
    setMessage(null);
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() });
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    setUsers((data ?? []) as UserRow[]);
  };

  const adjustWallet = async (mode: 'credit' | 'debit') => {
    if (!selected) { setMessage({ ok: false, text: 'Select a user first.' }); return; }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) { setMessage({ ok: false, text: 'Enter an amount between ₦1 and ₦10,000,000.' }); return; }
    if (!window.confirm(`${mode === 'credit' ? 'Fund' : 'Debit'} ${selected.display_name || 'this user'} by ₦${value.toLocaleString()}?`)) return;
    setBusy(true); setMessage(null);
    const result = mode === 'credit'
      ? await supabase.rpc('admin_credit_wallet', { p_user_id: selected.user_id, p_amount: value, p_reason: note.trim() || 'Admin wallet funding' })
      : await supabase.rpc('admin_debit_wallet', { p_user_id: selected.user_id, p_amount: value, p_reason: note.trim() || 'Admin wallet debit' });
    setBusy(false);
    if (result.error) { setMessage({ ok: false, text: result.error.message }); return; }
    setAmount('');
    await searchUsers();
    setMessage({ ok: true, text: mode === 'credit' ? 'Wallet funded successfully.' : 'Wallet debited successfully.' });
    await refreshAll();
  };

  const reviewReport = async (id: string, status: 'investigating' | 'resolved' | 'dismissed') => {
    setBusy(true); const { error } = await supabase.rpc('admin_review_report', { p_report_id: id, p_status: status, p_note: 'Reviewed by admin' }); setBusy(false);
    if (error) setMessage({ ok: false, text: error.message }); else { setMessage({ ok: true, text: 'Report updated.' }); await loadOperations(); }
  };

  const moderateUser = async (id: string, action: 'active' | 'suspended' | 'hidden') => {
    if (!window.confirm(`${action === 'suspended' ? 'Suspend' : action === 'hidden' ? 'Hide' : 'Restore'} this user?`)) return;
    setBusy(true); const { error } = await supabase.rpc('admin_moderate_user', { p_user_id: id, p_action: action, p_reason: 'Admin moderation' }); setBusy(false);
    if (error) setMessage({ ok: false, text: error.message }); else { setMessage({ ok: true, text: `User ${action}.` }); await loadOperations(); }
  };

  const processWithdrawal = async (id: string, status: 'approved' | 'rejected') => {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this withdrawal?`)) return;
    setBusy(true); const { error } = await supabase.rpc('admin_process_host_withdrawal', { p_withdrawal_id: id, p_status: status, p_admin_note: `Withdrawal ${status} by admin` }); setBusy(false);
    if (error) setMessage({ ok: false, text: error.message }); else { setMessage({ ok: true, text: `Withdrawal ${status}.` }); await loadOperations(); }
  };

  const sendNotification = async () => {
    if (!notifyUser.trim() || !notifyTitle.trim() || !notifyBody.trim()) { setMessage({ ok: false, text: 'Enter user ID, title and message.' }); return; }
    setBusy(true); const { error } = await supabase.rpc('admin_send_notification', { p_user_id: notifyUser.trim(), p_title: notifyTitle.trim(), p_body: notifyBody.trim(), p_type: 'admin' }); setBusy(false);
    if (error) setMessage({ ok: false, text: error.message }); else { setMessage({ ok: true, text: 'Notification sent.' }); setNotifyUser(''); setNotifyTitle(''); setNotifyBody(''); }
  };

  const broadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) { setMessage({ ok: false, text: 'Enter a broadcast title and message.' }); return; }
    if (!window.confirm('Send this announcement to all users?')) return;
    setBusy(true); const { data, error } = await supabase.rpc('admin_broadcast_notification', { p_title: broadcastTitle.trim(), p_body: broadcastBody.trim() }); setBusy(false);
    if (error) setMessage({ ok: false, text: error.message }); else { setMessage({ ok: true, text: `Announcement sent to ${Number(data ?? 0).toLocaleString()} users.` }); setBroadcastTitle(''); setBroadcastBody(''); }
  };

  const updatePremium = async (action: 'extend' | 'cancel') => {
    if (!premiumUser.trim()) { setMessage({ ok: false, text: 'Enter the user ID.' }); return; }
    const days = Number(premiumDays);
    if (action === 'extend' && (!Number.isInteger(days) || days < 1 || days > 3650)) { setMessage({ ok: false, text: 'Premium days must be between 1 and 3650.' }); return; }
    setBusy(true); const { error } = await supabase.rpc('admin_update_subscription', { p_user_id: premiumUser.trim(), p_action: action, p_days: action === 'extend' ? days : 0 }); setBusy(false);
    if (error) setMessage({ ok: false, text: error.message }); else { setMessage({ ok: true, text: action === 'extend' ? `Premium extended by ${days} days.` : 'Premium cancelled.' }); setPremiumUser(''); await loadStats(); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-gray-900 text-white"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={onBack} className="p-2"><ArrowLeft className="w-5 h-5" /></button><div className="flex items-center gap-2"><Shield className="w-5 h-5" /><span className="font-bold">Admin Operations Center</span></div></div><div className="flex items-center gap-3"><button onClick={() => void refreshAll()} className="p-2" title="Refresh"><RefreshCw className="w-4 h-4" /></button><button onClick={signOut} className="text-sm text-white/70 hover:text-white">Sign out</button></div></div></header>
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-rose-500 animate-spin" /></div> : <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Card icon={<Users className="w-5 h-5" />} label="Users" value={stats.users.toLocaleString()} /><Card icon={<Crown className="w-5 h-5" />} label="Paid subscriptions" value={stats.subscriptions.toLocaleString()} /><Card icon={<Wallet className="w-5 h-5" />} label="Subscription revenue" value={`₦${stats.revenue.toLocaleString()}`} /></div>

          <section className="mt-6 rounded-2xl bg-white border p-5"><h2 className="font-bold flex items-center gap-2"><Wallet className="w-5 h-5 text-rose-600" />Wallet management</h2><p className="text-sm text-gray-500 mt-1">Authorized admin wallet adjustments.</p><div className="mt-3 flex flex-col sm:flex-row gap-2"><div className="flex-1 flex items-center border rounded-xl bg-gray-50 px-3"><Search className="w-4 h-4 text-gray-400 mr-2" /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchUsers(); }} placeholder="Search name or city" className="w-full bg-transparent py-3 outline-none text-sm" /></div><button onClick={() => void searchUsers()} className="rounded-xl bg-gray-900 text-white px-5 py-3 font-semibold">Search</button></div>{users.length > 0 && <div className="mt-4 space-y-2 max-h-64 overflow-auto">{users.map(u => <button key={u.user_id} onClick={() => setSelected(u)} className={`w-full text-left rounded-xl border p-3 ${selected?.user_id === u.user_id ? 'border-rose-400 bg-rose-50' : 'border-gray-100'}`}><div className="font-semibold">{u.display_name || 'Unnamed user'}</div><div className="text-xs text-gray-500">{u.city || 'No city'} • Balance ₦{Number(u.balance || 0).toLocaleString()}</div></button>)}</div>}{selected && <div className="mt-4 rounded-xl bg-gray-50 p-4"><b>Selected: {selected.display_name || 'Unnamed user'}</b><div className="text-sm text-gray-500">Current balance: ₦{Number(selected.balance || 0).toLocaleString()}</div><div className="grid sm:grid-cols-2 gap-2 mt-3"><input type="number" min="1" max="10000000" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (₦)" className="rounded-xl border px-3 py-3" /><input value={note} onChange={e => setNote(e.target.value)} placeholder="Reason" className="rounded-xl border px-3 py-3" /></div><div className="grid sm:grid-cols-2 gap-2 mt-2"><button disabled={busy} onClick={() => void adjustWallet('credit')} className="rounded-xl bg-rose-600 text-white py-3 font-semibold disabled:opacity-50"><PlusCircle className="inline w-4 h-4 mr-1" />Fund wallet</button><button disabled={busy} onClick={() => void adjustWallet('debit')} className="rounded-xl bg-gray-800 text-white py-3 font-semibold disabled:opacity-50"><MinusCircle className="inline w-4 h-4 mr-1" />Debit wallet</button></div></div>}</section>

          <section className="mt-6 rounded-2xl bg-white border p-5"><h2 className="font-bold flex items-center gap-2"><Crown className="w-5 h-5 text-rose-600" />Premium controls</h2><div className="grid sm:grid-cols-3 gap-2 mt-3"><input value={premiumUser} onChange={e => setPremiumUser(e.target.value)} placeholder="User ID" className="rounded-xl border px-3 py-3" /><input type="number" min="1" max="3650" value={premiumDays} onChange={e => setPremiumDays(e.target.value)} placeholder="Days" className="rounded-xl border px-3 py-3" /><div className="flex gap-2"><button disabled={busy} onClick={() => void updatePremium('extend')} className="flex-1 rounded-xl bg-rose-600 text-white py-3 font-semibold">Extend</button><button disabled={busy} onClick={() => void updatePremium('cancel')} className="flex-1 rounded-xl bg-gray-800 text-white py-3 font-semibold">Cancel</button></div></div></section>

          <section className="mt-6 rounded-2xl bg-white border p-5"><h2 className="font-bold flex items-center gap-2"><Flag className="w-5 h-5 text-rose-600" />Reports & moderation</h2>{reports.length === 0 ? <p className="text-sm text-gray-500 mt-3">No pending reports.</p> : <div className="mt-3 space-y-3">{reports.map(r => <div key={r.id} className="rounded-xl border p-4"><div className="font-semibold">{r.reason}</div><div className="text-xs text-gray-500 mt-1">Reported: {r.reported} • {new Date(r.created_at).toLocaleString()}</div>{r.details && <p className="text-sm mt-2">{r.details}</p>}<div className="flex flex-wrap gap-2 mt-3"><button disabled={busy} onClick={() => void reviewReport(r.id, 'investigating')} className="rounded-lg border px-3 py-2 text-sm">Investigate</button><button disabled={busy} onClick={() => void reviewReport(r.id, 'resolved')} className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm">Resolve</button><button disabled={busy} onClick={() => void reviewReport(r.id, 'dismissed')} className="rounded-lg bg-gray-800 text-white px-3 py-2 text-sm">Dismiss</button><button disabled={busy} onClick={() => void moderateUser(r.reported, 'suspended')} className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm">Suspend</button></div></div>)}</div>}</section>

          <section className="mt-6 rounded-2xl bg-white border p-5"><h2 className="font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-rose-600" />Host withdrawals</h2>{withdrawals.length === 0 ? <p className="text-sm text-gray-500 mt-3">No pending withdrawals.</p> : <div className="mt-3 space-y-3">{withdrawals.map(w => <div key={w.id} className="rounded-xl border p-4"><div className="font-semibold">₦{Number(w.amount).toLocaleString()} • {w.status}</div><div className="text-sm text-gray-500 mt-1">{w.account_name} • {w.account_number} • {w.bank_name || w.payout_method}</div><div className="flex gap-2 mt-3"><button disabled={busy} onClick={() => void processWithdrawal(w.id, 'approved')} className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm">Approve</button><button disabled={busy} onClick={() => void processWithdrawal(w.id, 'rejected')} className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm">Reject</button></div></div>)}</div>}</section>

          <section className="mt-6 rounded-2xl bg-white border p-5"><h2 className="font-bold flex items-center gap-2"><Send className="w-5 h-5 text-rose-600" />Notifications</h2><div className="grid gap-2 mt-3"><input value={notifyUser} onChange={e => setNotifyUser(e.target.value)} placeholder="User ID" className="rounded-xl border px-3 py-3" /><input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="Notification title" className="rounded-xl border px-3 py-3" /><textarea value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="Message" rows={3} className="rounded-xl border px-3 py-3" /><button disabled={busy} onClick={() => void sendNotification()} className="rounded-xl bg-gray-900 text-white py-3 font-semibold">Send to user</button></div><div className="border-t mt-5 pt-5"><div className="font-semibold">Broadcast announcement</div><div className="grid gap-2 mt-3"><input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Announcement title" className="rounded-xl border px-3 py-3" /><textarea value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} placeholder="Announcement message" rows={3} className="rounded-xl border px-3 py-3" /><button disabled={busy} onClick={() => void broadcast()} className="rounded-xl bg-rose-600 text-white py-3 font-semibold">Broadcast</button></div></div></section>

          <section className="mt-6 rounded-2xl bg-white border p-5"><h2 className="font-bold flex items-center gap-2"><History className="w-5 h-5 text-rose-600" />Admin audit log</h2>{audit.length === 0 ? <p className="text-sm text-gray-500 mt-3">No audit entries available.</p> : <div className="mt-3 space-y-2 max-h-80 overflow-auto">{audit.map(e => <div key={e.id} className="rounded-xl bg-gray-50 p-3"><div className="font-semibold text-sm">{e.action}</div><div className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString()} • Admin {e.admin_id}</div></div>)}</div>}</section>

          <div className="mt-6 rounded-2xl bg-white border p-5"><p className="font-semibold">Paystack payment system</p><p className="text-sm text-gray-500 mt-1">Payment records and subscription verification are handled through the Paystack/Supabase payment flow.</p></div>
          {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</div>}
        </>}
      </main>
    </div>
  );
}

function Card({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="bg-white rounded-2xl border p-5"><div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">{icon}</div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-gray-500 mt-1">{label}</div></div>; }
