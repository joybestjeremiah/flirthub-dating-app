import { useEffect, useState } from 'react';
import { Camera, Loader2, Check, LogOut, Trash2, MailCheck, RefreshCw, Navigation } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/App';

export default function ProfileSetup() {
  const { user, profile, refreshProfile, signOut, deleteAccount, resendVerification } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [gender, setGender] = useState(profile?.gender ?? 'male');
  const [interestedIn, setInterestedIn] = useState(profile?.interested_in ?? 'all');
  const [city, setCity] = useState(profile?.city ?? '');
  const [isVisible, setIsVisible] = useState(profile?.is_visible ?? true);
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(profile?.photo_url ? [profile.photo_url] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState(profile?.max_distance_km ?? 50);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setAge(profile.age?.toString() ?? '');
      setGender(profile.gender ?? 'male');
      setInterestedIn(profile.interested_in ?? 'all');
      setCity(profile.city ?? '');
      setIsVisible(profile.is_visible ?? true);
      setPhotoUrl(profile.photo_url ?? '');
      setMaxDistanceKm(profile.max_distance_km ?? 50);
    }
  }, [profile]);

  const updateLocation = async () => {
    if (!user || !navigator.geolocation) { setLocationMessage('Location is not supported by this browser.'); return; }
    setLocationBusy(true); setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { error } = await supabase.from('profiles').update({ latitude: position.coords.latitude, longitude: position.coords.longitude, location_updated_at: new Date().toISOString() }).eq('id', user.id);
      setLocationBusy(false); setLocationMessage(error ? error.message : 'Location updated. Your exact coordinates are not shown to other users.');
    }, (error) => { setLocationBusy(false); setLocationMessage(error.message || 'Location permission was not granted.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      age: age ? parseInt(age, 10) : null,
      gender,
      interested_in: interestedIn,
      city: city.trim() || null,
      photo_url: photoUrl.trim() || null,
      is_visible: isVisible,
      max_distance_km: maxDistanceKm,
      online: true,
      updated_at: new Date().toISOString(),
    });

    setBusy(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    await refreshProfile();
    navigate('/discover');
  };

  const handleResendVerification = async () => {
    setVerificationBusy(true); setVerificationMessage(null); setError(null);
    const { error } = await resendVerification();
    setVerificationBusy(false);
    setVerificationMessage(error ? error : 'Verification email sent. Check your inbox and spam folder.');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your FlirtHub account permanently? This cannot be undone.')) return;
    setDeleting(true); setError(null);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-end mb-4">
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{profile ? 'Edit Your Profile' : 'Set Up Your Profile'}</h1>
          <p className="text-gray-500 mt-1">Let others know who you are</p>
        </div>

        {!user?.email_confirmed_at && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><MailCheck className="w-5 h-5 text-amber-600 mt-0.5" /><div className="flex-1"><p className="text-sm font-semibold text-amber-900">Verify your email address</p><p className="text-xs text-amber-800 mt-1">Verification helps protect your account and improves trust on FlirtHub.</p><button type="button" onClick={handleResendVerification} disabled={verificationBusy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{verificationBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Resend verification email</button>{verificationMessage && <p className="text-xs mt-2 text-amber-900">{verificationMessage}</p>}</div></div></div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5">
          <div className="flex flex-col items-center mb-2">
            <div className="w-24 h-24 rounded-full bg-rose-100 overflow-hidden border-4 border-white shadow-lg flex items-center justify-center">
              {photoUrl ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-rose-400" />}
            </div>
          </div>

          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Photo URL</label><input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="https://example.com/photo.jpg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label><input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="Your name" /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label><input type="number" min="18" max="99" value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="25" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">City</label><input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="Lagos" /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label><select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Interested In</label><select value={interestedIn} onChange={(e) => setInterestedIn(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white"><option value="all">Everyone</option><option value="male">Men</option><option value="female">Women</option><option value="other">Other</option></select></div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-medium text-gray-800">Nearby matching</div><div className="text-xs text-gray-500">Choose how far away people can be when location is available.</div></div><Navigation className="w-5 h-5 text-rose-500" /></div><select value={maxDistanceKm} onChange={(e) => setMaxDistanceKm(Number(e.target.value))} className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"><option value={5}>Within 5 km</option><option value={10}>Within 10 km</option><option value={25}>Within 25 km</option><option value={50}>Within 50 km</option><option value={100}>Within 100 km</option><option value={250}>Within 250 km</option></select><button type="button" onClick={updateLocation} disabled={locationBusy} className="mt-3 w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 font-semibold text-sm disabled:opacity-60">{locationBusy ? 'Updating location…' : 'Use my current location'}</button>{locationMessage && <p className="text-xs text-gray-600 mt-2">{locationMessage}</p>}</div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"><input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} className="w-4 h-4 accent-rose-500" /><span><span className="block text-sm font-medium text-gray-800">Show me in Discover</span><span className="block text-xs text-gray-500">Turn this off to hide your profile from new people.</span></span></label>

          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none resize-none" placeholder="Tell us about yourself..." /></div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}

          <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {profile ? 'Save Changes' : 'Save Profile'}
          </button>
        </form>
        {profile && <button onClick={handleDeleteAccount} disabled={deleting} className="w-full mt-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-60 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />{deleting ? 'Deleting account…' : 'Delete my account'}</button>}
      </div>
    </div>
  );
}
