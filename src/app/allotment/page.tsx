'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { AllotmentChecker } from '@/components/allotment/AllotmentChecker';

export default function AllotmentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070b14] via-[#0a1120] to-[#060a12] text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <AllotmentChecker />
      </main>
    </div>
  );
}
