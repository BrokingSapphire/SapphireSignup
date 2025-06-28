import React from "react";
import { Button } from "../ui/button";

interface RiskDisclosureModalProps {
  onAccept: () => void;
  onClose: () => void;
}

const RiskDisclosureModal: React.FC<RiskDisclosureModalProps> = ({ onAccept, }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center  p-4">
      <div className="bg-white w-full max-w-full max-h-full md:max-w-2xl md:max-h-[90vh] md:rounded-lg shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b">
          <h2 className="text-base sm:text-lg font-semibold">Risk Disclosures on Derivatives</h2>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="text-[10px] sm:text-xs md:text-sm text-gray-700">
            <ul className="list-disc pl-4 sm:pl-5 space-y-2">
              <li>
                9 out of 10 individual traders in the equity Futures and Options Segment incurred net losses.
              </li>
              <li>
                On average, loss-makers registered a net trading loss close to ₹50,000.
              </li>
              <li>
                Over and above the net trading losses incurred, loss-makers expended an additional 28% of net trading losses as transaction costs.
              </li>
              <li>
                Those making net trading profits incurred between 15% to 50% of such profits as transaction costs.
              </li>
            </ul>
            
            <p className="mt-4 text-[10px] sm:text-xs md:text-sm text-gray-600">
              <strong>Source:</strong>{" "}
              <a 
                href="https://www.sebi.gov.in" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 underline break-words"
              >
                SEBI study
              </a>{" "}
              dated January 25, 2023 on &quot;Analysis of Profit and Loss of Individual Traders dealing in equity Futures and Options (F&O) Segment&quout;, wherein Aggregate Level findings are based on annual Profit/Loss incurred by individual traders in equity F&O during FY 2021-22.
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end mt-6 gap-4 p-4 sm:p-6">
          <Button 
            variant="outline" 
            onClick={onAccept}
          >
            Understood
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RiskDisclosureModal;