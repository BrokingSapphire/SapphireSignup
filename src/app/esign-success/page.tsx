// pages/signup/esign_success.tsx
// or app/signup/esign_success/page.tsx (if using App Router)

import EsignSuccessPage from '@/components/signup/EsignSuccessPage';

export default function EsignSuccess() {
  return <EsignSuccessPage />;
}

// If you need to add metadata (App Router)
export const metadata = {
  title: 'eSign Completed - Sapphire Broking',
  description: 'eSign process completed successfully',
  robots: 'noindex, nofollow', // Prevent indexing of this page
};