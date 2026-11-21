import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import {
  MultiStepDialog,
  type MultiStepDialogStep,
} from "@/features/roles/components/MultiStepDialog";
import { PhotoEditorPanel } from "@/features/roles/components/PhotoEditorPanel";
import { Avatar } from "@/features/settings/components/shared";
import { useCreateChannelDialog } from "../../hooks/channels/useCreateChannelDialog";
import { slugify, validSlug } from "../../lib/storyOrdering";

export function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const {
    say,
    step,
    setStep,
    name,
    setName,
    slug,
    setSlug,
    setCustom,
    custom,
    description,
    setDescription,
    file,
    setFile,
    avatarSaved,
    term,
    error,
    busy,
    created,
    available,
    contacts,
    contactsLoading,
    contactSearch,
    setContactSearch,
    selectedContactIds,
    sentInviteContacts,
    failedInviteContacts,
    toggleContact,
    submit,
    finishLater,
  } = useCreateChannelDialog(onClose);

  const detailsValid =
    Boolean(name.trim()) &&
    validSlug(slug) &&
    (Boolean(created) || term !== slug || available.data !== false);

  const steps: MultiStepDialogStep[] = [
    {
      id: "details",
      title: say("Channel details", "Detalles del canal"),
      description: say(
        "Set a name, handle slug, and optional description.",
        "Configura nombre, slug y descripción opcional.",
      ),
      canProceed: detailsValid,
      content: (
        <div className="channel-form" data-clipboard-reason="avatar-hint">
          <label className="field">
            {say("Name", "Nombre")}
            <input
              value={name}
              maxLength={100}
              required
              disabled={busy || Boolean(created)}
              onChange={(e) => {
                setName(e.target.value);
                if (!custom && !created) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="field">
            {say("Slug", "Identificador")}
            <input
              value={slug}
              maxLength={50}
              pattern="[a-z0-9-]{3,50}"
              required
              disabled={busy || Boolean(created)}
              onChange={(e) => {
                setCustom(true);
                setSlug(e.target.value);
              }}
            />
          </label>
          {validSlug(slug) && !created && (
            <small role="status">
              {term !== slug || available.isFetching
                ? say("Checking availability…", "Comprobando disponibilidad…")
                : available.isError
                  ? say(
                      "Availability check failed; submit to retry.",
                      "Falló la comprobación; envía para reintentar.",
                    )
                  : available.data
                    ? say("Available", "Disponible")
                    : say("Slug already taken", "Identificador ocupado")}
            </small>
          )}
          <label className="field">
            {say("Description", "Descripción")}
            <textarea
              value={description}
              maxLength={500}
              disabled={busy || Boolean(created)}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      ),
    },
    {
      id: "photo",
      title: say("Channel photo", "Foto del canal"),
      description: say(
        "Optionally add a cropped square avatar for your channel.",
        "Agrega opcionalmente una foto circular para tu canal.",
      ),
      optional: true,
      content: (
        <PhotoEditorPanel
          stagedFile={file ?? null}
          busy={busy || avatarSaved}
          previewAlt={say("Channel photo preview", "Vista previa de foto del canal")}
          onSelectCropped={(cropped) => setFile(cropped)}
          onRemove={avatarSaved ? undefined : () => setFile(undefined)}
        />
      ),
    },
    {
      id: "invite",
      title: say("Invite contacts", "Invitar contactos"),
      description: say(
        "Invite your contacts to follow this channel.",
        "Invita a tus contactos a seguir este canal.",
      ),
      optional: true,
      content: (
        <div className="flex flex-col gap-3">
          <SearchField
            label={say("Search contacts", "Buscar contactos")}
            clearLabel={say("Clear search", "Limpiar búsqueda")}
            value={contactSearch}
            onChange={setContactSearch}
            onClear={() => setContactSearch("")}
          />
          {contactsLoading ? (
            <p className="text-sm text-muted-foreground">
              {say("Loading contacts…", "Cargando contactos…")}
            </p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {say("No matching contacts available.", "No hay contactos coincidentes disponibles.")}
            </p>
          ) : (
            <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
              {contacts.map((contact) => {
                const checked = selectedContactIds.includes(contact.id);
                const sent = sentInviteContacts.has(contact.id);
                const failed = failedInviteContacts.has(contact.id);
                return (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy || sent}
                        onChange={() => toggleContact(contact.id)}
                      />
                      <Avatar profile={contact} size="small" />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">{contact.display_name}</strong>
                        <small className="block truncate text-xs text-muted-foreground">
                          @{contact.username}
                        </small>
                      </span>
                    </span>
                    {sent ? (
                      <span className="text-xs font-medium text-primary">Sent</span>
                    ) : failed ? (
                      <span className="text-xs font-medium text-destructive">Retry needed</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
          {created && error && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
              <span>
                {say(
                  "Channel created. Retry remaining steps or open your channel now.",
                  "Canal creado. Reintenta los pasos restantes o abre el canal ahora.",
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={finishLater}
              >
                {say("Open channel", "Abrir canal")}
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <MultiStepDialog
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={
        created
          ? say("Retry pending", "Reintentar pendientes")
          : say("Create channel", "Crear canal")
      }
      submittingLabel={say("Working…", "Procesando…")}
      busy={busy}
      error={error || null}
      canClose={!busy}
      className="channel-create-modal channel-overlay"
      cancelLabel={say("Cancel", "Cancelar")}
      backLabel={say("Back", "Atrás")}
      nextLabel={say("Next", "Siguiente")}
      skipLabel={say("Skip", "Omitir")}
    />
  );
}
