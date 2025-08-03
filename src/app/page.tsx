import OnboardingCarousel from "@/components/new-signup/OnboardingCarousel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Signup | Sapphire Broking: Smarter Trading, Expert Insights",
  description:
    "Join Sapphire Broking to access a powerful, next-gen trading platform built for smart investors and traders. Benefit from expert recommendations, real-time BSE/NSE updates, and intelligent tools designed for both beginners and professionals. Experience seamless trade execution and in-depth market insights with Sapphire.",
  keywords:
    "signup Sapphire Broking, individual signup sapphire, open trading account India, online stock trading, expert market insights, BSE NSE real-time updates, advanced trading platform India, beginner trading tools, professional trade recommendations, corporate announcement tracker, stock trading alerts, market data analysis, trading charts India, intraday trading India, equity research platform, technical analysis India, fundamental analysis tools, smart trading solutions, next-gen trading app, portfolio management India, algorithmic trading tools, trading education India, mobile trading app India, derivatives trading, commodity trading platform, forex trading India, SEBI registered broker, stock broker India, best online broker India",
  openGraph: {
    title: "Signup | Sapphire Broking: Smarter Trading, Expert Insights",
    description:
      "Create your Sapphire Broking account and access a next-generation trading experience. Get expert recommendations, real-time market alerts, and advanced tools for smarter trading decisions. Ideal for beginners and experienced investors seeking seamless execution and deep market insights.",
    url: "https://signup.sapphirebroking.com",
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
