import { useEffect, useState } from 'react';
import { Loader2, Check, LogOut, Trash2, MailCheck, RefreshCw, Navigation, ImagePlus, X, Star, Camera } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/App';

interface GalleryImage { id: string; path: string; is_primary: boolean; sort_order: number; url: string; }

const MAX_PHOTOS = 2;
const MAX_IMAGE_BYTES = 300 * 1024;

async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_IMAGE_BYTES && file.type === 'image/jpeg') return file;

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = image.naturalWidth;
      let height = image.naturalHeight;
      const maxDimension = 1600;
      const initialScale = Math.min(1, maxDimension / Math.max(width, height));
      width = Math.max(1, Math.round(width * initialScale));
      height = Math.max(1, Math.round(height * initialScale));

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Your browser could not process this image.'));
        return;
      }

      const render = () => {
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
      };

      let quality = 0.82;
      let attempts = 0;

      const tryCompress = () => {
        render();
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Unable to compress this image.'));
            return;
          }

          if (blob.size <= MAX_IMAGE_BYTES) {
            resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }));
            return;
          }

          attempts += 1;
          if (quality > 0.42) {
            quality -= 0.07;
            tryCompress();
            return;
          }

          if (Math.max(width, height) > 700 && attempts < 14) {
            width = Math.max(1, Math.round(width * 0.8));
            height = Math.max(1, Math.round(height * 0.8));
            quality = 0.72;
            tryCompress();
            return;
          }

          reject(new Error('This photo could not be reduced below 300KB. Please choose another photo.'));
        }, 'image/jpeg', quality);
      };

      tryCompress();
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file.'));
    };
    image.src = objectUrl;
  });
}

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
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState(profile?.max_distance_km ?? 50);

  const publicUrl = (path: string) => supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl;

  const loadGallery = async () => {
    if (!user) return;
    const { data, error: galleryError } = await supabase.from('profile_images').select('id,path,is_primary,sort_order').eq('user_id', user.id).order('sort_order').order('created_at');
    if (galleryError) { setError(galleryError.message); return; }
    setGallery((data ?? []).map((item) => ({ ...item, url: publicUrl(item.path) })) as GalleryImage[]);
  };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? ''); setBio(profile.bio ?? ''); setAge(profile.age?.toString() ?? ''); setGender(profile.gender ?? 'male'); setInterestedIn(profile.interested_in ?? 'all'); setCity(profile.city ?? ''); setIsVisible(profile.is_visible ?? true); setPhotoUrl(profile.photo_url ?? ''); setMaxDistanceKm(profile.max_distance_km ?? 50);
    }
    void loadGallery();
  }, [profile, user]);

  const uploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    if (gallery.length + files.length > MAX_PHOTOS) { setError(`You can have a maximum of ${MAX_PHOTOS} profile photos.`); return; }
    if (files.some((file) => !file.type.startsWith('image/'))) { setError('Use image files only.'); return; }

    setUploading(true); setError(null);
    try {
      const newImages: GalleryImage[] = [];
      for (const originalFile of files) {
        const file = await compressImage(originalFile);
        if (file.size > MAX_IMAGE_BYTES) throw new Error('Each photo must be 300KB or smaller.');

        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;

        const isPrimary = gallery.length === 0 && newImages.length === 0;
        const { data, error: rowError } = await supabase.from('profile_images').insert({ user_id: user.id, path, is_primary: isPrimary, sort_order: gallery.length + newImages.length }).select('id,path,is_primary,sort_order').single();
        if (rowError) { await supabase.storage.from('profile-images').remove([path]); throw rowError; }
        newImages.push({ ...data, url: publicUrl(path) } as GalleryImage);
      }

      const updated = [...gallery, ...newImages];
      setGallery(updated);
      if (!photoUrl && updated[0]) {
        setPhotoUrl(updated[0].url);
        await supabase.from('profiles').update({ photo_url: updated[0].url, updated_at: new Date().toISOString() }).eq('id', user.id);
        await refreshProfile();
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
    } finally { setUploading(false); }
  };

  const removeImage = async (image: GalleryImage) => {
    if (!user || !window.confirm('Remove this photo?')) return;
    setUploading(true); setError(null);
    const { error: rowError } = await supabase.from('profile_images').delete().eq('id', image.id).eq('user_id', user.id);
    if (rowError) { setUploading(false); setError(rowError.message); return; }
    await supabase.storage.from('profile-images').remove([image.path]);
    const remaining = gallery.filter((item) => item.id !== image.id);
    if (image.is_primary && remaining[0]) {
      await supabase.from('profile_images').update({ is_primary: true }).eq('id', remaining[0].id).eq('user_id', user.id);
      setGallery(remaining.map((item, index) => ({ ...item, is_primary: index === 0 })));
      await supabase.from('profiles').update({ photo_url: remaining[0].url, updated_at: new Date().toISOString() }).eq('id', user.id);
      setPhotoUrl(remaining[0].url);
    } else {
      setGallery(remaining);
      if (image.url === photoUrl) { setPhotoUrl(remaining[0]?.url ?? ''); await supabase.from('profiles').update({ photo_url: remaining[0]?.url ?? null, updated_at: new Date().toISOString() }).eq('id', user.id); }
    }
    await refreshProfile(); setUploading(false);
  };

  const makePrimary = async (image: GalleryImage) => {
    if (!user || image.is_primary) return;
    setUploading(true); setError(null);
    const { error: resetError } = await supabase.from('profile_images').update({ is_primary: false }).eq('user_id', user.id);
    if (!resetError) {
      const { error: primaryError } = await supabase.from('profile_images').update({ is_primary: true }).eq('id', image.id).eq('user_id', user.id);
      if (primaryError) setError(primaryError.message); else { setGallery(gallery.map((item) => ({ ...item, is_primary: item.id === image.id }))); setPhotoUrl(image.url); await supabase.from('profiles').update({ photo_url: image.url, updated_at: new Date().toISOString() }).eq('id', user.id); await refreshProfile(); }
    } else setError(resetError.message);
    setUploading(false);
  };

  const updateLocation = async () => {
    if (!user || !navigator.geolocation) { setLocationMessage('Location is not supported by this browser.'); return; }
    setLocationBusy(true); setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { error } = await supabase.from('profiles').update({ latitude: position.coords.latitude, longitude: position.coords.longitude, location_updated_at: new Date().toISOString() }).eq('id', user.id);
      setLocationBusy(false); setLocationMessage(error ? error.message : 'Location updated. Your exact coordinates are not shown to other users.');
    }, (geoError) => { setLocationBusy(false); setLocationMessage(geoError.message || 'Location permission was not granted.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; setBusy(true); setError(null);
    if (!photoUrl.trim() && gallery.length === 0) { setBusy(false); setError('A profile picture is required. Take a photo or choose one from your gallery.'); return; }
    const { error: upsertError } = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName.trim(), bio: bio.trim() || null, age: age ? parseInt(age, 10) : null, gender, interested_in: interestedIn, city: city.trim() || null, photo_url: photoUrl.trim() || gallery[0]?.url || null, is_visible: isVisible, max_distance_km: maxDistanceKm, online: true, updated_at: new Date().toISOString() });
    setBusy(false); if (upsertError) { setError(upsertError.message); return; }
    await refreshProfile(); navigate('/discover');
  };

  const handleResendVerification = async () => { setVerificationBusy(true); setVerificationMessage(null); setError(null); const { error } = await resendVerification(); setVerificationBusy(false); setVerificationMessage(error ? error : 'Verification email sent. Check your inbox and spam folder.'); };
  const handleDeleteAccount = async () => { if (!window.confirm('Delete your FlirtHub account permanently? This cannot be undone.')) return; setDeleting(true); setError(null); const { error } = await deleteAccount(); setDeleting(false); if (error) setError(error); };
  const exitProfile = () => navigate('/discover');

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 py-10 px-4"><div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4"><button type="button" onClick={exitProfile} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-rose-600">← Back to Discover</button><button type="button" onClick={signOut} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"><LogOut className="w-4 h-4" /> Sign out</button></div>
      <div className="text-center mb-8"><h1 className="text-2xl font-bold text-gray-900">{profile ? 'Edit Your Profile' : 'Set Up Your Profile'}</h1><p className="text-gray-500 mt-1">Let others know who you are</p></div>
      {!user?.email_confirmed_at && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><MailCheck className="w-5 h-5 text-amber-600 mt-0.5" /><div className="flex-1"><p className="text-sm font-semibold text-amber-900">Verify your email address</p><p className="text-xs text-amber-800 mt-1">Verification helps protect your account and improves trust on FlirtHub.</p><button type="button" onClick={handleResendVerification} disabled={verificationBusy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{verificationBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Resend verification email</button>{verificationMessage && <p className="text-xs mt-2 text-amber-900">{verificationMessage}</p>}</div></div></div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5">
        <div><div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Profile photos <span className="text-rose-600">*</span></label><span className="text-xs text-gray-400">{gallery.length}/{MAX_PHOTOS}</span></div><div className="grid grid-cols-2 gap-2">
          {gallery.map((image) => <div key={image.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group"><img src={image.url} alt="Profile" className="w-full h-full object-cover" /><div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><button type="button" title="Make primary" onClick={() => void makePrimary(image)} className="flex-1 rounded-lg bg-white/90 p-2 text-rose-600"><Star className={`w-4 h-4 mx-auto ${image.is_primary ? 'fill-current' : ''}`} /></button><button type="button" title="Remove" onClick={() => void removeImage(image)} className="flex-1 rounded-lg bg-white/90 p-2 text-red-600"><X className="w-4 h-4 mx-auto" /></button></div>{image.is_primary && <span className="absolute top-1 left-1 rounded-full bg-rose-600 text-white text-[10px] px-2 py-1">Main</span>}</div>)}
          {gallery.length < MAX_PHOTOS && <><label className="aspect-square rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 flex flex-col items-center justify-center cursor-pointer hover:bg-rose-100"><Camera className="w-7 h-7 text-rose-500" /><span className="text-xs text-rose-600 font-semibold mt-1">Take a photo</span><input type="file" accept="image/*" capture="user" className="hidden" onChange={uploadImages} disabled={uploading} /></label><label className="aspect-square rounded-xl border-2 border-dashed border-pink-200 bg-pink-50 flex flex-col items-center justify-center cursor-pointer hover:bg-pink-100"><ImagePlus className="w-7 h-7 text-pink-500" /><span className="text-xs text-pink-600 font-semibold mt-1">Choose from gallery</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={uploadImages} disabled={uploading} /></label></>}
        </div><p className="text-xs text-gray-500 mt-2">Maximum 2 photos. Take a photo with your camera or choose from your gallery. Each photo is automatically compressed to 300KB or less before upload.</p></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label><input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="Your name" /></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label><input type="number" min="18" max="99" value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="25" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">City</label><input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none" placeholder="Lagos" /></div></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label><select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Interested In</label><select value={interestedIn} onChange={(e) => setInterestedIn(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none bg-white"><option value="all">Everyone</option><option value="male">Men</option><option value="female">Women</option><option value="other">Other</option></select></div></div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-medium text-gray-800">Nearby matching</div><div className="text-xs text-gray-500">Choose how far away people can be when location is available.</div></div><Navigation className="w-5 h-5 text-rose-500" /></div><select value={maxDistanceKm} onChange={(e) => setMaxDistanceKm(Number(e.target.value))} className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"><option value={5}>Within 5 km</option><option value={10}>Within 10 km</option><option value={25}>Within 25 km</option><option value={50}>Within 50 km</option><option value={100}>Within 100 km</option><option value={250}>Within 250 km</option></select><button type="button" onClick={updateLocation} disabled={locationBusy} className="mt-3 w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 font-semibold text-sm disabled:opacity-60">{locationBusy ? 'Updating location…' : 'Use my current location'}</button>{locationMessage && <p className="text-xs text-gray-600 mt-2">{locationMessage}</p>}</div>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"><input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} className="w-4 h-4 accent-rose-500" /><span><span className="block text-sm font-medium text-gray-800">Show me in Discover</span><span className="block text-xs text-gray-500">Turn this off to hide your profile from new people.</span></span></label>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none resize-none" placeholder="Tell us about yourself..." /></div>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}
        <button type="submit" disabled={busy || uploading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {profile ? 'Save Changes' : 'Save Profile'}</button>
      </form>
      {profile && <button onClick={handleDeleteAccount} disabled={deleting} className="w-full mt-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-60 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />{deleting ? 'Deleting account…' : 'Delete my account'}</button>}
    </div></div>
  );
}
