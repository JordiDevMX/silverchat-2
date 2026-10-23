import type { Member, Message } from "../types";
import { AudioMessage } from "./content/AudioMessage";
import { ContactMessage } from "./content/ContactMessage";
import { FileMessage } from "./content/FileMessage";
import { ImageMessage } from "./content/ImageMessage";
import { LocationMessage } from "./content/LocationMessage";
import { StickerMessage } from "./content/StickerMessage";
import { SystemMessage } from "./content/SystemMessage";
import { TextMessage } from "./content/TextMessage";
import { VideoMessage } from "./content/VideoMessage";
export function MessageContent({
  message,
  members,
  onOpen,
}: {
  message: Message;
  members: Member[];
  onOpen: () => void;
}) {
  switch (message.type) {
    case "text":
      return <TextMessage message={message} members={members} />;
    case "image":
      return <ImageMessage message={message} onOpen={onOpen} />;
    case "video":
      return <VideoMessage message={message} onOpen={onOpen} />;
    case "audio":
      return <AudioMessage message={message} />;
    case "file":
      return <FileMessage message={message} />;
    case "sticker":
      return <StickerMessage message={message} />;
    case "location":
      return <LocationMessage message={message} />;
    case "contact":
      return <ContactMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
  }
}
