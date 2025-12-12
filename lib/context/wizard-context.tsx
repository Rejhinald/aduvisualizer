"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { FloorPlan, Finishes, WizardStep } from "../types";
import { STORAGE_KEYS } from "../constants";

interface WizardContextType {
  currentStep: WizardStep;
  floorPlan: FloorPlan | null;
  finishes: Finishes | null;
  setCurrentStep: (step: WizardStep) => void;
  setFloorPlan: (plan: FloorPlan | null) => void;
  setFinishes: (finishes: Finishes | null) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStepState] = useState<WizardStep>("floorplan");
  const [floorPlan, setFloorPlanState] = useState<FloorPlan | null>(null);
  const [finishes, setFinishesState] = useState<Finishes | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedFloorPlan = localStorage.getItem(STORAGE_KEYS.FLOOR_PLAN);
      const savedFinishes = localStorage.getItem(STORAGE_KEYS.FINISHES);
      const savedStep = localStorage.getItem(STORAGE_KEYS.WIZARD_STATE);

      if (savedFloorPlan) {
        setFloorPlanState(JSON.parse(savedFloorPlan));
      }
      if (savedFinishes) {
        setFinishesState(JSON.parse(savedFinishes));
      }
      if (savedStep) {
        setCurrentStepState(savedStep as WizardStep);
      }
    } catch (error) {
      console.error("Error loading wizard state from localStorage:", error);
    }
  }, []);

  const setCurrentStep = useCallback((step: WizardStep) => {
    setCurrentStepState(step);
    localStorage.setItem(STORAGE_KEYS.WIZARD_STATE, step);
  }, []);

  const setFloorPlan = useCallback((plan: FloorPlan | null) => {
    setFloorPlanState(plan);
    if (plan) {
      localStorage.setItem(STORAGE_KEYS.FLOOR_PLAN, JSON.stringify(plan));
    } else {
      localStorage.removeItem(STORAGE_KEYS.FLOOR_PLAN);
    }
  }, []);

  const setFinishes = useCallback((finishes: Finishes | null) => {
    setFinishesState(finishes);
    if (finishes) {
      localStorage.setItem(STORAGE_KEYS.FINISHES, JSON.stringify(finishes));
    } else {
      localStorage.removeItem(STORAGE_KEYS.FINISHES);
    }
  }, []);

  const resetWizard = useCallback(() => {
    setCurrentStepState("floorplan");
    setFloorPlanState(null);
    setFinishesState(null);
    localStorage.removeItem(STORAGE_KEYS.FLOOR_PLAN);
    localStorage.removeItem(STORAGE_KEYS.FINISHES);
    localStorage.removeItem(STORAGE_KEYS.WIZARD_STATE);
  }, []);

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        floorPlan,
        finishes,
        setCurrentStep,
        setFloorPlan,
        setFinishes,
        resetWizard,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}
