"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressStepper } from "@/components/progress-stepper";
import { FloorPlanEditor } from "@/components/floor-plan-editor";
import { useWizard } from "@/lib/context/wizard-context";
import type { FloorPlan } from "@/lib/types";

export default function FloorPlanPage() {
  const router = useRouter();
  const { setFloorPlan, setCurrentStep } = useWizard();
  const [currentPlan, setCurrentPlan] = useState<FloorPlan | null>(null);

  const handleSaveAndContinue = () => {
    if (currentPlan) {
      setFloorPlan(currentPlan);
      setCurrentStep("finishes");
      router.push("/create/finishes");
    }
  };

  const canContinue = currentPlan && currentPlan.rooms.length > 0 && currentPlan.totalArea >= 300;

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-6 md:mb-8 pt-8"
      >
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs md:text-sm font-medium">
          <Home className="h-4 w-4" />
          Step 1 of 3
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-foreground font-display mb-2">
          Design Your Floor Plan
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto font-body px-4">
          Create your ADU layout by adding rooms. Click and drag to draw rectangles for each space.
        </p>
      </motion.div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep="floorplan" />

      {/* Floor Plan Editor */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-6xl mx-auto"
      >
        <FloorPlanEditor onPlanChange={setCurrentPlan} />
      </motion.div>

      {/* Footer Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-8 flex justify-center gap-4"
      >
        <Button
          size="lg"
          onClick={handleSaveAndContinue}
          disabled={!canContinue}
          className="h-12 px-8 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          Continue to Finishes
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>

      {!canContinue && currentPlan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            {currentPlan.rooms.length === 0
              ? "Add at least one room to continue"
              : currentPlan.totalArea < 300
              ? "ADU must be at least 300 sq ft"
              : ""}
          </p>
        </motion.div>
      )}
    </div>
  );
}
