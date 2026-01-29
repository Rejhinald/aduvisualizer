"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { FloorPlan, Finishes, WizardStep, Point } from "../types";
import { STORAGE_KEYS } from "../constants";
import * as api from "../api/client";
import { convertEditorDataToApi } from "../api/floor-plan-converter";
import type { Furniture } from "@/components/floor-plan-editor";

interface EditorData {
  rooms: FloorPlan["rooms"];
  doors: FloorPlan["doors"];
  windows: FloorPlan["windows"];
  furniture: Furniture[];
  aduBoundary: Point[];
  pixelsPerFoot: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface WizardContextType {
  currentStep: WizardStep;
  floorPlan: FloorPlan | null;
  finishes: Finishes | null;
  // Project and Blueprint state
  projectId: string | null;
  blueprintId: string | null;
  projectName: string;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: string | null;
  // Methods
  setCurrentStep: (step: WizardStep) => void;
  setFloorPlan: (plan: FloorPlan | null) => void;
  setFinishes: (finishes: Finishes | null) => void;
  resetWizard: () => void;
  // Project/Blueprint methods
  setProjectName: (name: string) => void;
  saveToCloud: (editorData: EditorData) => Promise<boolean>;
  setGeoLocation: (lat: number, lng: number, rotation?: number) => Promise<boolean>;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStepState] = useState<WizardStep>("floorplan");
  const [floorPlan, setFloorPlanState] = useState<FloorPlan | null>(null);
  const [finishes, setFinishesState] = useState<Finishes | null>(null);

  // Project and Blueprint state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [projectName, setProjectNameState] = useState<string>("My ADU Project");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedFloorPlan = localStorage.getItem(STORAGE_KEYS.FLOOR_PLAN);
      const savedFinishes = localStorage.getItem(STORAGE_KEYS.FINISHES);
      const savedStep = localStorage.getItem(STORAGE_KEYS.WIZARD_STATE);
      const savedProjectId = localStorage.getItem("aduvisualizer:projectId");
      const savedBlueprintId = localStorage.getItem("aduvisualizer:blueprintId");
      const savedProjectName = localStorage.getItem("aduvisualizer:projectName");

      if (savedFloorPlan) {
        setFloorPlanState(JSON.parse(savedFloorPlan));
      }
      if (savedFinishes) {
        setFinishesState(JSON.parse(savedFinishes));
      }
      if (savedStep) {
        setCurrentStepState(savedStep as WizardStep);
      }
      if (savedProjectId) {
        setProjectId(savedProjectId);
      }
      if (savedBlueprintId) {
        setBlueprintId(savedBlueprintId);
      }
      if (savedProjectName) {
        setProjectNameState(savedProjectName);
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
    setProjectId(null);
    setBlueprintId(null);
    setProjectNameState("My ADU Project");
    setLastSavedAt(null);
    setSaveError(null);
    localStorage.removeItem(STORAGE_KEYS.FLOOR_PLAN);
    localStorage.removeItem(STORAGE_KEYS.FINISHES);
    localStorage.removeItem(STORAGE_KEYS.WIZARD_STATE);
    localStorage.removeItem("aduvisualizer:projectId");
    localStorage.removeItem("aduvisualizer:blueprintId");
    localStorage.removeItem("aduvisualizer:projectName");
  }, []);

  const setProjectName = useCallback((name: string) => {
    setProjectNameState(name);
    localStorage.setItem("aduvisualizer:projectName", name);
  }, []);

  // Save floor plan to cloud backend
  const saveToCloud = useCallback(async (editorData: EditorData): Promise<boolean> => {
    setIsSaving(true);
    setSaveError(null);

    try {
      let currentProjectId = projectId;

      // Create project if it doesn't exist
      if (!currentProjectId) {
        const projectResponse = await api.createProject({
          name: projectName,
          description: "ADU Floor Plan Project",
        });
        currentProjectId = projectResponse.data.id;
        setProjectId(currentProjectId);
        localStorage.setItem("aduvisualizer:projectId", currentProjectId);
      }

      // Convert editor data to API format
      const convertedRooms = editorData.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        color: room.color,
        vertices: room.vertices,
        area: room.area,
        rotation: 0,
        description: room.description,  // Include description for "other" type rooms
      }));

      const convertedDoors = editorData.doors.map((door) => ({
        id: door.id,
        type: door.type,
        x: door.position.x,
        y: door.position.y,
        width: door.width,
        rotation: door.rotation,
      }));

      const convertedWindows = editorData.windows.map((win) => ({
        id: win.id,
        type: win.type,
        x: win.position.x,
        y: win.position.y,
        width: win.width,
        height: win.height,
        rotation: win.rotation,
      }));

      const convertedFurniture = editorData.furniture.map((item) => ({
        id: item.id,
        type: item.type,
        x: item.position.x,
        y: item.position.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      }));

      const apiData = convertEditorDataToApi(currentProjectId, {
        rooms: convertedRooms,
        doors: convertedDoors,
        windows: convertedWindows,
        furniture: convertedFurniture,
        aduBoundary: editorData.aduBoundary,
        pixelsPerFoot: editorData.pixelsPerFoot,
        canvasWidth: editorData.canvasWidth,
        canvasHeight: editorData.canvasHeight,
      }, {
        name: projectName,
        isValid: true,
      });

      // Save blueprint
      const blueprintResponse = await api.saveBlueprint(apiData);
      const newBlueprintId = blueprintResponse.data.blueprint.id;
      setBlueprintId(newBlueprintId);
      localStorage.setItem("aduvisualizer:blueprintId", newBlueprintId);

      const now = new Date().toISOString();
      setLastSavedAt(now);

      console.log("Blueprint saved successfully:", {
        projectId: currentProjectId,
        blueprintId: newBlueprintId,
        version: blueprintResponse.data.blueprint.version,
        summary: blueprintResponse.data.summary,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save blueprint";
      setSaveError(errorMessage);
      console.error("Error saving to cloud:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [projectId, projectName]);

  // Set geo-location for the project
  const setGeoLocation = useCallback(async (lat: number, lng: number, rotation: number = 0): Promise<boolean> => {
    if (!projectId) {
      setSaveError("No project created yet. Save your blueprint first.");
      return false;
    }

    try {
      await api.setProjectGeoLocation(projectId, { lat, lng, rotation });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to set geo-location";
      setSaveError(errorMessage);
      console.error("Error setting geo-location:", error);
      return false;
    }
  }, [projectId]);

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        floorPlan,
        finishes,
        projectId,
        blueprintId,
        projectName,
        isSaving,
        saveError,
        lastSavedAt,
        setCurrentStep,
        setFloorPlan,
        setFinishes,
        resetWizard,
        setProjectName,
        saveToCloud,
        setGeoLocation,
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
