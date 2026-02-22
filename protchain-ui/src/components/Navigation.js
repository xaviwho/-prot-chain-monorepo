'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { logoutUser } from '@/lib/api';
import { getValidToken } from '@/lib/tokenUtils';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const pathname = usePathname();

  const checkAuth = () => {
    const token = getValidToken();
    if (token) {
      setIsAuthenticated(true);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const name = payload.name || payload.email || 'User';
        setUserName(name);
        setUserInitials(
          name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        );
      } catch {
        setUserName('User');
        setUserInitials('U');
      }
    } else {
      setIsAuthenticated(false);
      setUserName('');
      setUserInitials('');
    }
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [pathname]);

  const handleLogout = () => {
    logoutUser();
    setIsAuthenticated(false);
  };

  const isActive = (path) => pathname === path;

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/logo.png"
              alt="ProtChain"
              width={60}
              height={60}
            />
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: '/workflows', label: 'Workflows' },
              { href: '/organizations', label: 'Organizations' },
              { href: '/pureprot', label: 'CLI Tools' },
              { href: '/protein', label: 'Protein Analysis' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'text-[#16a34a] bg-[#dcfce7]'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  href="/account"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#16a34a] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-sm font-medium text-[#0f172a] hidden lg:inline max-w-[120px] truncate">
                    {userName}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-[#64748b] hover:text-[#0f172a] px-3 py-2 rounded-md transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#64748b] hover:text-[#0f172a] px-3 py-2 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium bg-[#16a34a] text-white px-4 py-2 rounded-full hover:bg-[#15803d] transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
