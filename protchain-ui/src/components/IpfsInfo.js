'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getIpfsApiUrl } from '@/lib/api';

export default function IpfsInfo() {
  const [ipfsData, setIpfsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIpfsInfo = async () => {
      try {
        const response = await fetch(`${getIpfsApiUrl()}/api/v0/id`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch IPFS info');
        }

        const data = await response.json();
        setIpfsData(data);
      } catch (err) {
        setError('Failed to load IPFS information');
        console.error('IPFS fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIpfsInfo();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">IPFS Storage Information</h3>
      <div className="space-y-4">
        {ipfsData && (
          <>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Node ID</span>
                <span className="text-sm text-gray-900 font-mono">{ipfsData.ID.slice(0, 15)}...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Protocol Version</span>
                <span className="text-sm text-gray-900">{ipfsData.ProtocolVersion}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Agent Version</span>
                <span className="text-sm text-gray-900">{ipfsData.AgentVersion}</span>
              </div>
            </div>
            <div className="pt-4">
              <a
                href={`${getIpfsApiUrl()}/webui`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#40C057] hover:bg-[#2fa347] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#40C057] w-full"
              >
                View Full IPFS Dashboard
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 