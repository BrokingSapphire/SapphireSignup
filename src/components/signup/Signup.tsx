// "use client";
// import { useState, useEffect } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import Image from "next/image";
// import type {
//   PaymentMethodType,
//   BankLinkMethodType,
//   PageData,
// } from "../../constants/types/signup-types/form";
// import MobileVerification from "./form-components/MobileVerification";
// // import BankSelection from './form-components/BankSelection'
// import LinkBankAccount from "./form-components/LinkBankAccount";
// import EmailVerification from "./form-components/EmailVerification";
// import CardVerification from "./form-components/CardVerification";
// import ProgressBar from "./general/ProgressBar";
// import PageNavigation from "./general/PageNavigation";
// import PanVerification from "./form-components/PanVerification";
// import AdharVerification from "./form-components/AdharVerification";
// import InvestmentSegment from "./form-components/InvestmentSegment";
// import TradingAccountDetails from "./form-components/TradingAccountDetail";
// import TradingPreferences from "./form-components/TradingPreference";
// import BankLink from "./form-components/LinkBank";
// import TradingAccountDetails2 from "./form-components/TradingAccountDetails2";
// import NomineesManagement from "./form-components/Nominees";
// import IPVVerification from "./form-components/IPV";


// interface StepConfig {
//   [key: number]: PageData;
// }

// const STEP_CONFIG: StepConfig = {
//   1: {
//     title: "Verify Your Mobile Number",
//     description:
//       "Let's start by verifying your mobile number for secure access.",
//     component: MobileVerification,
//   },
//   2: {
//     title: "Verify Your Email",
//     description: "Please verify your email to continue with the registration.",
//     component: EmailVerification,
//   },
//   3: {
//     title: "Verify Card Details",
//     description:
//       "Easily create and manage a personalized business profile that streamlines your operations and connects you to success.",
//     component: CardVerification,
//   },
//   4: {
//     title: "Verify PAN Details",
//     description:
//       "Easily create and manage a personalized business profile that streamlines your operations and connects you to success.",
//     component: PanVerification,
//   },
//   5: {
//     title: "Adhar Verification (DigiLocker)",
//     description:
//       "Verify your Adhar details securely using DigiLocker to proceed with the registration.",
//     component: AdharVerification,
//   },
//   6: {
//     title: "Choose Investment Segments",
//     description: "Select the investment segments you're interested in.",
//     component: InvestmentSegment,
//   },
//   7: {
//     title: "Trading Account Details",
//     description: "Select the investment segments you're interested in.",
//     component: TradingAccountDetails,
//   },
//   8: {
//     title: "Trading Preferences",
//     description: "Select the investment segments you're interested in.",
//     component: TradingPreferences,
//   },
//   9: {
//     title: "Link Bank Account",
//     description: "Link your bank account to proceed with the registration.",
//     component: TradingAccountDetails2,
//   },
//   10: {
//     title: "Link Bank Account",
//     description: "Link your bank account to proceed with the registration.",
//     component: BankLink,
//   },
//   11: {
//     title: "Nominate",
//     description: "Please verify your email to continue with the registration.",
//     component: NomineesManagement,
//   },
//   12:{
//     title: "Verify Bank Account Details",
//     description:
//       "Easily create and manage a personalized business profile that streamlines your operations and connects you to success.",
//     component: LinkBankAccount,
//   },
//   13:{
//     title: "Verify Bank Account Details",
//     description:"Veirfy Your image",
//     component: IPVVerification,
//   },

// };

// const ANIMATIONS = {
//   pageVariants: {
//     enter: (direction: number) => ({
//       y: direction > 0 ? 1000 : -1000,
//       opacity: 0,
//     }),
//     center: {
//       y: 0,
//       opacity: 1,
//     },
//     exit: (direction: number) => ({
//       y: direction > 0 ? -1000 : 1000,
//       opacity: 0,
//     }),
//   },
//   pageTransition: {
//     type: "tween",
//     duration: 0.3,
//     ease: "easeInOut",
//   },
// };

