"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function FinishesPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Select Your Finishes
          </h1>
          <p className="text-muted-foreground">
            Choose materials, colors, and optional features for your ADU
          </p>
        </div>

        {/* Placeholder Content */}
        <Card className="p-12 text-center space-y-4">
          <div className="text-6xl">🎨</div>
          <h2 className="text-xl font-semibold text-foreground">
            Finish Selection Coming Soon
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            This step will allow you to select flooring, countertops, cabinetry,
            paint colors, and other finishes for your ADU design.
          </p>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => router.push("/create/floorplan")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Floor Plan
          </Button>
          <Button
            onClick={() => router.push("/create/visualize")}
            className="gap-2"
          >
            Continue to 3D View
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
