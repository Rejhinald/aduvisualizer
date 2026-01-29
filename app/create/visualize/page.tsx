"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

export default function VisualizePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">
            3D Visualization
          </h1>
          <p className="text-muted-foreground">
            View your ADU design in 3D with AI-powered rendering
          </p>
        </div>

        {/* Placeholder Content */}
        <Card className="p-12 text-center space-y-4 min-h-[500px] flex flex-col items-center justify-center">
          <div className="text-6xl">🏠</div>
          <h2 className="text-xl font-semibold text-foreground">
            3D Visualization Coming Soon
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            This step will generate AI-powered 3D renderings of your ADU design
            using Nano Banana AI, allowing you to visualize your space from
            multiple angles.
          </p>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => router.push("/create/finishes")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Finishes
          </Button>
          <Button className="gap-2" disabled>
            <Download className="h-4 w-4" />
            Export Design
          </Button>
        </div>
      </div>
    </div>
  );
}
