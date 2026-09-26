import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Users, Crown, LogOut, User, Loader2, Shield, Wallet, Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import AuthPage from '@/pages/AuthPage';
import PasswordResetPage from '@/pages/PasswordResetPage';
import ProfileSetup from '@/pages/ProfileSetup';
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import RoomsPage from '@/pages/RoomsPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import AdminPanel from '@/pages/AdminPanel';
import HostEarningsPage from '@/pages/HostEarningsPage';
import SubscriptionModal from '@/components/SubscriptionModal';
import WalletModal from '@/components/WalletModal';
import IncomingCall from '@/components/IncomingCall';
import type { Notification } from '@/lib/types';

type Route = '/' | '/reset-password' | '/profile-setup' | '/discover' | '/matches' | '/rooms' | '/admin' | '/subscription' | '/earnings';
function getRoute(): Route {
  const path = window.location.pathname;
  if (path === '/reset-password' || path === '/profile-setup' || path === '/discover' || path === '/matches' || path === '/rooms' || path === '/admin' || path === '/subscription' || path === '/earnings') return path;
  return '/';
}
export function navigate(path: Route) {
  if (window.location.pathname !== path) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
}
function useRoute() {
  const [route, setRoute] = useState<Route>(getRoute);
  useEffect(() => { const onPopState = () => setRoute(getRoute()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  return route;
}
function App() {
  const { user, profile, loading, hasActiveSubscription, isAdmin, signOut, refreshSubscription } = useAuth();
  const route = useRoute();
  const [showSubModal, setShowSubModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
    setNotifications((data ?? []) as Notification[]);
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((items) => items.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };
  const markAllNotificationsRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    setNotifications((items) => items.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };
  useEffect(() => {
    if (loading) return;
    if (!user) { if (route !== '/' && route !== '/reset-password') navigate('/'); return; }
    if (!profile) { if (route !== '/profile-setup' && route !== '/reset-password') navigate('/profile-setup'); return; }
    if (route === '/' || route === '/profile-setup') navigate('/discover');
    if (route === '/admin' && !isAdmin) navigate('/discover');
    if (route === '/earnings' && !user) navigate('/discover');
  }, [loading, user, profile, isAdmin, route]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'subscription') return;
    const status = params.get('status');
    const transactionId = params.get('transaction_id');
    const reference = params.get('reference');
    const txRef = params.get('tx_ref') || reference || sessionStorage.getItem('flirthub_subscription_tx_ref');
    if (status === 'cancelled' || status === 'failed') {
      setPaymentMessage('Payment was not completed. Your Premium access was not activated.');
      sessionStorage.removeItem('flirthub_subscription_tx_ref');
      return;
    }
    if (!txRef) {
      setPaymentMessage('Payment returned without a valid transaction reference.');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('verify-subscription-payment', {
        body: { tx_ref: txRef, transaction_id: transactionId || undefined },
      });
      if (cancelled) return;
      if (error || !data?.success) {
        setPaymentMessage(data?.error || error?.message || 'Payment verification failed. Premium was not activated.');
        return;
      }
      sessionStorage.removeItem('flirthub_subscription_tx_ref');
      await refreshSubscription();
      if (!cancelled) setPaymentMessage('Payment verified successfully. Premium is now active.');
    })();
    return () => { cancelled = true; };
  }, [refreshSubscription]);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50"><Loader2 className="w-10 h-10 text-rose-500 animate-spin" /></div>;
  if (!user && route !== '/reset-password') return <AuthPage />;
  if (route === '/reset-password') return <PasswordResetPage />;
  if (!profile) return <ProfileSetup />;
  if (showProfile) return <ProfileSetup />;
  if (route === '/admin') return <AdminPanel onBack={() => navigate('/discover')} />;
  if (route === '/subscription') return <SubscriptionPage />;
  if (route === '/earnings') return <HostEarningsPage onBack={() => navigate('/discover')} />;
  const activeTab = route === '/matches' ? 'matches' : route === '/rooms' ? 'rooms' : 'discover';
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/discover')} className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center"><Heart className="w-5 h-5 text-white" fill="white" /></div><span className="text-lg font-bold text-gray-900">FlirtHub</span></button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications((v) => !v)} className="relative p-2 text-gray-500 hover:text-rose-500" title="Notifications"><Bell className="w-5 h-5" />{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
            <button onClick={() => setShowWalletModal(true)} className="flex items-center gap-1 bg-gray-50 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full"><Wallet className="w-3.5 h-3.5" /> Wallet</button>
            {hasActiveSubscription ? <button onClick={() => navigate('/subscription')} className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full"><Crown className="w-3.5 h-3.5" /> Premium</button> : <button onClick={() => setShowSubModal(true)} className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full"><Crown className="w-3.5 h-3.5" /> Upgrade</button>}
            {isAdmin && <button onClick={() => navigate('/admin')} className="p-2 text-gray-500 hover:text-rose-500" title="Admin Panel"><Shield className="w-5 h-5" /></button>}
            <button onClick={() => navigate('/earnings')} className="p-2 text-gray-500 hover:text-rose-500" title="Host Earnings"><Wallet className="w-5 h-5" /></button>
            <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full overflow-hidden bg-rose-100 flex items-center justify-center border border-gray-200">{profile.photo_url ? <img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-rose-400" />}</button>
            <button onClick={signOut} className="p-2 text-gray-400 hover:text-gray-600" title="Sign out"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      {showNotifications && <div className="fixed inset-x-4 top-16 z-40 max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100"><div><h3 className="font-bold text-gray-900">Notifications</h3><p className="text-xs text-gray-500">{unreadCount} unread</p></div><button onClick={markAllNotificationsRead} className="flex items-center gap-1 text-xs font-semibold text-rose-600"><CheckCheck className="w-4 h-4" /> Mark all read</button></div>
        <div className="max-h-[60vh] overflow-y-auto">{notifications.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No notifications yet.</div> : notifications.map((n) => <button key={n.id} onClick={() => markNotificationRead(n.id)} className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-rose-50 ${n.read_at ? 'opacity-60' : 'bg-rose-50/60'}`}><div className="flex items-start gap-3"><div className="mt-0.5 w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center"><Bell className="w-4 h-4 text-rose-500" /></div><div className="min-w-0 flex-1"><div className="font-semibold text-sm text-gray-900">{n.title}</div><div className="text-xs text-gray-600 mt-0.5">{n.body}</div><div className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div></div>{!n.read_at && <span className="w-2 h-2 rounded-full bg-rose-500 mt-2" />}</div></button>)}</div>
      </div>}
      {paymentMessage && <div className="fixed inset-x-4 top-20 z-50 max-w-md mx-auto rounded-2xl bg-white border border-gray-100 shadow-xl px-4 py-3 text-sm font-medium text-gray-800">{paymentMessage}<button onClick={() => setPaymentMessage(null)} className="ml-3 text-rose-600 font-bold">×</button></div>}
      <main className="pb-20">{activeTab === 'discover' && <DiscoverPage />}{activeTab === 'matches' && <MatchesPage onBack={() => navigate('/discover')} />}{activeTab === 'rooms' && <RoomsPage onBack={() => navigate('/discover')} />}</main>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-lg border-t border-gray-100"><div className="max-w-md mx-auto flex items-center justify-around px-4 py-2">
        <button onClick={() => navigate('/discover')} className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl ${activeTab === 'discover' ? 'text-rose-600' : 'text-gray-400'}`}><Heart className="w-6 h-6" fill={activeTab === 'discover' ? 'currentColor' : 'none'} /><span className="text-xs font-medium">Discover</span></button>
        <button onClick={() => navigate('/matches')} className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl ${activeTab === 'matches' ? 'text-rose-600' : 'text-gray-400'}`}><MessageCircle className="w-6 h-6" fill={activeTab === 'matches' ? 'currentColor' : 'none'} /><span className="text-xs font-medium">Matches</span></button>
        <button onClick={() => navigate('/rooms')} className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl ${activeTab === 'rooms' ? 'text-rose-600' : 'text-gray-400'}`}><Users className="w-6 h-6" /><span className="text-xs font-medium">Rooms</span></button>
      </div></nav>
      {showSubModal && <SubscriptionModal onClose={() => setShowSubModal(false)} />}
      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} />}
      <IncomingCall userId={user.id} />
    </div>
  );
}
export default App;
