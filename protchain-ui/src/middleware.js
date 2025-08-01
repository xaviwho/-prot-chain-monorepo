import { NextResponse } from 'next/server';

export function middleware(request) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Define protected routes
  const protectedRoutes = ['/workflows', '/protein-analysis'];
  const authRoutes = ['/login', '/signup'];

  // Check if the path is protected
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));

  // Get the token from the request cookies
  const token = request.cookies.get('token')?.value;
  const isAuthenticated = !!token;

  // If the route is protected and user is not authenticated,
  // redirect to the login page
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is authenticated and trying to access auth routes,
  // redirect to workflows page
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/workflows', request.url));
  }

  // Otherwise, continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/workflows/:path*',
    '/protein-analysis/:path*',
    '/login',
    '/signup',
  ],
}; 