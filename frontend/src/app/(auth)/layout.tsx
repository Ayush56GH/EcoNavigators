"use client";

import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="signup-container">
      <Navbar />
      <div className="signup-wrapper">{children}</div>
      <Footer />
    </div>
  );
}
