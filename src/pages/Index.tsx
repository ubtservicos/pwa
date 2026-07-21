import { useEffect } from "react";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { Navbar } from "@/components/landing/Navbar";
import { Networks } from "@/components/landing/Networks";
import { Responsibility } from "@/components/landing/Responsibility";
import { Services } from "@/components/landing/Services";
import { Split } from "@/components/landing/Split";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";

const Index = () => {
  useEffect(() => {
    trackEvent("landing_view", "marketing");
    logSystem("INFO", "PWA", "landing_view", "success");
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Split />
        <Responsibility />
        <Networks />
        <FinalCta />
      </main>
    </div>
  );
};

export default Index;
