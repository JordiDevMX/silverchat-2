import { BadgeCheck, Check, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { CardSurface } from "./settings-row";

/** Pure broadcast presentation; ownership, following and signed avatars stay in adapters. */
export function ChannelRowContent({
  avatar,
  name,
  verified,
  verifiedLabel,
  detail,
  description,
  meta,
}: {
  avatar: ReactNode;
  name: string;
  verified?: boolean;
  verifiedLabel: string;
  detail: ReactNode;
  description?: string | null;
  meta?: ReactNode;
}) {
  return (
    <>
      {avatar}
      <span className="channel-row-copy">
        <strong>
          {name}
          {verified && <BadgeCheck size={16} className="text-neon" aria-label={verifiedLabel} />}
        </strong>
        <small>{detail}</small>
        {description && <span className="channel-row-description">{description}</span>}
      </span>
      {meta && <span className="channel-row-meta">{meta}</span>}
    </>
  );
}

export function ChannelFollowButton({
  following = false,
  busy = false,
  label,
  onClick,
}: {
  following?: boolean;
  busy?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={following ? "outline" : "default"}
      className="channel-follow-button"
      data-following={following}
      aria-busy={busy}
      disabled={busy}
      onClick={onClick}
    >
      {following ? <Check size={15} /> : <Plus size={15} />}
      <span key={String(following)} className="channel-follow-label">
        {label}
      </span>
    </Button>
  );
}

export function ChannelInfoSurface({
  avatar,
  title,
  meta,
  description,
  created,
  children,
}: {
  avatar: ReactNode;
  title: ReactNode;
  meta: ReactNode;
  description?: string | null;
  created: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardSurface className="channel-profile">
      <div className="channel-profile-identity">
        <div className="group-photo">{avatar}</div>
        <h1>{title}</h1>
        <p>{meta}</p>
        <p className="channel-description">{description}</p>
        <small>{created}</small>
      </div>
      <div className="channel-profile-actions">{children}</div>
    </CardSurface>
  );
}
