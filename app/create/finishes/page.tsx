"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useWizard } from "@/lib/context/wizard-context";
import { useFinishes } from "@/lib/api/hooks";
import {
  ArrowLeft,
  ArrowRight,
  Paintbrush,
  Camera,
  Sparkles,
  Loader2,
  Check,
  Palette,
  Wand2,
  AlertCircle,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomFinish, CameraPlacement, TemplateOption, TierOption } from "@/lib/api/client";

// Vibe images are now served from /public/vibes/

export default function FinishesPage() {
  const router = useRouter();
  const { floorPlan, blueprintId, projectName } = useWizard();

  // Finishes hook
  const {
    finishes,
    options,
    renderStatus,
    loading,
    rendering,
    error,
    loadFinishes,
    ensureFinishes,
    updateRoomFinish,
    updateCamera,
    applyTemplate,
    generateRender,
    updateFinishes,
  } = useFinishes(blueprintId ?? undefined);

  // UI state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);

  // Extract rooms from floor plan
  const rooms = useMemo(() => {
    if (!floorPlan?.rooms) return [];
    return floorPlan.rooms.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      area: r.area,
    }));
  }, [floorPlan]);

  // Load finishes when blueprint ID is available
  useEffect(() => {
    if (blueprintId) {
      loadFinishes(blueprintId);
    }
  }, [blueprintId, loadFinishes]);

  // Get room finish for selected room
  const selectedRoomFinish = useMemo(() => {
    if (!selectedRoomId || !finishes) return null;
    return finishes.roomFinishes.find(rf => rf.roomId === selectedRoomId) || null;
  }, [selectedRoomId, finishes]);

  // Get selected room info
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find(r => r.id === selectedRoomId) || null;
  }, [selectedRoomId, rooms]);

  // Count rooms with vibes set
  const roomsWithVibes = finishes?.roomFinishes.length || 0;

  // Redirect if no floor plan
  if (!floorPlan || rooms.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold text-foreground">
              No Floor Plan Found
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please create a floor plan first before selecting finishes.
              You need at least one room to assign vibes.
            </p>
            <Button onClick={() => router.push("/create/floorplan")} className="gap-2">
              <Home className="h-4 w-4" />
              Go to Floor Plan Editor
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Select Your Finishes
          </h1>
          <p className="text-muted-foreground">
            Choose vibes and styles for each room, then generate AI renders
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Left: Room Preview / Render Gallery */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Your Rooms</Label>
              <Badge variant="secondary">
                {roomsWithVibes}/{rooms.length} styled
              </Badge>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {rooms.map(room => {
                const roomFinish = finishes?.roomFinishes.find(rf => rf.roomId === room.id);
                const hasVibe = !!roomFinish?.vibe;
                const isSelected = selectedRoomId === room.id;

                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      "relative rounded-lg border-2 p-4 text-left transition-all hover:shadow-md",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : hasVibe
                        ? "border-green-500/50 bg-green-50/50"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate">{room.name}</p>
                      <p className="text-xs text-muted-foreground">{room.area} sq ft</p>
                    </div>
                    {hasVibe ? (
                      <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
                        <Check className="h-3 w-3 mr-0.5" />
                        {roomFinish?.vibe.replace("_", " ")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="absolute top-2 right-2 text-[10px] text-muted-foreground">
                        Not set
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Recent Renders */}
            {(finishes?.topDownPreviewUrl || finishes?.firstPersonPreviewUrl) && (
              <div className="pt-4 border-t space-y-3">
                <Label className="text-sm font-medium">Generated Renders</Label>
                <div className="grid grid-cols-2 gap-3">
                  {finishes.topDownPreviewUrl && (
                    <a
                      href={finishes.topDownPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <img
                        src={finishes.topDownPreviewUrl}
                        alt="Top-down render"
                        className="w-full h-32 object-cover rounded-lg border group-hover:opacity-90 transition-opacity"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Top-Down View</p>
                    </a>
                  )}
                  {finishes.firstPersonPreviewUrl && (
                    <a
                      href={finishes.firstPersonPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <img
                        src={finishes.firstPersonPreviewUrl}
                        alt="First-person render"
                        className="w-full h-32 object-cover rounded-lg border group-hover:opacity-90 transition-opacity"
                      />
                      <p className="text-xs text-muted-foreground mt-1">First-Person View</p>
                    </a>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Right: Finishes Panel */}
          <Card className="p-4">
            {loading && !options ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="vibes" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="vibes" className="text-xs">
                    <Paintbrush className="h-3.5 w-3.5 mr-1" />
                    Vibes
                  </TabsTrigger>
                  <TabsTrigger value="camera" className="text-xs">
                    <Camera className="h-3.5 w-3.5 mr-1" />
                    Camera
                  </TabsTrigger>
                  <TabsTrigger value="render" className="text-xs">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Render
                  </TabsTrigger>
                </TabsList>

                {/* Vibes Tab */}
                <TabsContent value="vibes" className="space-y-4 mt-4">
                  {/* Global Tier */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Quality Tier</Label>
                    <Select
                      value={finishes?.globalTier || "standard"}
                      onValueChange={async (value) => {
                        await ensureFinishes();
                        updateFinishes({ globalTier: value as TierOption });
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options?.tiers.map(tier => (
                          <SelectItem key={tier.id} value={tier.id} className="text-sm">
                            <span className="font-medium">{tier.label}</span>
                            <span className="text-muted-foreground ml-2">- {tier.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Template Presets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Quick Template</Label>
                      <Badge variant="outline" className="text-[10px]">
                        <Wand2 className="h-3 w-3 mr-1" />
                        Auto-fill
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {options?.templates.map(template => (
                        <Button
                          key={template.id}
                          variant={selectedTemplate === template.id ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-auto py-2 justify-start"
                          onClick={async () => {
                            setSelectedTemplate(template.id);
                            await ensureFinishes();
                            await applyTemplate(template.id, false);
                          }}
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Templates fill empty rooms only. Already-styled rooms are kept.
                    </p>
                  </div>

                  {/* Vibe Selector for Selected Room */}
                  {selectedRoom && options && (
                    <div className="space-y-3 pt-3 border-t">
                      <Label className="text-sm font-medium">
                        Vibe for {selectedRoom.name}
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {options.vibes.map(vibe => {
                          const isSelected = selectedRoomFinish?.vibe === vibe.id;
                          return (
                            <button
                              key={vibe.id}
                              className={cn(
                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/20"
                                  : "border-transparent hover:border-muted-foreground/30"
                              )}
                              onClick={async () => {
                                await ensureFinishes();
                                updateRoomFinish({
                                  roomId: selectedRoom.id,
                                  roomName: selectedRoom.name,
                                  roomType: selectedRoom.type,
                                  vibe: vibe.id,
                                  tier: finishes?.globalTier || "standard",
                                  lifestyle: selectedRoomFinish?.lifestyle || [],
                                });
                              }}
                            >
                              <img
                                src={`/vibes/${vibe.id}.jpg`}
                                alt={vibe.label}
                                className="w-full h-20 object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <span className="absolute bottom-1 left-1 text-[10px] text-white font-medium">
                                {vibe.label}
                              </span>
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Lifestyle Options */}
                      {options.lifestylesByRoomType[selectedRoom.type] && (
                        <div className="pt-2 border-t">
                          <Label className="text-xs font-medium mb-2 block">
                            <Palette className="h-3 w-3 inline mr-1" />
                            Lifestyle Options
                          </Label>
                          <div className="flex flex-wrap gap-1">
                            {options.lifestylesByRoomType[selectedRoom.type].map(lifestyle => {
                              const isActive = selectedRoomFinish?.lifestyle?.includes(lifestyle.id);
                              return (
                                <Badge
                                  key={lifestyle.id}
                                  variant={isActive ? "default" : "outline"}
                                  className="text-[10px] cursor-pointer hover:bg-muted"
                                  onClick={async () => {
                                    if (!selectedRoomFinish) return;
                                    const current = selectedRoomFinish.lifestyle || [];
                                    const updated = isActive
                                      ? current.filter(l => l !== lifestyle.id)
                                      : [...current, lifestyle.id];
                                    updateRoomFinish({
                                      ...selectedRoomFinish,
                                      lifestyle: updated,
                                    });
                                  }}
                                >
                                  {lifestyle.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedRoom && (
                    <div className="py-8 text-center border rounded-lg bg-muted/30">
                      <Paintbrush className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Select a room on the left to choose its vibe
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Camera Tab */}
                <TabsContent value="camera" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">First-Person Camera</Label>
                    <p className="text-xs text-muted-foreground">
                      The camera is placed on the floor plan editor. Go back to the floor plan
                      and switch to "Finishes & 3D" mode to position the camera.
                    </p>

                    {finishes?.cameraPlacement ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted rounded p-2">
                            <span className="text-muted-foreground">Position:</span>
                            <span className="ml-1 font-mono">
                              ({finishes.cameraPlacement.position.x.toFixed(0)}, {finishes.cameraPlacement.position.y.toFixed(0)})
                            </span>
                          </div>
                          <div className="bg-muted rounded p-2">
                            <span className="text-muted-foreground">Rotation:</span>
                            <span className="ml-1 font-mono">{finishes.cameraPlacement.rotation}°</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={String(finishes.cameraPlacement.fov)}
                            onValueChange={async (value) => {
                              if (finishes.cameraPlacement) {
                                await ensureFinishes();
                                updateCamera({
                                  ...finishes.cameraPlacement,
                                  fov: Number(value) as 30 | 60 | 90,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30° FOV (Narrow)</SelectItem>
                              <SelectItem value="60">60° FOV (Normal)</SelectItem>
                              <SelectItem value="90">90° FOV (Wide)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={async () => {
                              await ensureFinishes();
                              updateCamera(null);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center border rounded-lg bg-muted/30">
                        <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          No camera placed yet.
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs mt-2"
                          onClick={() => router.push("/create/floorplan")}
                        >
                          Go to Floor Plan Editor
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Render Tab */}
                <TabsContent value="render" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Generate AI Renders</Label>
                      {renderStatus && (
                        <Badge variant={renderStatus.available ? "default" : "secondary"} className="text-[10px]">
                          {renderStatus.available ? "Ready" : "Offline"}
                        </Badge>
                      )}
                    </div>

                    {!renderStatus?.available ? (
                      <div className="py-6 text-center border rounded-lg bg-amber-50">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                        <p className="text-xs text-muted-foreground">
                          Render service is not available. Check GEMINI_API_KEY configuration.
                        </p>
                      </div>
                    ) : roomsWithVibes === 0 ? (
                      <div className="py-6 text-center border rounded-lg bg-muted/30">
                        <Paintbrush className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          Set vibes for at least one room to generate renders.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          className="w-full"
                          onClick={() => generateRender("topdown", "preview")}
                          disabled={rendering}
                        >
                          {rendering ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Generate Top-Down View
                        </Button>

                        {finishes?.cameraPlacement && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => generateRender("firstperson", "preview")}
                            disabled={rendering}
                          >
                            {rendering ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Camera className="h-4 w-4 mr-2" />
                            )}
                            Generate First-Person View
                          </Button>
                        )}

                        {rendering && (
                          <p className="text-xs text-muted-foreground text-center">
                            Generating... This may take up to 30 seconds.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
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
            disabled={roomsWithVibes === 0}
          >
            Continue to 3D View
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
