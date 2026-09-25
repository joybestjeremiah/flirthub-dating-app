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
import type { Profile, Subscription, Room, Match, Message } from '@/lib/types';

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

type AdminTab = 'overview' | 'users' | 'subscriptions' | 'rooms';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadUsers(), loadSubscriptions(), loadRooms()]);
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
    const revenue = activeSubs.reduce((sum, s) => sum + Number(s.amount), 0);

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
    await supabase.from('rooms').delete().eq('id', roomId);
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    loadStats();
  };

  const handleRevokeSubscription = async (subId: string) => {
    if (!confirm('Revoke this subscription?')) return;
    await supabase.from('subscriptions').delete().eq('id', subId);
    await loadSubscriptions();
    await loadStats();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user profile? Their auth account will remain but all profile data will be removed.')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSelectedUser(null);
    loadStats();
  };

  const handleToggleAdmin = async (user: AdminUser) => {
    await supabase.from('profiles').update({ is_admin: !user.is_admin }).eq('id', user.id);
    await loadUsers();
    setSelectedUser(null);
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
            { key: 'users', label: 'Users', icon: Users },
            { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
            { key: 'rooms', label: 'Rooms', icon: DoorOpen },
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
                          <button
                            onClick={() => handleRevokeSubscription(s.id)}
                            className="text-sm text-red-500 font-medium hover:text-red-600"
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
                          className="text-sm text-red-500 font-medium hover:text-red-600 inline-flex items-center gap-1"
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
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button
                onClick={() => handleDeleteUser(selectedUser.id)}
                className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors"
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
