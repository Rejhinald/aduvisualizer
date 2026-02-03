"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Clock, Save, Trash2, RotateCcw } from "lucide-react";
import type { EditorSnapshot } from "../hooks/use-version-history";

interface RestoreDropdownProps {
  autoSaves: EditorSnapshot[];
  manualSaves: EditorSnapshot[];
  onRestore: (snapshotId: string) => void;
  onSaveManual: (label?: string) => void;
  onDelete?: (snapshotId: string) => void;
  formatTimestamp: (timestamp: string) => string;
  getTimeAgo: (timestamp: string) => string;
}

export function RestoreDropdown({
  autoSaves,
  manualSaves,
  onRestore,
  onSaveManual,
  onDelete,
  formatTimestamp,
  getTimeAgo,
}: RestoreDropdownProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<EditorSnapshot | null>(null);
  const [saveLabel, setSaveLabel] = useState("");

  const handleSaveManual = () => {
    onSaveManual(saveLabel || undefined);
    setSaveLabel("");
    setSaveDialogOpen(false);
  };

  const handleRestoreClick = (snapshot: EditorSnapshot) => {
    setSelectedSnapshot(snapshot);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = () => {
    if (selectedSnapshot) {
      onRestore(selectedSnapshot.id);
      setRestoreDialogOpen(false);
      setSelectedSnapshot(null);
    }
  };

  const totalSaves = autoSaves.length + manualSaves.length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Restore</span>
            {totalSaves > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {totalSaves}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Version History</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setSaveDialogOpen(true)}
            >
              <Save className="h-3 w-3" />
              Save Now
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <Tabs defaultValue="auto" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="auto" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                Auto ({autoSaves.length})
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-xs gap-1">
                <Save className="h-3 w-3" />
                Manual ({manualSaves.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="mt-2 max-h-64 overflow-y-auto">
              {autoSaves.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No auto-saves yet.
                  <br />
                  <span className="text-xs">Auto-saves every 10 minutes</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {autoSaves.map((snapshot) => (
                    <DropdownMenuItem
                      key={snapshot.id}
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => handleRestoreClick(snapshot)}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{formatTimestamp(snapshot.timestamp)}</span>
                        <span className="text-xs text-muted-foreground">
                          {getTimeAgo(snapshot.timestamp)}
                        </span>
                      </div>
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-2 max-h-64 overflow-y-auto">
              {manualSaves.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No manual saves yet.
                  <br />
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0 h-auto"
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    Save a version now
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {manualSaves.map((snapshot) => (
                    <DropdownMenuItem
                      key={snapshot.id}
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => handleRestoreClick(snapshot)}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm truncate">
                          {snapshot.label || "Saved version"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(snapshot.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(snapshot.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Auto-saves are kept for 1 hour (every 10 min)
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
            <DialogDescription>
              Create a named save point you can restore to later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="save-label">Version Name (optional)</Label>
              <Input
                id="save-label"
                placeholder="e.g., Before adding kitchen"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveManual();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveManual}>
              <Save className="h-4 w-4 mr-2" />
              Save Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore to this version? Your current work will be replaced.
            </DialogDescription>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <div className="font-medium">
                {selectedSnapshot.label || (selectedSnapshot.type === "auto" ? "Auto-save" : "Manual save")}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTimestamp(selectedSnapshot.timestamp)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {selectedSnapshot.data.rooms.length} rooms, {selectedSnapshot.data.doors.length} doors, {selectedSnapshot.data.windows.length} windows
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirmRestore}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
