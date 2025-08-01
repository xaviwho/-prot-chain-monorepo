'use client';

import { useState, useEffect } from 'react';
import { apiClient, getIpfsGatewayUrl, getIpfsApiUrl } from '@/lib/api';

export default function IpfsFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIpfsFiles = async () => {
      try {
        const response = await apiClient.get('/api/v1/ipfs/files');
        setFiles(response.data.files || []);
      } catch (err) {
        setError('Failed to load IPFS files');
        console.error('IPFS files fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIpfsFiles();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
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
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Recent Protein Files on IPFS</h3>
      <div className="space-y-4">
        {files.length === 0 ? (
          <p className="text-gray-500 text-sm">No protein files found in IPFS storage.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.slice(0, 5).map((file) => (
              <div key={file.hash} className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{file.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Added {new Date(file.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`${getIpfsGatewayUrl()}/ipfs/${file.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#40C057] hover:text-[#2fa347]"
                  >
                    View File
                  </a>
                </div>
                <p className="text-xs font-mono text-gray-500 mt-2">
                  {file.hash.slice(0, 20)}...
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="pt-4">
          <a
            href={`${getIpfsApiUrl()}/webui/#/files`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 border border-[#40C057] text-sm font-medium rounded-md text-[#40C057] bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#40C057] w-full"
          >
            View All Files in IPFS
          </a>
        </div>
      </div>
    </div>
  );
} 