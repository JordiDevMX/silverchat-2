import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { useContacts } from "../hooks";
import { usePreferences } from "../preferences-provider";
import { Avatar, QueryState, useAction } from "./shared";
export function ManageExclusionsModal({
  field,
  onClose,
}: {
  field: "profile_photo_exclusions" | "story_exclusions";
  onClose: () => void;
}) {
  const { settings, save } = usePreferences();
  const contacts = useContacts();
  const [selected, setSelected] = useState(new Set(settings?.[field] ?? []));
  const [search, setSearch] = useState("");
  const action = useAction();
  const { t } = useI18n();
  const visible =
    contacts.data?.filter((p) =>
      `${p.display_name} ${p.username}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <Modal title={t("Hide from…")} onClose={action.busy ? undefined : onClose}>
      <label htmlFor="contact-search">{t("Search contacts")}</label>
      <input
        id="contact-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryState
        loading={contacts.isLoading}
        error={contacts.error}
        retry={() => void contacts.refetch()}
      />
      <div className="contact-list">
        {visible.map((p) => (
          <label className="contact-row" key={p.id}>
            <Avatar profile={p} size="small" />
            <span>
              {p.display_name}
              <small>@{p.username}</small>
            </span>
            <input
              type="checkbox"
              checked={selected.has(p.id ?? "")}
              disabled={action.busy}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(p.id ?? "");
                else next.delete(p.id ?? "");
                setSelected(next);
              }}
            />
          </label>
        ))}
        {!contacts.isLoading && !contacts.error && !visible.length && (
          <p>{t("No contacts found.")}</p>
        )}
      </div>
      {action.feedback}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button primary"
          type="button"
          disabled={action.busy || contacts.isLoading || !!contacts.error}
          onClick={() =>
            void action.run(async () => {
              await save({ [field]: [...selected] });
              onClose();
            })
          }
        >
          {t("Save")} ({selected.size})
        </button>
      </div>
    </Modal>
  );
}
