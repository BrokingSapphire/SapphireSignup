'use client'
import ManualBankDetails from '@/components/forms/ManualBankDetails'
import React from 'react'

function page() {
  // Define initialData with appropriate structure or default values
  const initialData = {};

  return (
    <div>
       <ManualBankDetails 
          onNext={() => (null)}
          onBack={() => (null)} 
          isCompleted={ (true)}
          validateBankDetails={() => Promise.resolve(true)}
          initialData={initialData}
        />
    </div>
  )
}

export default page
