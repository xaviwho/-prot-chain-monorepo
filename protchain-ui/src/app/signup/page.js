'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { registerUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await registerUser(name, email, password);
      window.location.href = '/workflows';
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
          <h1 className="text-3xl font-bold mb-4">Join ProtChain</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Start discovering drug candidates with blockchain-verified protein analysis. From structure upload to lead optimization.
          </p>
          <div className="mt-10 space-y-3 text-left max-w-xs mx-auto">
            {[
              'Full protein analysis pipeline',
              'AI-powered research assistant',
              'Blockchain-verified results',
              'Free to get started',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#16a34a] flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-gray-300">{item}</span>
              </div>
            ))}
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
            Create your account
          </h2>
          <p className="text-sm text-[#64748b] mb-8">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#16a34a] hover:text-[#15803d]">
              Sign in
            </Link>
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#0f172a] mb-1.5">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition"
                placeholder="John Doe"
              />
            </div>

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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-[#0f172a] mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] focus:border-transparent transition"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-full text-sm font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#16a34a] transition ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-[#64748b] mt-6">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="font-medium text-[#16a34a] hover:text-[#15803d]">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-[#16a34a] hover:text-[#15803d]">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
