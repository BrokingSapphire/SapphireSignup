// 'use client'
// import IPVVerification from '@/components/forms/IPV'
// import React from 'react'

// enum CheckpointStep {
//   IPV = 'IPV'
// }

// function page() {
//   function handleStepCompletion(step: any): void {
//     // Mark the step as completed, update state or perform any necessary actions
//     // For example, you might want to update a state or call a parent callback
//     // This is a placeholder implementation
//     console.log(`Step completed:`, step);
//   }
//   // Example implementation: retrieves step data from local state or storage
//   function getStepData(step: any): IPVInitialData | undefined {
//     // If you have state, replace this with actual state lookup
//     // For demonstration, try to get from localStorage
//     try {
//       const data = localStorage.getItem(`stepData_${step}`);
//       return data ? JSON.parse(data) as IPVInitialData : undefined;
//     } catch {
//       return undefined;
//     }
//   }
//   function isStepCompleted(step: any): boolean {
//     // Example: Check if step is marked as completed in localStorage
//     try {
//       const completed = localStorage.getItem(`stepCompleted_${step}`);
//       return completed === 'true';
//     } catch {
//       return false;
//     }
//   }
//   return (
//     <div>
//        <IPVVerification 
//             onNext={() => handleStepCompletion(CheckpointStep.IPV)}
//             initialData={getStepData(CheckpointStep.IPV) ?? undefined}
//             isCompleted={isStepCompleted(CheckpointStep.IPV)}
//           />
//     </div>
//   )
// }

// export default page
import React from 'react'

function page() {
  return (
    <div>
      
    </div>
  )
}

export default page
