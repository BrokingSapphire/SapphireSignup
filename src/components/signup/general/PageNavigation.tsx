import { LucideIcon, ChevronUp, ChevronDown } from "lucide-react";

interface PageNavigationProps {
  currentStep: number;
  onPrev: () => void;
  onNext: () => void;
  totalSteps?: number;
  isSubmitting?: boolean;
}

interface NavigationButton {
  action: () => void;
  Icon: LucideIcon;
  direction: "up" | "down";
  disabled: boolean;
}

export default function PageNavigation({
  currentStep,
  onPrev,
  onNext,
  totalSteps = 11,
  isSubmitting = false,
}: PageNavigationProps) {
  const navigationButtons: NavigationButton[] = [
    {
      action: onPrev,
      Icon: ChevronUp,
      direction: "up",
      disabled: currentStep <= 1 || isSubmitting,
    },
    {
      action: onNext,
      Icon: ChevronDown,
      direction: "down",
      disabled: currentStep >= totalSteps || isSubmitting,
    },
  ];

  return (
    <div className="fixed bottom-8 right-8 flex flex-col items-end space-y-2">
      <div className="flex flex-row">
        {navigationButtons.map(({ action, Icon, direction, disabled }) => (
          <button
            key={direction}
            onClick={action}
            disabled={disabled}
            className={`
              w-10 h-10 flex items-center justify-center border border-white
              ${direction === "up" ? "rounded-s-md" : "rounded-e-md"}
              ${
                disabled
                  ? "bg-green-heading text-gray-400 cursor-not-allowed opacity-50"
                  : "bg-green-heading text-white hover:bg-teal-700 transition-colors duration-200"
              }
              ${isSubmitting ? "cursor-wait" : ""}
            `}
            title={
              disabled
                ? isSubmitting
                  ? "Processing..."
                  : "Not available"
                : direction === "up"
                ? "Previous step"
                : "Next step"
            }
          >
            <Icon size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}
