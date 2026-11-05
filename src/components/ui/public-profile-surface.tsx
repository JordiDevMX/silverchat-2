import type { ReactNode } from "react";
export function PublicProfileSurface({
  gradient,
  avatar,
  name,
  username,
  bio,
  children,
}: {
  gradient?: string;
  avatar: ReactNode;
  name: string;
  username: string;
  bio?: string | null;
  children: ReactNode;
}) {
  return (
    <article className="public-profile-card public-profile-card-v2">
      <div
        className="public-profile-banner"
        style={gradient ? { background: gradient } : undefined}
        aria-hidden="true"
      />
      <div className="public-profile-content">
        <div className="public-profile-identity">
          {avatar}
          <div>
            <h1>{name}</h1>
            <p className="profile-handle">@{username}</p>
          </div>
        </div>
        {bio && <p className="profile-bio">{bio}</p>}
        {children}
      </div>
    </article>
  );
}
