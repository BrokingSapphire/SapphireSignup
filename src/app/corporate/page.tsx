import OnboardingCarousel from "@/components/new-signup/OnboardingCarousel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Corporate Signup | Sapphire Broking: Institutional & Business Trading Accounts",
  description:
    "Open a corporate or institutional trading account with Sapphire Broking. Our platform is tailored for businesses, HNIs, PMS providers, and investment firms seeking advanced trading infrastructure, real-time BSE/NSE connectivity, and high-performance execution. Partner with a SEBI-registered stock broker for scalable, compliant, and efficient trading solutions.",
  keywords:
    "corporate trading account India, institutional trading platform, open corporate demat account, business stock trading, Sapphire Broking corporate, HNI trading account, SEBI registered institutional broker, PMS trading infrastructure, trading API for corporates, bulk trading tools, NSE BSE institutional connectivity, stock broker for firms, professional trading solutions India, algo trading for businesses, enterprise investment tools, institutional stock market platform, equity trading for corporates, brokerage for investment firms, business demat account, multi-user trading platform, trading account for companies, compliance-ready trading infrastructure, advanced order execution India",
  openGraph: {
    title: "Corporate Signup | Sapphire Broking: Institutional & Business Trading Accounts",
    description:
      "Register your company or institution with Sapphire Broking to access enterprise-grade trading solutions. Designed for HNIs, PMS providers, and corporate investors, our platform delivers powerful tools, deep market data, and seamless execution tailored to high-volume trading needs.",
    url: "https://signup.sapphirebroking.com/corporate",
    images: [{ url: "https://www.sapphirebroking.com/logo-white.svg" }],
    type: "website",
  },
};

export default function Page() {
  return (
    <div className="mx-auto h-screen">
      <OnboardingCarousel />;
    </div>
  );
}
