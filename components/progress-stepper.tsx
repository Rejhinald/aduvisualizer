"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "@/lib/constants";
import type { WizardStep } from "@/lib/types";

interface ProgressStepperProps {
  currentStep: WizardStep;
}

export function ProgressStepper({ currentStep }: ProgressStepperProps) {
  const currentIndex = WIZARD_STEPS.findIndex((step) => step.id === currentStep);

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 md:mb-12">
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-display text-sm md:text-base transition-all duration-300",
                    isCompleted &&
                      "bg-primary text-primary-foreground shadow-md",
                    isCurrent &&
                      "bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20",
                    isUpcoming &&
                      "bg-muted text-muted-foreground border-2 border-border"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 md:h-6 md:w-6" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 md:mt-3 text-center">
                  <div
                    className={cn(
                      "text-xs md:text-sm font-medium transition-colors",
                      (isCompleted || isCurrent) && "text-foreground",
                      isUpcoming && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="hidden md:block text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </div>
                </div>
              </div>

              {/* Connector Line */}
              {index < WIZARD_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 md:mx-4 mt-[-40px] md:mt-[-48px]">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      index < currentIndex ? "bg-primary" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
