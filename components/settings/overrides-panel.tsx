"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clearOverrides, exportOverrides, getOverrides, importOverrides } from "@/lib/overrides";

export function OverridesPanel() {
  const [json, setJson] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const count = Object.keys(getOverrides()).length;

  const handleExport = () => {
    setJson(exportOverrides());
    toast.success(`Exported ${count} override${count === 1 ? "" : "s"}`);
  };

  const handleImport = () => {
    if (!json.trim()) {
      toast.error("Paste exported JSON first, or load a file below");
      return;
    }
    try {
      importOverrides(json, "merge");
      toast.success("Overrides imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setJson(text);
  };

  const handleClear = () => {
    clearOverrides();
    setJson("");
    toast("All overrides cleared");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{count} exercise mapping override{count === 1 ? "" : "s"} saved.</p>
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder="Exported overrides JSON appears here — or paste an exported file's contents to import."
        rows={8}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={handleExport}>
          Export
        </Button>
        <Button variant="outline" onClick={handleImport}>
          Import
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Load file…
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button variant="ghost" onClick={handleClear}>
          Clear all
        </Button>
      </div>
    </div>
  );
}