// const Signup = () => {
//   const [currentStep, setCurrentStep] = useState<number>(1);
//   const [direction, setDirection] = useState<number>(0);
//   const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(null);
//   const [bankLinkMethod, setBankLinkMethod] =useState<BankLinkMethodType>(null);

//   useEffect(() => {
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = "auto";
//     };
//   }, [currentStep]);

//   const handleNextStep = (method?: string) => {
//     setDirection(1);
//     if (method) {
//       if (currentStep === 14) {
//         setBankLinkMethod(method as BankLinkMethodType);
//       } else {
//         setPaymentMethod(method as PaymentMethodType);
//       }
//     } else if (currentStep < Object.keys(STEP_CONFIG).length) {
//       setCurrentStep((prev) => prev + 1);
//     }
//   };

//   const handlePrevStep = () => {
//     setDirection(-1);
//     if (currentStep > 1) {
//       setCurrentStep((prev) => prev - 1);
//     }
//   };

//   const renderComponent = () => {
//     if (bankLinkMethod) {
//       const BankComponent = STEP_CONFIG[currentStep]?.component;
//       return (
//         BankComponent && (
//           <BankComponent
//             onBack={() => setBankLinkMethod(null)}
//             onNextStep={() => console.log("Completed")}
//             onComplete={() => {
//               setBankLinkMethod(null);
//               setCurrentStep(15);
//             }}
//           />
//         )
//       );
//     }

//     if (paymentMethod) {
//       const PaymentComponent = STEP_CONFIG[currentStep]?.component;
//       return (
//         PaymentComponent && (
//           <PaymentComponent
//             onNextStep={() => console.log("Completed")}
//             onBack={() => setPaymentMethod(null)}
//             onComplete={() => {
//               setCurrentStep(4);
//               setPaymentMethod(null);
//             }}
//           />
//         )
//       );
//     }

//     const StepComponent = STEP_CONFIG[currentStep]?.component;
//     return StepComponent && <StepComponent onNextStep={handleNextStep} />;
//   };

//   const { title, description } = STEP_CONFIG[currentStep] || {};

//   return (
//     <div className="flex flex-col min-h-screen">
//       <ProgressBar
//         currentStep={currentStep}
//         totalSteps={Object.keys(STEP_CONFIG).length}
//       />

//       <div className="flex w-full flex-1 relative">
//         <div className="w-1/3 bg-teal-800 p-16 text-white relative">
//           <div className="max-w-xl mt-40">
//             <h1 className="text-5xl font-bold mb-6">
//               {paymentMethod ? `Complete ${paymentMethod} Payment` : title}
//             </h1>
//             <p className="text-xl text-gray-200 mb-12">
//               {paymentMethod
//                 ? `Please complete your payment using ${paymentMethod}`
//                 : description}
//             </p>
//             <div className="relative">
//               <div className="w-full h-full rounded-lg flex items-center justify-center">
//                 <Image
//                   src="/assets/signup.svg"
//                   alt="Signup illustration"
//                   width={400}
//                   height={300}
//                   priority
//                 />
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="w-1/2 bg-white flex items-center justify-center">
//           <div className="w-full max-w-md relative ml-[37%]">
//             <AnimatePresence mode="wait" initial={false}>
//               <motion.div
//                 key={currentStep}
//                 custom={direction}
//                 variants={ANIMATIONS.pageVariants}
//                 initial="enter"
//                 animate="center"
//                 exit="exit"
//                 transition={ANIMATIONS.pageTransition}
//                 className="w-full"
//               >
//                 {renderComponent()}
//               </motion.div>
//             </AnimatePresence>
//           </div>
//         </div>

//         {!paymentMethod &&
//           !bankLinkMethod &&
//           currentStep <= Object.keys(STEP_CONFIG).length && (

//             <PageNavigation
//               currentStep={currentStep}
//               onPrev={handlePrevStep}
//               onNext={handleNextStep}
//               totalSteps={Object.keys(STEP_CONFIG).length}
//             />
//           )}
//       </div>
//     </div>
//   );
// };

// export default Signup;
