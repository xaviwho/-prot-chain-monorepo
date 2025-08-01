'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { logoutUser } from '@/lib/api';
import { getValidToken } from '@/lib/tokenUtils';
import { usePathname } from 'next/navigation';
import Cookies from 'js-cookie';

export default function Navigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const checkAuth = () => {
    const token = getValidToken();
    if (token) {
      setIsAuthenticated(true);
      // Decode JWT to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserName(payload.name || payload.email || 'User');
      } catch (error) {
        setUserName('User');
      }
    } else {
      setIsAuthenticated(false);
      setUserName('');
    }
  };

  useEffect(() => {
    checkAuth();
    // Add event listener for cookie changes
    window.addEventListener('storage', checkAuth);
    
    // Check auth on pathname changes (route changes)
    checkAuth();

    // Cleanup
    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, [pathname]); // Re-run when pathname changes

  const handleLogout = () => {
    logoutUser();
    setIsAuthenticated(false);
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="ProtChain"
                width={80}
                height={80}
                className="mr-2"
              />
            </Link>
          </div>
          <div className="flex items-center space-x-8">
            <div className="flex space-x-6">
              <Link
                href="/workflows"
                className="text-black hover:text-[#40C057] px-3 py-2 rounded-md text-base font-bold"
              >
                Workflows
              </Link>
              <Link
                href="/organizations"
                className="text-black hover:text-[#40C057] px-3 py-2 rounded-md text-base font-bold"
              >
                Organizations
              </Link>
              <Link
                href="/pureprot"
                className="text-black hover:text-[#40C057] px-3 py-2 rounded-md text-base font-bold"
              >
                CLI Tools
              </Link>
              <Link
                href="/protein"
                className="text-black hover:text-[#40C057] px-3 py-2 rounded-md text-base font-bold"
              >
                Protein Analysis
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/account"
                    className="text-black hover:text-[#40C057] px-3 py-2 rounded-md text-base font-bold"
                  >
                    Account
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-[#40C057] hover:text-[#2fa347] px-4 py-2 rounded-md text-base font-bold border-2 border-[#40C057] hover:bg-[#40C057] hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-[#40C057] hover:text-[#2fa347] px-4 py-2 rounded-md text-base font-bold border-2 border-[#40C057] hover:bg-[#40C057] hover:text-white transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-[#40C057] text-white px-4 py-2 rounded-md text-base font-bold hover:bg-[#2fa347] transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 