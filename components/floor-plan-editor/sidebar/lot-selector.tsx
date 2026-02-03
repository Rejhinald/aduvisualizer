"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { MapPin, Search, Trash2, RotateCcw, Move, Loader2, X, AlertCircle, Map, Square, Pencil, PenTool, ChevronDown, LandPlot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AddressResult, Lot, ParcelData } from "@/lib/api/client";

interface LotSelectorProps {
  lot: Lot | null;
  showOverlay: boolean;
  showSatellite?: boolean;
  showLotBoundary?: boolean;
  loading: boolean;
  error: string | null;
  addressResults: AddressResult[];
  onToggleOverlay: (show: boolean) => void;
  onToggleSatellite?: (show: boolean) => void;
  onToggleLotBoundary?: (show: boolean) => void;
  onSearchAddress: (query: string) => Promise<AddressResult[]>;
  onSelectAddress: (address: AddressResult) => void;
  onFetchParcel: (lat: number, lng: number) => Promise<ParcelData | null>;
  onUpdatePosition: (offsetX: number, offsetY: number, rotation?: number) => void;
  onUpdateSetbacks: (setbacks: { front?: number; back?: number; left?: number; right?: number }) => void;
  onUpdateLotDimensions?: (width: number, depth: number) => void;
  onRemoveLot: () => void;
  onClearAddressResults: () => void;
  // Live preview callbacks - update immediately for smooth UI
  onPreviewPosition?: (offsetX: number, offsetY: number) => void;
  onPreviewRotation?: (rotation: number) => void;
  // Lot boundary drawing mode
  isDrawingLotBoundary?: boolean;
  onStartDrawingLotBoundary?: () => void;
  onCancelDrawingLotBoundary?: () => void;
}

