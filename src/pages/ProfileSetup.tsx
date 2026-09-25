import { useEffect, useState } from 'react';
import { Camera, Loader2, Check, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/App';

export default function ProfileSetup() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [gender, setGender] = useState(profile?.gender ?? 'male');
  const [interestedIn, setInterestedIn] = useState(profile?.interested_in ?? 'all');
  const [city, setCity] = useState(profile?.city ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setAge(profile.age?.toString() ?? '');
      setGender(profile.gender ?? 'male');
      setInterestedIn(profile.interested_in ?? 'all');
      setCity(profile.city ?? '');
      setPhotoUrl(profile.photo_url ?? '');
    }
  }, [profile]);

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

          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none resize-none" placeholder="Tell us about yourself..." /></div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}

          <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {profile ? 'Save Changes' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
