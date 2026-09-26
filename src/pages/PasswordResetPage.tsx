import { useState } from 'react';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { navigate } from '@/App';

export default function PasswordResetPage() {
  const { updatePassword, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) return setError(error);
    setDone(true);
    setTimeout(() => navigate('/discover'), 1200);
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 px-4"><div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"><h1 className="text-xl font-bold text-gray-900">Reset link expired</h1><p className="text-sm text-gray-500 mt-2">Please request a new password reset link.</p><button onClick={() => navigate('/')} className="mt-5 w-full py-3 rounded-xl bg-rose-500 text-white font-semibold">Back to sign in</button></div></div>;

  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 px-4"><div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">{done ? <div className="text-center"><CheckCircle className="w-12 h-12 text-green-500 mx-auto" /><h1 className="text-xl font-bold text-gray-900 mt-3">Password updated</h1><p className="text-sm text-gray-500 mt-1">Redirecting you to FlirtHub…</p></div> : <><h1 className="text-2xl font-bold text-gray-900">Create a new password</h1><p className="text-sm text-gray-500 mt-1 mb-6">Choose a strong password you have not used elsewhere.</p><form onSubmit={submit} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 outline-none" /></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label><input required minLength={8} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none" /></div>{error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}<button disabled={busy} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">{busy && <Loader2 className="w-5 h-5 animate-spin" />}Update password</button></form></>}</div></div>;
}
