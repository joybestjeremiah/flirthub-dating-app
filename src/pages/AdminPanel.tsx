import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Users,
  Crown,
  DollarSign,
  Heart,
  MessageCircle,
  Trash2,
  Loader2,
  Search,
  Shield,
  TrendingUp,
  Phone,
  DoorOpen,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile, Subscription, Room } from '@/lib/types';

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  totalMatches: number;
  totalMessages: number;
  totalRooms: number;
  totalCalls: number;
}

interface AdminUser extends Profile {
  email?: string;
  subscription?: Subscription | null;
}

type AdminTab = 'overview' | 'payments' | 'users' | 'subscriptions' | 'rooms' | 'reports';

interface Props {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: Props) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<(Subscription & { profile?: Profile })[]>([]);
  const [rooms, setRooms] = useState<(Room & { ownerProfile?: Profile; memberCount: number })[]>([]);
  const [reports, setReports] = useState<Array<{ id: string; reason: string; details?: string | null; reported: string; created_at: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'all' | 'successful' | 'pending' | 'failed' | 'expired'>('all');
  const [paymentRange, setPaymentRange] = useState<'7' | '30' | '365' | 'all'>('30');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadUsers(), loadSubscriptions(), loadRooms(), loadReports()]);
    setLoading(false);
  };

  const loadStats = async () => {
    const [
      { count: userCount },
      { count: matchCount },
      { count: messageCount },
      { count: roomCount },
      { count: callCount },
      { data: subData },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('calls').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('amount,status,expires_at'),
    ]);

    const now = new Date();
    const activeSubs = (subData || []).filter(
      (s) => s.status === 'active' && new Date(s.expires_at) > now
    );
    const revenue = (subData || []).filter((s) => s.status === 'active' || s.status === 'expired').reduce((sum, s) => sum + Number(s.amount), 0);

    setStats({
      totalUsers: userCount || 0,
      activeSubscriptions: activeSubs.length,
      totalRevenue: revenue,
      totalMatches: matchCount || 0,
      totalMessages: messageCount || 0,
      totalRooms: roomCount || 0,
      totalCalls: callCount || 0,
    });
  };

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const profileList = (data || []) as Profile[];

    const enriched: AdminUser[] = await Promise.all(
      profileList.map(async (p) => {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', p.id)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...p, subscription: sub as Subscription | null };
      })
    );

    setUsers(enriched);
  };

  const loadSubscriptions = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    const enriched = await Promise.all(
      ((data || []) as Subscription[]).map(async (s) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', s.user_id)
          .maybeSingle();
        return { ...s, profile: profile as Profile | undefined };
      })
    );

    setSubscriptions(enriched);
  };

  const loadReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
    setReports(data || []);
  };

  const moderateUser = async (userId: string, status: 'active' | 'suspended' | 'banned') => {
    setActionBusy(true); setActionError(null);
    const { error } = await supabase.from('profiles').update({ moderation_status: status, is_visible: status === 'active' }).eq('id', userId);
    setActionBusy(false);
    if (error) { setActionError(error.message); return; }
    await loadUsers();
    setSelectedUser(null);
  };

  const updateReport = async (reportId: string, status: 'reviewed' | 'resolved' | 'dismissed') => {
    setActionBusy(true); setActionError(null);
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
    setActionBusy(false);
    if (error) { setActionError(error.message); return; }
    await loadReports();
  };

  const loadRooms = async () => {
    const { data: roomData } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    const roomList = (roomData || []) as Room[];

    const enriched = await Promise.all(
      roomList.map(async (r) => {
        const [{ data: ownerProfile }, { count: memberCount }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', r.owner).maybeSingle(),
          supabase.from('room_members').select('*', { count: 'exact', head: true }).eq('room_id', r.id),
        ]);
        return { ...r, ownerProfile: ownerProfile as Profile | undefined, memberCount: memberCount || 0 };
      })
    );

    setRooms(enriched);
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Delete this room? This cannot be undone.')) return;
    setActionBusy(true);
    setActionError(null);
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    setActionBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    loadStats();
  };

  const handleApproveSubscription = async (sub: Subscription) => {
    if (!confirm('Approve this subscription request?')) return;
    setActionBusy(true);
    setActionError(null);
    const days = sub.plan === 'weekly' ? 7 : 30;
    const starts = new Date();
    const expires = new Date(starts);
    expires.setDate(expires.getDate() + days);
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        paid_at: sub.paid_at ?? new Date().toISOString(),
        starts_at: starts.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq('id', sub.id);
    setActionBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    await loadSubscriptions();
    await loadStats();
  };

  const handleRevokeSubscription = async (subId: string) => {
    if (!confirm('Revoke this subscription?')) return;
    setActionBusy(true);
    setActionError(null);
    const { error } = await supabase.from('subscriptions').delete().eq('id', subId);
    setActionBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    await loadSubscriptions();
    await loadStats();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user profile? Their auth account will remain but all profile data will be removed.')) return;
    setActionBusy(true);
    setActionError(null);
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    setActionBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSelectedUser(null);
    loadStats();
  };

  const handleToggleAdmin = async (user: AdminUser) => {
    setActionBusy(true);
    setActionError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !user.is_admin })
      .eq('id', user.id);
    setActionBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    await loadUsers();
    setSelectedUser(null);
  };

  const paymentRows = subscriptions.filter((s) => {
    const cutoff = paymentRange === 'all' ? 0 : Date.now() - Number(paymentRange) * 86400000;
    const created = new Date(s.created_at ?? s.starts_at ?? s.expires_at).getTime();
    if (created < cutoff) return false;
    const q = paymentSearch.trim().toLowerCase();
    const matchesSearch = !q || [s.tx_ref, s.flutterwave_transaction_id, s.profile?.display_name, s.profile?.city].some(v => String(v ?? '').toLowerCase().includes(q));
    const actual = s.status === 'active' && new Date(s.expires_at) <= new Date() ? 'expired' : s.status;
    const matchesStatus = paymentStatus === 'all' || (paymentStatus === 'successful' ? (actual === 'active' || actual === 'expired') : actual === paymentStatus);
    return matchesSearch && matchesStatus;
  });

  const paymentMetrics = (() => {
    const rows = subscriptions.map(s => ({ ...s, effectiveStatus: s.status === 'active' && new Date(s.expires_at) <= new Date() ? 'expired' : s.status }));
    const cutoff = paymentRange === 'all' ? 0 : Date.now() - Number(paymentRange) * 86400000;
    const ranged = rows.filter(s => new Date(s.created_at ?? s.starts_at ?? s.expires_at).getTime() >= cutoff);
    const paid = ranged.filter(s => s.effectiveStatus === 'active' || s.effectiveStatus === 'expired');
    return { revenue: paid.reduce((n,s) => n + Number(s.amount), 0), successful: paid.length, pending: ranged.filter(s => s.effectiveStatus === 'pending').length, failed: ranged.filter(s => s.effectiveStatus === 'failed').length, expired: ranged.filter(s => s.effectiveStatus === 'expired').length };
  })();

  const exportPaymentsCsv = () => {
    const header = ['User','Plan','Amount NGN','Status','Tx Ref','Flutterwave Transaction ID','Paid At','Created At'];
    const rows = paymentRows.map(s => [s.profile?.display_name || '', s.plan, Number(s.amount), s.status, s.tx_ref || '', s.flutterwave_transaction_id || '', s.paid_at || '', s.created_at || '']);
    const csv = [header, ...rows].map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='flirthub-payments.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.city || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin header */}
      <header className="sticky top-0 z-30 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 text-white/70 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">Admin Panel</span>
            </div>
          </div>
          <button onClick={signOut} className="text-white/60 hover:text-white text-sm font-medium">
            Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto flex gap-1 px-4">
          {([
            { key: 'overview', label: 'Overview', icon: TrendingUp },
            { key: 'payments', label: 'Payments', icon: DollarSign },
            { key: 'users', label: 'Users', icon: Users },
            { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
            { key: 'rooms', label: 'Rooms', icon: DoorOpen },
            { key: 'reports', label: 'Reports', icon: Shield },
          ] as { key: AdminTab; label: string; icon: typeof Users }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {actionError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {tab === 'payments' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div><h2 className="text-xl font-bold text-gray-900">Payment Analytics</h2><p className="text-sm text-gray-500 mt-1">Premium revenue and transaction monitoring</p></div>
              <div className="flex items-center gap-3"><button onClick={exportPaymentsCsv} className="text-sm text-gray-700 font-semibold">Export CSV</button><button onClick={loadAll} className="text-sm text-rose-600 font-semibold">Refresh</button></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <StatCard icon={DollarSign} label="Revenue" value={`₦${paymentMetrics.revenue.toLocaleString()}`} color="green" />
              <StatCard icon={CheckCircle} label="Successful" value={paymentMetrics.successful} color="rose" />
              <StatCard icon={TrendingUp} label="Pending" value={paymentMetrics.pending} color="orange" />
              <StatCard icon={XCircle} label="Failed" value={paymentMetrics.failed} color="purple" />
              <StatCard icon={Crown} label="Expired" value={paymentMetrics.expired} color="amber" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} placeholder="Search transaction ID, tx ref, or user..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-rose-400" /></div>
                <select value={paymentRange} onChange={e => setPaymentRange(e.target.value as typeof paymentRange)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last 12 months</option><option value="all">All time</option></select><select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as typeof paymentStatus)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"><option value="all">All statuses</option><option value="successful">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="expired">Expired</option></select>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[760px]"><thead className="bg-gray-50 border-b border-gray-100"><tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Transaction</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Paid</th>
              </tr></thead><tbody className="divide-y divide-gray-50">
                {paymentRows.map(s => { const effective=s.status==='active'&&new Date(s.expires_at)<=new Date()?'expired':s.status; const label=effective==='active'?'Successful':effective.charAt(0).toUpperCase()+effective.slice(1); return <tr key={s.id}><td className="px-4 py-3 text-sm font-medium text-gray-900">{s.profile?.display_name||'Unknown'}</td><td className="px-4 py-3 text-sm text-gray-600">{s.plan==='weekly'?'7 Days':'1 Month'}</td><td className="px-4 py-3 text-sm font-semibold">₦{Number(s.amount).toLocaleString()}</td><td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-lg ${effective==='active'?'bg-green-50 text-green-700':effective==='pending'?'bg-amber-50 text-amber-700':effective==='failed'?'bg-red-50 text-red-700':'bg-gray-100 text-gray-600'}`}>{label}</span></td><td className="px-4 py-3 text-xs text-gray-500 max-w-[240px]"><div className="truncate">{s.flutterwave_transaction_id||s.tx_ref||'—'}</div>{s.tx_ref&&s.flutterwave_transaction_id&&<div className="truncate text-[10px] text-gray-400">{s.tx_ref}</div>}</td><td className="px-4 py-3 text-xs text-gray-500">{s.paid_at?new Date(s.paid_at).toLocaleString():'—'}</td></tr>; })}
                {paymentRows.length===0&&<tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No matching transactions.</td></tr>}
              </tbody></table>
            </div>
          </div>
        )}

        {/* Overview */}
        {tab === 'overview' && stats && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="rose" />
              <StatCard icon={Crown} label="Active Subs" value={stats.activeSubscriptions} color="amber" />
              <StatCard icon={DollarSign} label="Revenue" value={`₦${stats.totalRevenue.toLocaleString()}`} color="green" />
              <StatCard icon={Heart} label="Matches" value={stats.totalMatches} color="pink" />
              <StatCard icon={MessageCircle} label="Messages" value={stats.totalMessages} color="blue" />
              <StatCard icon={Phone} label="Calls" value={stats.totalCalls} color="purple" />
              <StatCard icon={DoorOpen} label="Rooms" value={stats.totalRooms} color="cyan" />
              <StatCard
                icon={TrendingUp}
                label="Conversion"
                value={stats.totalUsers > 0 ? `${Math.round((stats.activeSubscriptions / stats.totalUsers) * 100)}%` : '0%'}
                color="orange"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Users</h3>
                <div className="space-y-2">
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 overflow-hidden flex-shrink-0">
                        {u.photo_url ? (
                          <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-rose-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{u.display_name}</div>
                        <div className="text-xs text-gray-400">{u.city || 'No city'}</div>
                      </div>
                      {u.is_admin && (
                        <span className="text-xs bg-rose-50 text-rose-600 font-medium px-2 py-0.5 rounded">Admin</span>
                      )}
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-sm text-gray-400">No users yet</p>}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Subscriptions</h3>
                <div className="space-y-2">
                  {subscriptions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {s.profile?.display_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-400">{s.plan === 'weekly' ? '7 Days' : '1 Month'}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-700">
                        ₦{Number(s.amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {subscriptions.length === 0 && <p className="text-sm text-gray-400">No subscriptions yet</p>}
                </div>
              </div>
            </div>
          </div>
        )}


        {tab === 'reports' && (
          <div><div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-gray-900">Safety Reports</h2><button onClick={loadReports} className="text-sm text-rose-600 font-semibold">Refresh</button></div><div className="space-y-3">{reports.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">No reports.</div> : reports.map((r) => <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-gray-900">{r.reason}</div><div className="text-xs text-gray-500 mt-1">{r.details || 'No additional details'}</div><div className="text-[11px] text-gray-400 mt-2">Reported user: {r.reported} · {new Date(r.created_at).toLocaleString()}</div></div><span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600">{r.status}</span></div><div className="flex flex-wrap gap-2 mt-3"><button onClick={() => updateReport(r.id,'reviewed')} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold">Mark reviewed</button><button onClick={() => updateReport(r.id,'resolved')} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold">Resolve</button><button onClick={() => updateReport(r.id,'dismissed')} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">Dismiss</button><button onClick={() => moderateUser(r.reported,'suspended')} className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">Suspend user</button><button onClick={() => moderateUser(r.reported,'banned')} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">Ban user</button></div></div>)}</div></div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all w-48"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subscription</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-rose-100 overflow-hidden flex-shrink-0">
                            {u.photo_url ? (
                              <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="w-4 h-4 text-rose-300" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{u.display_name}</div>
                            {u.is_admin && (
                              <span className="text-xs bg-rose-50 text-rose-600 font-medium px-1.5 py-0.5 rounded">Admin</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{u.city || '—'}</td>
                      <td className="px-4 py-3">
                        {u.subscription && new Date(u.subscription.expires_at) > new Date() ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 font-medium px-2 py-1 rounded-lg">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 font-medium px-2 py-1 rounded-lg">
                            <XCircle className="w-3.5 h-3.5" />
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="text-sm text-rose-600 font-medium hover:text-rose-700"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subscriptions */}
        {tab === 'subscriptions' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Subscriptions</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expires</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {subscriptions.map((s) => {
                    const expired = new Date(s.expires_at) < new Date();
                    const pending = s.status === 'pending';
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {s.profile?.display_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {s.plan === 'weekly' ? '7 Days' : '1 Month'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                          ₦{Number(s.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={expired ? 'text-red-500' : 'text-gray-600'}>
                            {new Date(s.expires_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pending && (
                            <button
                              onClick={() => handleApproveSubscription(s)}
                              disabled={actionBusy}
                              className="text-sm text-green-600 font-medium hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed mr-3"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleRevokeSubscription(s.id)}
                            disabled={actionBusy}
                            className="text-sm text-red-500 font-medium hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No subscriptions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rooms */}
        {tab === 'rooms' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Private Rooms</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Room Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Members</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rooms.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{r.name}</div>
                        {r.description && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">{r.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        {r.ownerProfile?.display_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.memberCount}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRoom(r.id)}
                          disabled={actionBusy}
                          className="text-sm text-red-500 font-medium hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rooms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No rooms yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* User management modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Manage User</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-rose-100 overflow-hidden flex-shrink-0">
                {selectedUser.photo_url ? (
                  <img src={selectedUser.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-7 h-7 text-rose-300" />
                  </div>
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{selectedUser.display_name}</div>
                <div className="text-sm text-gray-500">{selectedUser.city || 'No city'}</div>
                {selectedUser.is_admin && (
                  <span className="text-xs bg-rose-50 text-rose-600 font-medium px-2 py-0.5 rounded mt-1 inline-block">Admin</span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-5">
              {selectedUser.bio && <p><span className="font-medium">Bio:</span> {selectedUser.bio}</p>}
              {selectedUser.age && <p><span className="font-medium">Age:</span> {selectedUser.age}</p>}
              {selectedUser.subscription && (
                <p>
                  <span className="font-medium">Subscription:</span>{' '}
                  {new Date(selectedUser.subscription.expires_at) > new Date() ? 'Active' : 'Expired'}{' '}
                  ({selectedUser.subscription.plan === 'weekly' ? '7 Days' : '1 Month'})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleToggleAdmin(selectedUser)}
                disabled={actionBusy}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button
                onClick={() => handleDeleteUser(selectedUser.id)}
                disabled={actionBusy}
                className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete User Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const colorMap: Record<string, string> = {
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-green-50 text-green-600',
  pink: 'bg-pink-50 text-pink-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  orange: 'bg-orange-50 text-orange-600',
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
