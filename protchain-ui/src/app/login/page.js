'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { authenticateUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authenticateUser(email, password);
      window.location.href = '/workflows';
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0f172a] to-[#1e293b] relative overflow-hidden flex-col justify-center items-center px-12 text-white">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 max-w-md text-center">
          <div className="w-16 h-16 bg-[#16a34a] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Image src="/logo.png" alt="ProtChain" width={40} height={40} />
          </div>
          <h1 className="text-3xl font-bold mb-4">Welcome back to ProtChain</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Continue your research with blockchain-verified protein analysis. Every result is tamper-proof and fully auditable.
          </p>
          <div className="flex justify-center gap-8 mt-10">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#4ade80]">500+</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Researchers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#4ade80]">50k+</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Analyses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#4ade80]">99.9%</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-16 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden mb-8">
            <Link href="/">
              <Image src="/logo.png" alt="ProtChain" width={48} height={48} />
            </Link>
          </div>

          <h2 className="text-2xl font-bold text-[#0f172a] mb-1">
            Sign in
          </h2>
          <p className="text-sm text-[#64748b] mb-8">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-[#16a34a] hover:text-[#15803d]">
              Sign up
            </Link>
          </p>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#0f172a] mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#0f172a] mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-[#64748b]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a]"
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm font-medium text-[#16a34a] hover:text-[#15803d]">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-full text-sm font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#16a34a] transition ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
