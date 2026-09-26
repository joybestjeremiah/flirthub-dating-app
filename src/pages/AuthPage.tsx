import { useState } from 'react';
import { Heart, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = mode === 'reset' ? await resetPassword(email) : await (mode === 'signin' ? signIn(email, password) : signUp(email, password));
    setBusy(false);
    if (error) setError(error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/30 mb-4">
            <Heart className="w-8 h-8 text-white" fill="white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">FlirtHub</h1>
          <p className="text-gray-500 mt-2">Find your perfect match today</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {mode === 'reset' ? <div className="mb-6"><h2 className="text-lg font-semibold text-gray-900">Reset your password</h2><p className="text-sm text-gray-500 mt-1">We’ll email you a secure password reset link.</p></div> : <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signup' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signin' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Sign In
            </button>
          </div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {mode !== 'reset' && <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === 'reset' ? 'Send Reset Link' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'signin' && <button type="button" onClick={() => setMode('reset')} className="w-full mt-4 text-sm text-rose-600 hover:underline">Forgot your password?</button>}
          {mode === 'reset' && <button type="button" onClick={() => setMode('signin')} className="w-full mt-4 text-sm text-gray-600 hover:underline">Back to sign in</button>}

          <p className="text-center text-xs text-gray-400 mt-6">
            By continuing you agree to our Terms & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
