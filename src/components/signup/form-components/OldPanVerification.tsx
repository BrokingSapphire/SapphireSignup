// import React, { useState } from "react";

// interface PanVerificationProps {
//   onNext: () => void;
// }

// const PanVerification: React.FC<PanVerificationProps> = ({ onNext }) => {
//   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
//   const [formData, setFormData] = useState({
//     panNumber: "",
//     dob: "",
//     isValid: false,
//     panError: false,
//     dobError: false,
//   });

//   const validateForm = (updatedData: Partial<typeof formData>) => {
//     const currentData = { ...formData, ...updatedData };

//     // PAN validation: 10 characters, alphanumeric
//     const isPanValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(currentData.panNumber);

//     // DOB validation: should be a valid date and person should be at least 18 years old
//     const isValidDate = (dateString: string) => {
//       const today = new Date();
//       const birthDate = new Date(dateString);
//       let age = today.getFullYear() - birthDate.getFullYear();
//       const monthDiff = today.getMonth() - birthDate.getMonth();
//       if (
//         monthDiff < 0 ||
//         (monthDiff === 0 && today.getDate() < birthDate.getDate())
//       ) {
//         age--;
//       }
//       return age >= 18;
//     };

//     return {
//       isValid: isPanValid && isValidDate(currentData.dob),
//       panError: currentData.panNumber.length > 0 && !isPanValid,
//       dobError: currentData.dob.length > 0 && !isValidDate(currentData.dob),
//     };
//   };

//   const updateFormData = (data: Partial<typeof formData>): void => {
//     setFormData((prev) => ({
//       ...prev,
//       ...data,
//     }));
//   };

//   const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value.toUpperCase();
//     const currentLength = value.length;
    
//     // Validate each character based on position
//     if (currentLength <= 5) {
//       // First 5 characters should be letters
//       if (/^[A-Z]*$/.test(value)) {
//         updateFormData({
//           panNumber: value,
//           ...validateForm({ panNumber: value }),
//         });
//       }
//     } else if (currentLength <= 9) {
//       // Next 4 characters should be numbers
//       const firstPart = value.slice(0, 5);
//       const middlePart = value.slice(5, currentLength);
//       if (/^[A-Z]{5}$/.test(firstPart) && /^[0-9]*$/.test(middlePart)) {
//         updateFormData({
//           panNumber: value,
//           ...validateForm({ panNumber: value }),
//         });
//       }
//     } else if (currentLength <= 10) {
//       // Last character should be a letter
//       const lastChar = value.slice(9);
//       const restOfPan = value.slice(0, 9);
//       if (
//         /^[A-Z]{5}[0-9]{4}$/.test(restOfPan) &&
//         /^[A-Z]?$/.test(lastChar)
//       ) {
//         updateFormData({
//           panNumber: value,
//           ...validateForm({ panNumber: value }),
//         });
//       }
//     }
//   };

//   const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     const updates = {
//       dob: value,
//     };
//     updateFormData({
//       ...updates,
//       ...validateForm(updates),
//     });
//   };

//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (!formData.isValid || isSubmitting) return;

//     setIsSubmitting(true);

//     try {
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       onNext();
//     } catch (error) {
//       console.error("Error during submission:", error);
//       updateFormData({
//         panError: true,
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="max-w-2xl mx-auto -mt-40 p-4">
//       <div className="w-full">
//         <h1 className="text-2xl font-semibold mb-4">
//           Enter your PAN to Continue
//         </h1>
//         <p className="text-gray-600 mb-2">Step 1 of 9</p>

//         <form onSubmit={handleSubmit}>
//           <div className="space-y-6">
//             <div>
//               <label className="block text-gray-700 mb-2">PAN Number</label>
//               <input
//                 type="text"
//                 className="w-full border rounded-md px-4 py-2"
//                 placeholder="AAAAA1234A"
//                 value={formData.panNumber}
//                 onChange={handlePanChange}
//                 maxLength={10}
//                 onInput={(e: React.FormEvent<HTMLInputElement>) => {
//                   e.currentTarget.value = e.currentTarget.value.toUpperCase();
//                 }}
//                 disabled={isSubmitting}
//               />
//               {formData.panError && (
//                 <p className="text-red-500 mt-2">
//                   Please enter a valid PAN number.
//                 </p>
//               )}
//             </div>

//             <div>
//               <label className="block text-gray-700 mb-2">DOB</label>
//               <input
//                 type="date"
//                 className="w-full border rounded-md px-4 py-2"
//                 placeholder="DD/MM/YYYY"
//                 value={formData.dob}
//                 onChange={handleDobChange}
//                 max={new Date().toISOString().split("T")[0]}
//                 disabled={isSubmitting}
//               />
//               {formData.dobError && (
//                 <p className="text-red-500 mt-2">
//                   You must be at least 18 years old to continue.
//                 </p>
//               )}
//             </div>

//             <button
//               type="submit"
//               className={`w-full bg-teal-800 text-white py-3 rounded-md hover:bg-teal-700 ${
//                 formData.isValid && !isSubmitting
//                   ? ""
//                   : "opacity-50 cursor-not-allowed"
//               }`}
//               disabled={!formData.isValid || isSubmitting}
//             >
//               {isSubmitting ? "Please wait..." : "Continue"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default PanVerification;