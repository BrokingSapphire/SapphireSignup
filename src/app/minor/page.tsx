import OnboardingCarousel from "@/components/new-signup/OnboardingCarousel";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Minor Signup | Sapphire Broking: Invest in Your Child’s Future",
  description:
    "Open a minor demat and trading account with Sapphire Broking to start early investments for your child's future. Our SEBI-registered platform ensures safe, compliant, and goal-oriented investing for minors, managed under the guardian's supervision. Plan ahead with smart investment tools and real-time market insights.",
  keywords:
    "minor demat account India, open minor trading account, child investment account, guardian-managed demat account, invest for child India, minor stock trading, kids investment platform, minor account SEBI rules, child investment SIP, minor portfolio management, stock market for minors, future planning investment India, Sapphire Broking minor account, safe trading account for children, stock investment for child education, minor investment options, early investing India, guardian trading account India, NSE BSE minor account, stock account for children, minor investment tools India",
  openGraph: {
    title: "Minor Signup | Sapphire Broking: Invest in Your Child’s Future",
    description:
      "Start your child's investment journey with Sapphire Broking. Open a minor demat account under guardian supervision and access secure, SEBI-compliant investment tools built for long-term growth. Perfect for early financial planning and disciplined wealth creation.",
    url: "https://signup.sapphirebroking.com/minor",
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
