import Link from "next/link";
import React, { useState, useEffect } from "react";

interface FeaturePoint {
  title: string;
  description: string;
}

interface StepItem {
  id: number;
  label: string;
  completed: boolean;
  active: boolean;
}

const LeftPanel = ({ currentStep }: { currentStep: number }) => {
  // Track previous step to detect changes
  const [prevStep, setPrevStep] = useState(currentStep);
  const [, setTransitioningStep] = useState<number | null>(
    null
  );

  // Detect step changes to trigger animations
  useEffect(() => {
    if (currentStep !== prevStep) {
      // Set the step that is transitioning
      setTransitioningStep(currentStep);

      // Clear the transitioning state after animation completes
      const timer = setTimeout(() => {
        setTransitioningStep(null);
        setPrevStep(currentStep);
      }, 800); // Match this with the animation duration

      return () => clearTimeout(timer);
    }
  }, [currentStep, prevStep]);

  // Determine if we're in the Trading Account steps range (5-7)
  // const isInTradingAccountSteps = currentStep > 4 && currentStep <= 7;

  // Define all onboarding steps for the progress stepper
  const steps: StepItem[] = [
    {
      id: 0,
      label: "Minor PAN Verification",
      completed: currentStep > 2,
      active: currentStep === 2,
    },
    {
      id: 1,
      label: "Minor Aadhar Verification",
      completed: currentStep > 3,
      active: currentStep === 3,
    },
    {
      id: 2,
      label: "Trading Account Details",
      completed: currentStep > 4,
      active: currentStep === 4,
    },
    {
      id: 3,
      label: "Minor Trading Account Details",
      completed: currentStep > 7,
      active: currentStep <= 7 && currentStep > 4,
    },
    {
      id: 4,
      label: "Gardian PAN",
      completed: currentStep > 8,
      active: currentStep === 8,
    },
    {
      id: 5,
      label: "Gardian Aadhar",
      completed: currentStep > 9,
      active: currentStep === 9,
    },
    {
      id: 6,
      label: "Gardian Bank Details",
      completed: currentStep > 10,
      active: currentStep === 10,
    },
    {
      id: 8,
      label: "Gardian IPV",
      completed: currentStep > 11,
      active: currentStep === 11,
    },
    {
      id: 9,
      label: "Gardian Signature",
      completed: currentStep > 12,
      active: currentStep === 12,
    },
    {
      id: 10,
      label: "Gardian esign",
      completed: currentStep > 13,
      active: currentStep === 13,
    },
    {
      id: 11,
      label: "Password",
      completed: currentStep > 14,
      active: currentStep === 14,
    },
    {
      id: 12,
      label: "MPIN",
      completed: currentStep > 15,
      active: currentStep === 15,
    },
  ];

  const features: FeaturePoint[] = [
    {
      title: "Seamless Account Creation",
      description:
        "Effortless and quick sign-up process with secure verification to get you started in minutes.",
    },
    {
      title: "Advanced Trading Tools",
      description:
        "Access real-time market insights, analytics, and AI-powered strategies to maximize your trading potential.",
    },
    {
      title: "Secure & Trusted Platform",
      description:
        "Trade with confidence on a highly secure platform backed by industry-leading encryption and compliance.",
    },
  ];

  // Display progress stepper for verification steps (starting from PAN verification)
  const showProgressStepper = currentStep >= 2;

  return (
    <div className="w-full bg-[#F6FAFC] h-full flex flex-col justify-between relative px-6 md:px-10 lg:px-16 xl:px-20 py-10 lg:py-14 overflow-hidden">
      {/* Background decorative elements with enhanced animations */}
      <div className="absolute left-32 top-2 bg-yellow-400 w-96 h-40 blur-[70px] opacity-40 rounded-full animate-[float_8s_ease-in-out_infinite]"></div>
      <div className="absolute -left-6 -top-2 bg-green-500 w-44 h-32 blur-[70px] opacity-40 rounded-full animate-[pulse_6s_ease-in-out_infinite]"></div>
      <div className="absolute -right-6 -top-2 bg-green-500 w-44 h-32 blur-[70px] opacity-40 rounded-full animate-[float_10s_ease-in-out_infinite]"></div>

      <div className="absolute left-2 top-56 blur animate-[spin_15s_linear_infinite]">
        <div className="w-0 h-0 border-solid -rotate-45 border-l-[25px] border-r-[25px] border-b-[50px] border-l-transparent border-r-transparent border-b-green-500"></div>
      </div>

      <div className="absolute left-16 bottom-24 z-0 blur animate-[float_12s_ease-in-out_infinite]">
        <div className="w-0 h-0 border-solid rotate-45 border-l-[30px] border-r-[30px] border-b-[50px] border-l-transparent border-r-transparent border-b-yellow-400"></div>
      </div>

      <div className="w-6 h-6 bg-purple-500 blur opacity-70 rounded-full absolute right-24 bottom-32 z-0 animate-[float_12s_ease-in-out_infinite]"></div>
      <div className="w-3 h-3 bg-blue-400 blur opacity-60 rounded-full absolute right-40 top-40 z-0 animate-[ping_5s_ease-in-out_infinite]"></div>

      <div className="flex-grow relative z-10 flex items-center">
        <div className="max-w-2xl w-full">
          <div className="mb-12 mt-16">
            <h1 className=" text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 animate-[fadeIn_1s_ease-out]">
              Trusted Broking for
              <br />
              Smarter Investments.
            </h1>
          </div>

          {/* Conditional rendering based on the current step */}
          {!showProgressStepper ? (
            // Show features for the initial steps
            <div className="space-y-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start"
                  style={{
                    animation: `fadeIn 1s ease-out ${
                      0.5 + index * 0.2
                    }s both`,
                  }}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className=" text-sm lg:text-lg xl:text-lg font-medium text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-xs lg:text-sm xl:text-sm text-gray-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Show progress steps for verification process
            <div className="relative animate-none space-y-3">
              {/* Removed fadeIn animation here */}
              {steps.map((step, index) => {
                // Check if this step is transitioning (newly active)
                // const isTransitioning =
                //   step.id + 2 === transitioningStep && !isInTradingAccountSteps;
                // // Special handling for Trading Account step
                // const isTradingAccount = index === 3;

                return (
                  <div
                    key={step.id}
                    className="flex items-center relative" /* Removed all animations */
                  >
                    {/* Step indicator with pulsing effect for active step */}
                    <div className="flex-shrink-0 rounded-full flex items-center justify-center z-10">
                      {step.active ? (
                        <div className="relative w-6 h-6">
                          {/* Pulsing animation for active step */}
                          <div
                            className="absolute inset-0 w-full h-full rounded-full"
                            style={{
                              animation: "smooth-pulse 2s ease-in-out infinite",
                              opacity: 0.8,
                            }}
                          ></div>
                          <div
                            className="absolute inset-0 w-full h-full rounded-full"
                            style={{
                              animation:
                                "smooth-pulse-delayed 2s ease-in-out infinite",
                              animationDelay: "1s",
                              opacity: 0.6,
                            }}
                          ></div>

                          {/* Active step indicator */}
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 30 30"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 scale-90 rounded-full z-10"
                          >
                            <circle cx="15" cy="15" r="12" fill="white" />
                            <circle
                              cx="15"
                              cy="15"
                              r="11.75"
                              stroke="#1DB954"
                              strokeWidth="0.5"
                            />
                            <circle cx="15" cy="15" r="5" fill="#1DB954" />
                          </svg>
                        </div>
                      ) : step.completed ? (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 30 30"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="transform scale-90 rounded-full"
                        >
                          <circle cx="15" cy="15" r="12" fill="#1DB954" />
                          <path
                            d="M10 15L13.5 18.5L20 12"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-200/60"></div>
                      )}
                    </div>

                    {/* Vertical line - conditionally change color based on completion status */}
                    {index < steps.length - 1 && (
                      <div
                        className={`absolute left-2.5 top-3 w-0.5 h-10 ${
                          step.completed ? "bg-green-500" : "bg-gray-200/50"
                        } transition-colors duration-500 ease-in-out`}
                      ></div>
                    )}

                    {/* Step label without animation that could cause blinking */}
                    <div
                      className={`ml-4 ${
                        step.active
                          ? "text-gray-900 font-medium"
                          : step.completed
                          ? "text-gray-700"
                          : "text-gray-300"
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="w-full pt-6 animate-[fadeIn_0.5s_ease-out_1.2s_both]">
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-[10px] sm:text-[11px] lg:text-[12px] xl:text-[13px] text-gray-500 p-2">
  <Link target="_blank" href="/" className="text-center sm:text-left">
    © Sapphire Broking
  </Link>
  
  <div className="flex items-center justify-center sm:justify-end space-x-2 text-center">
    <Link target="_blank" href="/privacy-policy" className="hover:text-gray-700 transition-colors">
      Privacy Policy
    </Link>
    <span className="text-gray-400">•</span>
    <Link target="_blank" href="/terms-and-conditions" className="hover:text-gray-700 transition-colors">
      T&C
    </Link>
    <span className="text-gray-400">•</span>
    <Link target="_blank" href="/contact" className="hover:text-gray-700 transition-colors">
      Contact Us
    </Link>
  </div>
</div>
      </footer>

      {/* Add global keyframes for custom animations */}
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes smoothFadeIn {
          0% {
            opacity: 0.3;
            transform: scale(0.99) translateX(-3px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateX(0);
          }
        }

        @keyframes smooth-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(29, 185, 84, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(29, 185, 84, 0.2);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(29, 185, 84, 0);
            transform: scale(1);
          }
        }

        @keyframes smooth-pulse-delayed {
          0% {
            box-shadow: 0 0 0 0 rgba(29, 185, 84, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(29, 185, 84, 0.1);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(29, 185, 84, 0);
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default LeftPanel;