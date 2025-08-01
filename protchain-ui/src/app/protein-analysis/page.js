'use client';

import { useState } from 'react';
import IpfsInfo from '@/components/IpfsInfo';
import IpfsFiles from '@/components/IpfsFiles';

export default function ProteinAnalysis() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Protein Analysis
                </h2>
                {/* Add your protein analysis form/content here */}
                <p className="text-gray-600">
                  Upload and analyze protein structures using our advanced tools.
                </p>
              </div>
            </div>
            
            {/* Recent Files Section */}
            <IpfsFiles />
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* IPFS Information */}
            <IpfsInfo />

            {/* Additional sidebar content can go here */}
          </div>
        </div>
      </div>
    </div>
  );
} 