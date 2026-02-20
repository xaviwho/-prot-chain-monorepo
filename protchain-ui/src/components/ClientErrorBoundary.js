'use client';

import ErrorBoundary from './ErrorBoundary';

export default function ClientErrorBoundary({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
