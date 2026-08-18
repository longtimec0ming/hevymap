"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { OverridesPanel } from "@/components/settings/overrides-panel";
import { SyncPanel } from "@/components/settings/sync-panel";
import { TargetEditor } from "@/components/settings/target-editor";
import { usePrefs } from "@/lib/hooks/use-prefs";
import { useWorkoutData } from "@/lib/hooks/use-workout-data";

export default function SettingsPage() {
  const [prefs, updatePrefs] = usePrefs();
  const data = useWorkoutData();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="units">Units</Label>
              <p className="text-xs text-muted-foreground">
                Display-only — weight is always stored in kg and converted for display.
              </p>
            </div>
            <Select
              value={prefs.units}
              onValueChange={(value) => value && updatePrefs({ units: value as "kg" | "lbs" })}
            >
              <SelectTrigger id="units" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lbs">lbs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="week-start">Week starts on</Label>
              <p className="text-xs text-muted-foreground">Affects the dashboard, history and target periods.</p>
            </div>
            <Select
              value={String(prefs.weekStartsOn)}
              onValueChange={(value) => value && updatePrefs({ weekStartsOn: Number(value) as 0 | 1 })}
            >
              <SelectTrigger id="week-start" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="0">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="warmups">Include warm-up sets</Label>
              <p className="text-xs text-muted-foreground">Off by default; warm-ups are excluded from all volume totals.</p>
            </div>
            <Switch
              id="warmups"
              checked={prefs.includeWarmups}
              onCheckedChange={(checked) => updatePrefs({ includeWarmups: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Weekly targets</CardTitle>
        </CardHeader>
        <CardContent>
          <TargetEditor />
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Exercise mapping overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <OverridesPanel />
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <SyncPanel syncState={data.syncState} onSynced={data.refresh} />
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            HevyMap is an open-source, MIT-licensed sub-muscle volume tracker built on the Hevy API. No accounts, no
            server-side database — your workout data lives in this browser and in Hevy.
          </p>
          <p>See the repo&apos;s README and PLAN.md for the full spec and contribution guide.</p>
        </CardContent>
      </Card>
    </div>
  );
}
