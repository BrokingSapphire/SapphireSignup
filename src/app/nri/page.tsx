import OnboardingCarousel from "@/components/new-signup/OnboardingCarousel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "NRI Demat Account | Sapphire Broking: Invest in India from Anywhere",
  description:
    "Open an NRI demat and trading account with Sapphire Broking and invest in Indian equities, mutual funds, and more. Enjoy seamless access to NSE, BSE, and MCX with full RBI and FEMA compliance. Designed for NRIs looking to grow wealth in India with expert support and advanced trading tools.",
  keywords:
    "NRI demat account India, open NRI trading account, invest in India from abroad, NRI stock market access, NRI investment platform, NRI PIS account, Sapphire Broking NRI, RBI compliant trading account, NRI mutual fund investment, FEMA compliant trading, NSE BSE for NRIs, online NRI demat account, NRI portfolio management, Indian equities for NRIs, NRI investment advisor, NRO NRE trading account, NRI online stock trading India, non-resident Indian trading, international investor India, NRIs investing in Indian markets, NRI taxation trading India, NRI KYC demat, best broker for NRIs",
  openGraph: {
    title: "NRI Demat Account | Sapphire Broking: Invest in India from Anywhere",
    description:
      "Join Sapphire Broking as an NRI investor and access the Indian markets with ease. Our platform offers NRE/NRO trading accounts, PIS services, and expert support with full RBI and FEMA compliance for safe and seamless investing from abroad.",
    url: "https://signup.sapphirebroking.com/nri",
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