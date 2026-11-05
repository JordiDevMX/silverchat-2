import { Bell, Laptop, LockKeyhole, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { Button } from "../src/components/ui/button";
import {
  SettingsRow,
  SettingsRowContent,
  settingsRowClassName,
} from "../src/components/ui/settings-row";
import {
  AccentChoice,
  SETTINGS_ACCENTS,
  SettingsDialog,
  SettingsPageSurface,
  SettingsShellSurface,
  SettingsToggle,
  ThemeChoice,
} from "../src/components/ui/settings-surfaces";

const navigation = [
  { label: "Appearance", icon: Palette },
  { label: "Notifications", icon: Bell },
  { label: "Privacy", icon: LockKeyhole },
  { label: "Devices", icon: Laptop },
];
export function SettingsGallery() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [accent, setAccent] = useState<(typeof SETTINGS_ACCENTS)[number]>("blue");
  const [enabled, setEnabled] = useState(true);
  const [sound, setSound] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <section id="settings-gallery" className="settings-gallery">
      <h2>Settings shell &amp; preferences</h2>
      <p>Real settings surfaces with local controls. Preview actions never save or sign out.</p>
      <SettingsShellSurface
        header={
          <>
            <strong>Settings preview</strong>
            <Avatar initials="AR" />
          </>
        }
        sidebar={
          <>
            <span className="settings-sidebar-title">Settings</span>
            <nav aria-label="Preview settings navigation">
              {navigation.map(({ label, icon: Glyph }) => {
                return (
                  <a
                    key={label}
                    href="#settings-gallery"
                    className={`setting-row ${settingsRowClassName}`}
                    aria-current={label === "Appearance" ? "page" : undefined}
                  >
                    <SettingsRowContent label={label} icon={<Glyph size={18} />} />
                  </a>
                );
              })}
            </nav>
            <p className="sidebar-foot">Fixture only</p>
          </>
        }
      >
        <SettingsPageSurface
          title="Preview preferences"
          description="The same silver surfaces and neon controls as the routed settings pages."
        >
          <div className="settings-card settings-card-body">
            <h2>Preview theme</h2>
            <div className="theme-options">
              {(
                [
                  { value: "light", icon: Sun },
                  { value: "dark", icon: Moon },
                  { value: "system", icon: Monitor },
                ] as const
              ).map(({ value, icon: Icon }) => (
                <ThemeChoice
                  key={value}
                  value={value}
                  label={`Preview ${value}`}
                  icon={<Icon size={17} />}
                  selected={theme === value}
                  onSelect={() => {
                    setTheme(value);
                    document.documentElement.dataset.theme =
                      value === "system"
                        ? matchMedia("(prefers-color-scheme: dark)").matches
                          ? "dark"
                          : "light"
                        : value;
                  }}
                />
              ))}
            </div>
          </div>
          <div className="settings-card settings-card-body">
            <h2>Preview accent</h2>
            <div className="accent-options">
              {SETTINGS_ACCENTS.map((value) => (
                <AccentChoice
                  key={value}
                  value={value}
                  label={`Preview ${value} accent`}
                  selected={accent === value}
                  onSelect={() => {
                    setAccent(value);
                    document.documentElement.className = `theme-${value}`;
                  }}
                />
              ))}
            </div>
          </div>
          <div className="settings-card settings-card-body">
            <SettingsToggle label="Preview notifications" checked={enabled} onChange={setEnabled} />
            <SettingsToggle
              label="Preview sound"
              description="Disabled when notifications are off."
              checked={sound}
              disabled={!enabled}
              onChange={setSound}
            />
          </div>
          <div className="settings-card">
            <SettingsRow
              label="Preview devices"
              subtitle="This device stays signed in"
              icon={<Laptop />}
              onClick={() => setNotice("Preview device details remain local.")}
            />
            <SettingsRow
              label="Preview read receipt confirmation"
              icon={<LockKeyhole />}
              onClick={() => setOpen(true)}
            />
          </div>
          <p className="quiet-note" role="status">
            {notice}
          </p>
        </SettingsPageSurface>
      </SettingsShellSurface>
      {open && (
        <SettingsDialog
          title="Preview read receipt confirmation"
          onClose={() => setOpen(false)}
          canClose={!busy}
        >
          {(close) => (
            <>
              <p>
                Confirmations use the same native focus trap and instant reduced-motion dismissal.
              </p>
              <SettingsToggle label="Preview pending save" checked={busy} onChange={setBusy} />
              <div className="modal-actions">
                <Button variant="outline" disabled={busy} onClick={close}>
                  Cancel settings preview
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setNotice("Preview preference confirmed locally.");
                    setOpen(false);
                  }}
                >
                  Confirm settings preview
                </Button>
              </div>
            </>
          )}
        </SettingsDialog>
      )}
    </section>
  );
}
