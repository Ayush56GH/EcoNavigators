'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { CoreIdeaSection } from '@/components/sections/CoreIdeaSection';
import { WhyItMattersSection } from '@/components/sections/WhyItMattersSection';
import { MonitoringChallengeSection } from '@/components/sections/MonitoringChallengeSection';
import { MethodSection } from '@/components/sections/MethodSection';
import { ForwardSection } from '@/components/sections/ForwardSection';
import { DemoSection } from '@/components/sections/DemoSection';
import { ResearchNoteModal } from '@/components/ui/ResearchNoteModal';

export default function Home() {
  const [researchOpen, setResearchOpen] = useState(false);

  return (
    <main>
      <Navbar />
      <HeroSection />
      <CoreIdeaSection />
      <WhyItMattersSection />
      <MonitoringChallengeSection />
      <MethodSection />
      <ForwardSection onOpenResearchNote={() => setResearchOpen(true)} />
      <DemoSection />
      <Footer />
      <ResearchNoteModal
        isOpen={researchOpen}
        onClose={() => setResearchOpen(false)}
      />
    </main>
  );
}
