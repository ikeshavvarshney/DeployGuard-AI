"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";

const STEPS = [
  "Structuring Prompt",
  "Fetching RAG Context",
  "Sending to Model",
  "Receiving Model Output",
  "Validation Layer",
  "Caching Output",
  "Ensembling Results",
  "Finalizing Response",
];

interface PipelineLoaderProps {
  isVisible: boolean;
  currentStep?: number; // auto-advances every 400ms if not provided
}

export default function PipelineLoader({ isVisible, currentStep }: PipelineLoaderProps) {
  const [autoStep, setAutoStep] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setAutoStep(0);
      return;
    }
    if (currentStep !== undefined) return; // external control

    const interval = setInterval(() => {
      setAutoStep((prev) => {
        if (prev >= STEPS.length - 1) return STEPS.length - 1;
        return prev + 1;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isVisible, currentStep]);

  // Reset when loader becomes visible again
  useEffect(() => {
    if (isVisible && currentStep === undefined) {
      setAutoStep(0);
    }
  }, [isVisible, currentStep]);

  if (!isVisible) return null;

  const active = currentStep ?? autoStep;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 animate-fadeInUp">
      <div className="space-y-2">
        {STEPS.map((label, idx) => {
          const isDone = idx < active;
          const isActive = idx === active;
          const isPending = idx > active;

          return (
            <div
              key={label}
              className="flex items-center gap-3 transition-all duration-200"
              style={{ opacity: isPending ? 0.35 : 1 }}
            >
              {/* Indicator */}
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-[#00ff88]/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#00cc6a]" />
                  </div>
                ) : isActive ? (
                  <div
                    className="w-3 h-3 rounded-full bg-[#00ff88]"
                    style={{ animation: "pulseGlow 1.2s ease-in-out infinite" }}
                  />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#333333]" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm font-medium transition-colors duration-200 ${
                  isDone
                    ? "text-[#00cc6a]"
                    : isActive
                    ? "text-white"
                    : "text-[#444444]"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
