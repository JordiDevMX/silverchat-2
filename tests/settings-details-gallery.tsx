import { Camera, ImagePlus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../src/components/ui/avatar";
import { BackupCodesSurface } from "../src/components/ui/backup-codes-surface";
import { Button } from "../src/components/ui/button";
import { PublicProfileSurface } from "../src/components/ui/public-profile-surface";
import { SettingsDialog, SettingsPageSurface } from "../src/components/ui/settings-surfaces";

/** Provider-free states. None of these controls call services or alter an account. */
export function SettingsDetailsGallery() {
  const [modal, setModal] = useState<"avatar" | "codes" | "delete" | null>(null);
  const [crop, setCrop] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [unblocking, setUnblocking] = useState(false);
  const [rollback, setRollback] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <section id="settings-details-gallery" className="settings-details-gallery">
      <h2>Profile, account &amp; security</h2>
      <p>Local previews only. Demo codes do not grant access to any account.</p>
      <div className="settings-details-columns">
        <SettingsPageSurface title="Edit profile">
          <div className="profile-avatar-editor">
            <Button
              variant="ghost"
              className="profile-photo-trigger"
              onClick={() => {
                setCrop(false);
                setModal("avatar");
              }}
            >
              <Avatar initials="AR" size="xl" />
              <span>Preview photo picker</span>
            </Button>
          </div>
          <form
            className="settings-form settings-card settings-card-body"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice("Profile saved locally.");
            }}
          >
            <fieldset>
              <label htmlFor="preview-profile-name">Display name</label>
              <input id="preview-profile-name" defaultValue="Alice Rivera" maxLength={50} />
              <label htmlFor="preview-profile-username">Username</label>
              <input
                id="preview-profile-username"
                value="alice_rivera"
                readOnly
                aria-disabled="true"
              />
              <p className="quiet-note">You can change your username again in 30 days.</p>
              <label htmlFor="preview-profile-bio">Bio</label>
              <textarea
                id="preview-profile-bio"
                rows={3}
                defaultValue="A little more space for good conversations."
                maxLength={160}
              />
              <Button type="submit">Save preview profile</Button>
            </fieldset>
          </form>
          <div className="settings-form settings-card settings-card-body">
            <h2>Social links</h2>
            <label htmlFor="preview-profile-social">Portfolio</label>
            <input id="preview-profile-social" defaultValue="https://example.test/" />
            <Button variant="outline" onClick={() => setNotice("Links saved locally.")}>
              Save preview links
            </Button>
          </div>
        </SettingsPageSurface>
        <SettingsPageSurface title="Account">
          <div className="settings-card settings-card-body">
            <h2>Email</h2>
            <p>alice@example.test</p>
            <Button
              variant="outline"
              onClick={() => setNotice("Email confirmation preview — no email sent.")}
            >
              Preview email confirmation
            </Button>
          </div>
          <aside className="deletion-banner" aria-label="Preview scheduled deletion">
            <span>Your account is scheduled for deletion in 30 days.</span>
            <Button variant="outline" onClick={() => setNotice("Deletion canceled locally.")}>
              Preview cancel deletion
            </Button>
          </aside>
          <div className="settings-card settings-card-body danger-zone">
            <h2>Delete account</h2>
            <p>A typed confirmation protects this destructive action.</p>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmation("");
                setModal("delete");
              }}
            >
              Preview delete confirmation
            </Button>
          </div>
          <h2>Blocked contacts</h2>
          <div className="settings-card">
            {!unblocking ? (
              <div className="contact-row">
                <Avatar initials="U" />
                <span>
                  <strong>User 22222222</strong>
                  <small>@user_22222222</small>
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUnblocking(true);
                    setRollback(false);
                  }}
                >
                  Preview unblock
                </Button>
              </div>
            ) : (
              <p className="settings-empty">Optimistic preview: contact removed while saving.</p>
            )}
          </div>
          {unblocking && (
            <Button
              variant="outline"
              onClick={() => {
                setUnblocking(false);
                setRollback(true);
              }}
            >
              Simulate unblock failure
            </Button>
          )}
          {rollback && (
            <p role="alert" className="inline-error">
              Couldn’t unblock. Contact restored; try again.
            </p>
          )}
          <div className="settings-card settings-card-body security-card">
            <div className="security-heading">
              <ShieldCheck size={28} />
              <h2>Two-factor authentication</h2>
            </div>
            <p>Enabled · Authenticator app</p>
            <Button
              onClick={() => {
                setSaved(false);
                setNotice("");
                setModal("codes");
              }}
            >
              Preview backup codes
            </Button>
          </div>
        </SettingsPageSurface>
      </div>
      <div className="settings-profile-preview">
        <PublicProfileSurface
          avatar={<Avatar initials="AR" size="xl" />}
          name="Alice Rivera"
          username="alice_rivera"
          bio="A little more space for good conversations."
        >
          <div className="social-pills">
            <span>Portfolio · example.test</span>
            <span>Local profile preview</span>
          </div>
          <Button onClick={() => setNotice("Message request preview — nothing sent.")}>
            Preview message request
          </Button>
        </PublicProfileSurface>
      </div>
      <p role="status">{notice}</p>
      {modal === "avatar" && (
        <SettingsDialog
          title="Preview change photo"
          onClose={() => setModal(null)}
          className="avatar-picker-dialog"
        >
          {(close) => (
            <>
              {crop ? (
                <>
                  <div className="avatar-crop preview-avatar-crop">
                    <Avatar initials="AR" size="xl" style={{ transform: `scale(${zoom})` }} />
                  </div>
                  <label htmlFor="preview-avatar-zoom">Zoom {zoom.toFixed(1)}×</label>
                  <input
                    id="preview-avatar-zoom"
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </>
              ) : (
                <div className="avatar-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setZoom(1);
                      setCrop(true);
                    }}
                  >
                    <Camera />
                    Preview camera crop
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setZoom(1);
                      setCrop(true);
                    }}
                  >
                    <ImagePlus />
                    Preview upload crop
                  </Button>
                </div>
              )}
              <div className="modal-actions">
                <Button variant="outline" onClick={close}>
                  Cancel photo preview
                </Button>
                {crop && (
                  <Button
                    onClick={() => {
                      setNotice(
                        "Profile photo updated. The previous file could not be removed; cleanup is pending.",
                      );
                      setModal(null);
                    }}
                  >
                    Preview save with cleanup warning
                  </Button>
                )}
              </div>
            </>
          )}
        </SettingsDialog>
      )}
      {modal === "delete" && (
        <SettingsDialog title="Preview delete account" onClose={() => setModal(null)}>
          {(close) => (
            <>
              <p>
                Your account will be deleted after a 30-day grace period. This preview changes
                nothing.
              </p>
              <label htmlFor="preview-delete-confirm">Type DELETE to confirm preview</label>
              <input
                id="preview-delete-confirm"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
              <div className="modal-actions">
                <Button variant="outline" onClick={close}>
                  Cancel deletion preview
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmation !== "DELETE"}
                  onClick={() => {
                    setModal(null);
                    setNotice("Deletion scheduled locally.");
                  }}
                >
                  Schedule preview deletion
                </Button>
              </div>
            </>
          )}
        </SettingsDialog>
      )}
      {modal === "codes" && (
        <SettingsDialog title="Preview backup codes" onClose={() => {}} canClose={false}>
          {() => (
            <>
              <p className="settings-security-lock">
                This dialog stays locked until you acknowledge saving these demo codes.
              </p>
              <BackupCodesSurface
                codes={Array.from(
                  { length: 10 },
                  (_, i) => `DEMO-${String(i + 1).padStart(4, "0")}`,
                )}
                onCopy={() => setNotice("Demo copy acknowledged locally.")}
                onDownload={() => setNotice("Demo download acknowledged locally.")}
              />
              <p role="status">{notice}</p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                I’ve saved these demo codes
              </label>
              <Button disabled={!saved} onClick={() => setModal(null)}>
                Done with preview codes
              </Button>
            </>
          )}
        </SettingsDialog>
      )}
    </section>
  );
}
