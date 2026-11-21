import type { Language } from "../../../lib/language.ts";
import type { Community } from "../../communities/types.ts";
import type { ChatDetails } from "../../messages/types.ts";
import type { Channel } from "../../novedades/types.ts";
import type { GrowthActionIcon, GrowthChatModel, SupportedGrowthChatType } from "../types.ts";

interface GrowthTypeConfig {
  typeLabel: Record<Language, string>;
  audienceNoun: Record<Language, { one: string; other: string }>;
  secondaryActionLabel: Record<Language, string>;
  secondaryActionIcon: GrowthActionIcon;
  storyVerb: Record<Language, string>;
  buildInvitePath: (id: string, communityId?: string | null) => string;
  buildEditHref: (id: string, communityId?: string | null) => string | null;
}

const STORY_TEXT_LIMIT = 200;

export const GROWTH_CHAT_CONFIG: Record<SupportedGrowthChatType, GrowthTypeConfig> = {
  channel: {
    typeLabel: { en: "Channel", es: "Canal" },
    audienceNoun: {
      en: { one: "follower", other: "followers" },
      es: { one: "seguidor", other: "seguidores" },
    },
    secondaryActionLabel: {
      en: "Invite admins",
      es: "Invitar a administradores",
    },
    secondaryActionIcon: "plus",
    storyVerb: { en: "Follow", es: "¡Sigue" },
    buildInvitePath: (id) => `/channels/${id}`,
    buildEditHref: (id) => `/channels/${id}/info?edit=1`,
  },
  group: {
    typeLabel: { en: "Group", es: "Grupo" },
    audienceNoun: {
      en: { one: "member", other: "members" },
      es: { one: "miembro", other: "miembros" },
    },
    secondaryActionLabel: {
      en: "Add members",
      es: "Añadir miembros",
    },
    secondaryActionIcon: "user_plus",
    storyVerb: { en: "Join", es: "¡Únete a" },
    buildInvitePath: (id) => `/chats/${id}`,
    buildEditHref: (id) => `/chats/${id}/info?focus=description`,
  },
  community_chat: {
    typeLabel: { en: "Community", es: "Comunidad" },
    audienceNoun: {
      en: { one: "member", other: "members" },
      es: { one: "miembro", other: "miembros" },
    },
    secondaryActionLabel: {
      en: "Add members",
      es: "Añadir miembros",
    },
    secondaryActionIcon: "user_plus",
    storyVerb: { en: "Join", es: "¡Únete a" },
    buildInvitePath: (id, communityId) =>
      communityId ? `/communities/${communityId}/chats/${id}` : `/chats/${id}`,
    buildEditHref: (_id, communityId) =>
      communityId ? `/communities/${communityId}/info?focus=description` : null,
  },
};

export function countUserMessages(messages: ReadonlyArray<{ type: string }>): number {
  let count = 0;
  for (const message of messages) {
    if (message.type !== "system") count++;
  }
  return count;
}

export function shouldShowGrowthCard({
  supported,
  isOwnerOrAdmin,
  messagesReady,
  userMessageCount,
}: {
  supported: boolean;
  isOwnerOrAdmin: boolean;
  messagesReady: boolean;
  userMessageCount: number;
}): boolean {
  return supported && isOwnerOrAdmin && messagesReady && userMessageCount === 0;
}

function formatTitle(name: string, isCreator: boolean, language: Language): string {
  if (language === "es") {
    return isCreator ? `Creaste '${name}'` : `Administras '${name}'`;
  }
  return isCreator ? `You created '${name}'` : `You manage '${name}'`;
}

function formatSubtitle(type: SupportedGrowthChatType, count: number, language: Language): string {
  const cfg = GROWTH_CHAT_CONFIG[type];
  const safeCount = Math.max(0, count);
  const formatted = new Intl.NumberFormat(language).format(safeCount);
  const pluralForm = new Intl.PluralRules(language).select(safeCount) === "one" ? "one" : "other";
  const noun = cfg.audienceNoun[language][pluralForm];
  return `${cfg.typeLabel[language]} - ${formatted} ${noun}`;
}

