import React from 'react'
interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}
import { motion } from "framer-motion";

const ProgressBar = ({
  currentStep,
  totalSteps,
} : ProgressBarProps) => {
  return (
  <div className="w-full h-2 bg-gray-200">
    <motion.div
      className="h-full bg-[#FFD600]"
      initial={{ width: 0 }}
      animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    />
  </div>
)
}

export default ProgressBar