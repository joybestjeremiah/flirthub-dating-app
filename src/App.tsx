import { useState } from 'react';
import { Heart, MessageCircle, Users, Crown, LogOut, User, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthPage from '@/pages/AuthPage';
import ProfileSetup from '@/pages/ProfileSetup';
import DiscoverPage from '@/pages/DiscoverPage';
import MatchesPage from '@/pages/MatchesPage';
import RoomsPage from '@/pages/RoomsPage';
import AdminPanel from '@/pages/AdminPanel';
import SubscriptionModal from '@/components/SubscriptionModal';

type Tab = 'discover' | 'matches' | 'rooms';

function App() {
  const { user, profile, loading, hasActiveSubscription, isAdmin, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('discover');
  const [showSubModal, setShowSubModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!profile) {
    return <ProfileSetup />;
  }

  if (showProfile) {
    return <ProfileSetup />;
  }

  if (showAdmin && isAdmin) {
    return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="text-lg font-bold text-gray-900">FlirtHub</span>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveSubscription ? (
              <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Crown className="w-3.5 h-3.5" />
                Premium
              </span>
            ) : (
              <button
                onClick={() => setShowSubModal(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:scale-105 active:scale-95 transition-transform"
              >
                <Crown className="w-3.5 h-3.5" />
                Upgrade
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="p-2 text-gray-500 hover:text-rose-500 transition-colors"
                title="Admin Panel"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full overflow-hidden bg-rose-100 flex items-center justify-center border border-gray-200"
            >
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-rose-400" />
              )}
            </button>

            <button onClick={signOut} className="p-2 text-gray-400 hover:text-gray-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-20">
        {tab === 'discover' && <DiscoverPage />}
        {tab === 'matches' && <MatchesPage onBack={() => setTab('discover')} />}
        {tab === 'rooms' && <RoomsPage onBack={() => setTab('discover')} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-lg border-t border-gray-100">
        <div className="max-w-md mx-auto flex items-center justify-around px-4 py-2">
          <button
            onClick={() => setTab('discover')}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors ${
              tab === 'discover' ? 'text-rose-600' : 'text-gray-400'
            }`}
          >
            <Heart className="w-6 h-6" fill={tab === 'discover' ? 'currentColor' : 'none'} />
            <span className="text-xs font-medium">Discover</span>
          </button>

          <button
            onClick={() => setTab('matches')}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors ${
              tab === 'matches' ? 'text-rose-600' : 'text-gray-400'
            }`}
          >
            <MessageCircle className="w-6 h-6" fill={tab === 'matches' ? 'currentColor' : 'none'} />
            <span className="text-xs font-medium">Matches</span>
          </button>

          <button
            onClick={() => setTab('rooms')}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors ${
              tab === 'rooms' ? 'text-rose-600' : 'text-gray-400'
            }`}
          >
            <Users className="w-6 h-6" />
            <span className="text-xs font-medium">Rooms</span>
          </button>
        </div>
      </nav>

      {showSubModal && (
        <SubscriptionModal onClose={() => setShowSubModal(false)} />
      )}
    </div>
  );
}

export default App;
