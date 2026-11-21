import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { applyGroupPreset, resolveGroupPreset } from "../lib/permissions";
import type { GroupPermissions } from "../types";

const PERMISSION_ITEMS: Array<{
  key: keyof GroupPermissions;
  label: string;
  description: string;
}> = [
  {
    key: "onlyAdminsCanAddMembers",
    label: "Only admins can add members",
    description: "Restrict direct member additions to owners and admins.",
  },
  {
    key: "onlyAdminsCanShareLink",
    label: "Only admins can share invite link",
    description: "Only owners and admins can view and share the group link or QR code.",
  },
  {
    key: "onlyAdminsCanSend",
    label: "Only admins can send messages",
    description: "Mute ordinary members in this group.",
  },
  {
    key: "onlyAdminsCanEditInfo",
    label: "Only admins can edit group info",
    description: "Restrict name, description, and group photo edits to admins.",
  },
  {
    key: "requireAdminApproval",
    label: "Require admin approval",
    description: "Members joining via link or member add wait for an admin's approval.",
  },
];

export interface GroupPermissionsControlProps {
  value: GroupPermissions;
  onChange: (next: GroupPermissions) => void;
  disabled?: boolean;
}

export function GroupPermissionsControl({
  value,
  onChange,
  disabled = false,
}: GroupPermissionsControlProps) {
  const baseId = useId();
  const preset = resolveGroupPreset(value);

  return (
    <div className="flex flex-col gap-3">
      <fieldset
        className="m-0 flex flex-wrap items-center gap-2 border-0 p-0"
        aria-label="Permission preset"
      >
        <legend className="sr-only">Permission preset</legend>
        <Button
          type="button"
          size="sm"
          variant={preset === "open" ? "default" : "outline"}
          disabled={disabled}
          aria-pressed={preset === "open"}
          onClick={() => onChange(applyGroupPreset("open"))}
        >
          Open
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preset === "restricted" ? "default" : "outline"}
          disabled={disabled}
          aria-pressed={preset === "restricted"}
          onClick={() => onChange(applyGroupPreset("restricted"))}
        >
          Restricted
        </Button>
        {preset === "custom" && (
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Custom
          </span>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        {PERMISSION_ITEMS.map((item) => {
          const switchId = `${baseId}-${item.key}`;
          return (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <label htmlFor={switchId} className="flex min-w-0 flex-1 cursor-pointer flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </label>
              <Switch
                id={switchId}
                checked={value[item.key]}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    [item.key]: checked,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
