import { useMessageText } from "@/features/messages/i18n";

export function ChannelFollowFooter({
  busy,
  error,
  onFollow,
}: {
  busy: boolean;
  error: boolean;
  onFollow: () => void;
}) {
  const { t } = useMessageText();
  return (
    <div className="channel-follow-footer" data-slot="channel-follow-footer">
      {error && (
        <p role="alert" className="channel-follow-error">
          {t("channel.followError")}
        </p>
      )}
      <button
        type="button"
        className="channel-follow-cta"
        data-slot="channel-follow-cta"
        aria-busy={busy}
        disabled={busy}
        onClick={onFollow}
      >
        {t("channel.follow")}
      </button>
    </div>
  );
}