export function LotSelector({
  lot,
  showOverlay,
  showSatellite = false,
  showLotBoundary = true,
  loading,
  error,
  addressResults,
  onToggleOverlay,
  onToggleSatellite,
  onToggleLotBoundary,
  onSearchAddress,
  onSelectAddress,
  onFetchParcel,
  onUpdatePosition,
  onUpdateSetbacks,
  onUpdateLotDimensions,
  onRemoveLot,
  onClearAddressResults,
  onPreviewPosition,
  onPreviewRotation,
  isDrawingLotBoundary = false,
  onStartDrawingLotBoundary,
  onCancelDrawingLotBoundary,
}: LotSelectorProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [localOffsetX, setLocalOffsetX] = useState(lot?.aduOffsetX ?? 0);
  const [localOffsetY, setLocalOffsetY] = useState(lot?.aduOffsetY ?? 0);
  const [localRotation, setLocalRotation] = useState(lot?.aduRotation ?? 0);
  const [isEditingDimensions, setIsEditingDimensions] = useState(false);
  const [localWidth, setLocalWidth] = useState(lot?.lotWidthFeet ?? 50);
  const [localDepth, setLocalDepth] = useState(lot?.lotDepthFeet ?? 100);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const positionUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track if we're currently dragging to prevent server sync from overwriting
  const isDraggingRef = useRef(false);

  // Fixed slider range for X/Y positioning (-100 to 100 feet)
  const sliderRange = { min: -100, max: 100 };

  // Sync local state with lot data only when not dragging
  useEffect(() => {
    if (lot && !isDraggingRef.current) {
      setLocalOffsetX(lot.aduOffsetX);
      setLocalOffsetY(lot.aduOffsetY);
      setLocalRotation(lot.aduRotation);
    }
    if (lot) {
      setLocalWidth(lot.lotWidthFeet || 50);
      setLocalDepth(lot.lotDepthFeet || 100);
    }
  }, [lot]);

  // Debounced address search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        onSearchAddress(value);
        setShowResults(true);
      }, 300);
    } else {
      onClearAddressResults();
      setShowResults(false);
    }
  }, [onSearchAddress, onClearAddressResults]);

  // Handle address selection
  const handleSelectAddress = useCallback(async (address: AddressResult) => {
    setSearchQuery(address.displayName.split(",")[0]); // Show just the street address
    setShowResults(false);
    onClearAddressResults();
    onSelectAddress(address);

    // Fetch parcel data for the selected address
    await onFetchParcel(address.lat, address.lng);
  }, [onSelectAddress, onFetchParcel, onClearAddressResults]);

  // Handle position update (debounced server update, immediate preview)
  const handlePositionChange = useCallback((x: number, y: number) => {
    isDraggingRef.current = true;
    setLocalOffsetX(x);
    setLocalOffsetY(y);

    // Immediate preview update for smooth canvas rendering
    onPreviewPosition?.(x, y);

    // Clear any pending update
    if (positionUpdateRef.current) {
      clearTimeout(positionUpdateRef.current);
    }

    // Debounce the server update
    positionUpdateRef.current = setTimeout(() => {
      onUpdatePosition(x, y);
      // Allow sync after a short delay
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    }, 150);
  }, [onUpdatePosition, onPreviewPosition]);

  // Handle rotation update (debounced server update, immediate preview)
  const handleRotationChange = useCallback((rotation: number) => {
    isDraggingRef.current = true;
    setLocalRotation(rotation);

    // Immediate preview update for smooth canvas rendering
    onPreviewRotation?.(rotation);

    if (positionUpdateRef.current) {
      clearTimeout(positionUpdateRef.current);
    }

    positionUpdateRef.current = setTimeout(() => {
      onUpdatePosition(localOffsetX, localOffsetY, rotation);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    }, 150);
  }, [onUpdatePosition, onPreviewRotation, localOffsetX, localOffsetY]);

  // Reset ADU position
  const handleResetPosition = useCallback(() => {
    isDraggingRef.current = false;
    setLocalOffsetX(0);
    setLocalOffsetY(0);
    setLocalRotation(0);
    onUpdatePosition(0, 0, 0);
  }, [onUpdatePosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateRef.current) {
        clearTimeout(positionUpdateRef.current);
      }
    };
  }, []);

  // Handle dimension update
  const handleSaveDimensions = useCallback(() => {
    if (onUpdateLotDimensions && localWidth > 0 && localDepth > 0) {
      onUpdateLotDimensions(localWidth, localDepth);
      setIsEditingDimensions(false);
    }
  }, [onUpdateLotDimensions, localWidth, localDepth]);

  return (
    <TooltipProvider>
      <Card className="shadow-md transition-shadow hover:shadow-lg overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-2">
                <LandPlot className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold text-foreground cursor-pointer">
                  Lot Overlay
                </Label>
                {lot && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded",
                    showOverlay ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground"
                  )}>
                    {showOverlay ? "On" : "Off"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={showOverlay}
                        onCheckedChange={onToggleOverlay}
                        disabled={!lot}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {lot ? "Toggle lot boundary overlay on canvas" : "Add a lot first to enable overlay"}
                  </TooltipContent>
                </Tooltip>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3">
              {/* Address Search */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Property Address</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search address in Orange County..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => addressResults.length > 0 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    className="pl-8 pr-8 h-8 text-xs"
                  />
                  {loading && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                  )}
                  {searchQuery && !loading && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        onClearAddressResults();
                        setShowResults(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Search Results Dropdown */}
                  {showResults && addressResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {addressResults.map((result) => (
                        <button
                          key={result.placeId}
                          type="button"
                          onClick={() => handleSelectAddress(result)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-secondary transition-colors border-b last:border-b-0"
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <span className="line-clamp-2">{result.displayName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* Lot Info */}
              {lot && (
                <>
                  <div className="p-2.5 bg-secondary rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Address:</span>
                      <span className="text-xs font-medium truncate max-w-[140px]">
                        {lot.address || "Not available"}
                      </span>
                    </div>
                    {lot.parcelNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">APN:</span>
                        <span className="text-xs font-medium">{lot.parcelNumber}</span>
                      </div>
                    )}
                    {lot.lotAreaSqFt && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Lot Area:</span>
                        <span className="text-xs font-medium">
                          {lot.lotAreaSqFt.toLocaleString()} sq ft
                        </span>
                      </div>
                    )}
                    {lot.lotWidthFeet && lot.lotDepthFeet && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Dimensions:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">
                            {Math.round(lot.lotWidthFeet)}' x {Math.round(lot.lotDepthFeet)}'
                          </span>
                          {onUpdateLotDimensions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsEditingDimensions(true)}
                              className="h-5 w-5 p-0"
                              title="Edit lot dimensions"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Lot Dimensions Editor */}
                  {isEditingDimensions && onUpdateLotDimensions && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                      <Label className="text-xs font-medium text-amber-800">Edit Lot Dimensions</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">Width (ft)</span>
                          <Input
                            type="number"
                            min={10}
                            max={500}
                            value={localWidth}
                            onChange={(e) => setLocalWidth(parseFloat(e.target.value) || 50)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">Depth (ft)</span>
                          <Input
                            type="number"
                            min={10}
                            max={500}
                            value={localDepth}
                            onChange={(e) => setLocalDepth(parseFloat(e.target.value) || 100)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLocalWidth(lot.lotWidthFeet || 50);
                            setLocalDepth(lot.lotDepthFeet || 100);
                            setIsEditingDimensions(false);
                          }}
                          className="flex-1 h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveDimensions}
                          className="flex-1 h-7 text-xs"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Draw Lot Boundary */}
                  {onStartDrawingLotBoundary && (
                    <div className="py-1">
                      {isDrawingLotBoundary ? (
                        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <PenTool className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-800">Drawing Lot Boundary</span>
                          </div>
                          <p className="text-[10px] text-blue-700">
                            Click on the canvas to add points. Click near the first point to close the polygon.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancelDrawingLotBoundary}
                            className="w-full h-7 text-xs"
                          >
                            Cancel Drawing
                          </Button>
                        </div>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onStartDrawingLotBoundary}
                              className="w-full text-xs"
                            >
                              <PenTool className="h-3.5 w-3.5 mr-1.5" />
                              Draw Lot Boundary
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Draw a custom polygon shape for the lot boundary</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}

                  {/* Satellite View Toggle */}
                  {onToggleSatellite && (
                    <div className="flex items-center justify-between py-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Map className="h-3.5 w-3.5" />
                        Satellite Imagery
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {showSatellite ? "On" : "Off"}
                            </span>
                            <Switch
                              checked={showSatellite}
                              onCheckedChange={onToggleSatellite}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {showSatellite ? "Hide satellite imagery" : "Show satellite imagery on canvas"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}

                  {/* Lot Boundary Toggle */}
                  {onToggleLotBoundary && (
                    <div className="flex items-center justify-between py-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Square className="h-3.5 w-3.5" />
                        Lot Boundary
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {showLotBoundary ? "On" : "Off"}
                            </span>
                            <Switch
                              checked={showLotBoundary}
                              onCheckedChange={onToggleLotBoundary}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {showLotBoundary ? "Hide lot boundary lines" : "Show lot boundary lines"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}

                  {/* ADU Position Controls */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Move className="h-3.5 w-3.5" />
                        ADU Position
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetPosition}
                            className="h-6 px-2 text-[10px]"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset ADU to center of lot</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* X Offset */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Offset X:</span>
                        <span className="text-[10px] font-medium">{localOffsetX.toFixed(1)} ft</span>
                      </div>
                      <Slider
                        value={[localOffsetX]}
                        min={sliderRange.min}
                        max={sliderRange.max}
                        step={0.5}
                        onValueChange={([v]) => handlePositionChange(v, localOffsetY)}
                        className="h-1"
                      />
                    </div>

                    {/* Y Offset */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Offset Y:</span>
                        <span className="text-[10px] font-medium">{localOffsetY.toFixed(1)} ft</span>
                      </div>
                      <Slider
                        value={[localOffsetY]}
                        min={sliderRange.min}
                        max={sliderRange.max}
                        step={0.5}
                        onValueChange={([v]) => handlePositionChange(localOffsetX, v)}
                        className="h-1"
                      />
                    </div>

                    {/* Rotation */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Rotation:</span>
                        <span className="text-[10px] font-medium">{localRotation.toFixed(0)}°</span>
                      </div>
                      <Slider
                        value={[localRotation]}
                        min={0}
                        max={360}
                        step={5}
                        onValueChange={([v]) => handleRotationChange(v)}
                        className="h-1"
                      />
                    </div>
                  </div>

                  {/* Setbacks */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs text-muted-foreground">LA ADU Setbacks (ft)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Front</span>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={lot.setbackFrontFeet}
                          onChange={(e) => onUpdateSetbacks({ front: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Back</span>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={lot.setbackBackFeet}
                          onChange={(e) => onUpdateSetbacks({ back: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Left</span>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={lot.setbackLeftFeet}
                          onChange={(e) => onUpdateSetbacks({ left: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Right</span>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={lot.setbackRightFeet}
                          onChange={(e) => onUpdateSetbacks({ right: parseFloat(e.target.value) || 0 })}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Remove Lot Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRemoveLot}
                        className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Remove Lot
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove lot overlay from this blueprint</TooltipContent>
                  </Tooltip>
                </>
              )}

              {/* Help Text */}
              {!lot && (
                <div className="p-2.5 rounded-lg border bg-blue-50 border-blue-200">
                  <p className="text-xs leading-relaxed text-blue-800">
                    Enter a property address in Orange County to overlay your lot boundary on the floor plan.
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </TooltipProvider>
  );
}
