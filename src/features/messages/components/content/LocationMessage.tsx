import { MapPin } from "lucide-react";
import { useMessageText } from "../../i18n";
import type { Message } from "../../types";
export function LocationMessage({ message }: { message: Message }) {
  const { say } = useMessageText();
  const data = message.location_data;
  const record = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const lat = record.latitude ?? record.lat;
  const lon = record.longitude ?? record.lng;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return <p>{say("Location unavailable", "Ubicación no disponible")}</p>;
  return (
    <>
      <a
        className="message-location"
        href={`https://www.google.com/maps?q=${lat},${lon}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MapPin size={36} />
        <span>
          {lat.toFixed(4)}, {lon.toFixed(4)}
        </span>
      </a>
      {message.content && <p className="message-text">{message.content}</p>}
    </>
  );
}