export function buildStoryShareText(
  type: SupportedGrowthChatType,
  name: string,
  inviteUrl: string,
  language: Language,
): string {
  const verb = GROWTH_CHAT_CONFIG[type].storyVerb[language];
  const suffix =
    language === "es" ? ` en SilverChat!\n${inviteUrl}` : ` on SilverChat!\n${inviteUrl}`;
  const prefix = `${verb} '`;
  const closingQuote = "'";
  const reserved = prefix.length + closingQuote.length + suffix.length;
  const maxNameLen = Math.max(0, STORY_TEXT_LIMIT - reserved);
  const safeName =
    name.length > maxNameLen && maxNameLen >= 3
      ? `${name.slice(0, maxNameLen - 1)}…`
      : name.slice(0, maxNameLen);
  return `${prefix}${safeName}${closingQuote}${suffix}`.slice(0, STORY_TEXT_LIMIT);
}

function createGrowthModel(params: {
  type: SupportedGrowthChatType;
  id: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  audienceCount: number;
  isCreator: boolean;
  isOwnerOrAdmin: boolean;
  language: Language;
  origin: string;
  communityId?: string | null;
}): GrowthChatModel {
  const {
    type,
    id,
    name,
    avatarUrl,
    description,
    audienceCount,
    isCreator,
    isOwnerOrAdmin,
    language,
    origin,
    communityId,
  } = params;
  const cfg = GROWTH_CHAT_CONFIG[type];
  const normalizedOrigin = origin.replace(/\/$/, "");
  const inviteUrl = `${normalizedOrigin}${cfg.buildInvitePath(id, communityId)}`;
  return {
    type,
    id,
    name,
    avatarUrl,
    fallbackAvatarKind: type,
    title: formatTitle(name, isCreator, language),
    subtitle: formatSubtitle(type, audienceCount, language),
    description: description?.trim() ? description.trim() : null,
    emptyDescriptionLabel: language === "es" ? "agregar una descripción" : "add a description",
    editDescriptionHref: isOwnerOrAdmin ? cfg.buildEditHref(id, communityId) : null,
    isCreator,
    isOwnerOrAdmin,
    inviteUrl,
    storyPrefillText: buildStoryShareText(type, name, inviteUrl, language),
    primaryAction: {
      id: "share_status",
      label: language === "es" ? "Compartir en mi estado" : "Share to my status",
      icon: "share_status",
    },
    secondaryAction: {
      id: "secondary_invite",
      label: cfg.secondaryActionLabel[language],
      icon: cfg.secondaryActionIcon,
    },
  };
}

export function buildChannelGrowthModel(
  channel: Channel,
  isOwner: boolean,
  language: Language,
  origin: string,
): GrowthChatModel {
  return createGrowthModel({
    type: "channel",
    id: channel.id,
    name: channel.name,
    avatarUrl: channel.avatar_url,
    description: channel.description,
    audienceCount: channel.follower_count,
    isCreator: isOwner,
    isOwnerOrAdmin: isOwner,
    language,
    origin,
  });
}

export function buildChatGrowthModel(
  chat: ChatDetails,
  userId: string | undefined,
  language: Language,
  origin: string,
  community?: Community | null,
): GrowthChatModel | null {
  if (chat.type !== "group" && chat.type !== "community_chat") return null;
  const type: SupportedGrowthChatType = chat.type;
  const isCreator =
    !!userId &&
    (chat.createdBy === userId || (type === "community_chat" && community?.owner_id === userId));
  const isAdmin =
    !chat.readOnly &&
    (chat.own?.role === "admin" ||
      (type === "community_chat" && community?.role === "admin") ||
      isCreator);
  const audienceCount =
    type === "community_chat"
      ? (community?.member_count ?? chat.members.length)
      : chat.members.length;
  const description =
    chat.description?.trim() ||
    (type === "community_chat" ? community?.description?.trim() : "") ||
    null;
  const avatarUrl =
    chat.avatar || (type === "community_chat" ? (community?.avatar_url ?? null) : null);
  return createGrowthModel({
    type,
    id: chat.id,
    name: chat.name,
    avatarUrl,
    description,
    audienceCount,
    isCreator,
    isOwnerOrAdmin: isAdmin,
    language,
    origin,
    communityId: chat.communityId,
  });
}
