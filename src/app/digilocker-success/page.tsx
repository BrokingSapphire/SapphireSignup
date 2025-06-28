// pages/signup/digilocker-success.tsx
// or app/signup/digilocker-success/page.tsx (if using App Router)

import DigilockerSuccessPage from '@/components/signup/DigilockerSuccessPage';

export default function DigilockerSuccess() {
  return <DigilockerSuccessPage />;
}

// If you need to add metadata (App Router)
export const metadata = {
  title: 'DigiLocker Verification Completed - Sapphire Broking',
  description: 'Aadhaar verification through DigiLocker completed successfully',
  robots: 'noindex, nofollow', // Prevent indexing of this page
};