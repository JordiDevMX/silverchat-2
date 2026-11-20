import { useI18n } from "@/app/providers/i18n-provider";

const es: Record<string, string> = {
  // Calls page
  Calls: "Llamadas",
  "Recent voice and video activity": "Actividad reciente de voz y vídeo",
  All: "Todos",
  Missed: "Perdidas",
  "Search calls…": "Buscar llamadas…",
  "Clear search": "Borrar búsqueda",
  "No calls yet": "Aún no hay llamadas",
  "Voice and video calls with your contacts will appear here.":
    "Aquí aparecerán tus llamadas de voz y vídeo con tus contactos.",
  "No missed calls": "No hay llamadas perdidas",
  "Calls you miss will appear here.": "Las llamadas que pierdas aparecerán aquí.",
  "Could not load calls.": "No se pudieron cargar las llamadas.",
  Busy: "Ocupado",
  "Missed while busy": "Perdida mientras estabas en otra llamada",
  "{name} is busy": "{name} está ocupado",
  "Try again later.": "Inténtalo más tarde.",
  Close: "Cerrar",
  // Log rows
  "Voice call": "Llamada de voz",
  "Video call": "Videollamada",
  Outgoing: "Saliente",
  Incoming: "Entrante",
  "No answer": "Sin respuesta",
  Declined: "Rechazada",
  Canceled: "Cancelada",
  "Tap to call back": "Toca para devolver la llamada",
  "Start voice call": "Iniciar llamada de voz",
  "Start video call": "Iniciar videollamada",
  // New call modal
  "New call": "Nueva llamada",
  "Search chats…": "Buscar chats…",
  "No contacts with active chats. Start a chat first.":
    "No hay contactos con chats activos. Inicia un chat primero.",
  "Could not load chats.": "No se pudieron cargar los chats.",
  // Ringing modals
  "Incoming voice call": "Llamada de voz entrante",
  "Incoming video call": "Videollamada entrante",
  "Calling…": "Llamando…",
  Accept: "Aceptar",
  Decline: "Rechazar",
  Cancel: "Cancelar",
  Hangup: "Colgar",
  // Active call
  "Camera off": "Cámara apagada",
  "Toggle video size": "Cambiar tamaño del vídeo",
  You: "Tú",
  Muted: "Silenciado",
  "Ending…": "Finalizando…",
  // Controls (aria)
  "Mute microphone": "Silenciar micrófono",
  "Unmute microphone": "Activar micrófono",
  "Speaker on": "Altavoz activado",
  "Speaker off": "Altavoz silenciado",
  "Turn camera on": "Encender cámara",
  "Turn camera off": "Apagar cámara",
  // Toasts and errors
  "Call declined": "Llamada rechazada",
  "Call canceled": "Llamada cancelada",
  "Call ended": "Llamada finalizada",
  "Call failed. Try again.": "La llamada falló. Inténtalo de nuevo.",
  "Camera/microphone access is required. Enable it in your browser settings.":
    "Se necesita acceso a la cámara y al micrófono. Actívalo en la configuración del navegador.",
  "Failed to start call. Try again.": "No se pudo iniciar la llamada. Inténtalo de nuevo.",
  "You are already in a call": "Ya estás en una llamada",
  "A call is already in progress in this chat": "Ya hay una llamada en curso en este chat",
  // Day grouping
  Today: "Hoy",
  Yesterday: "Ayer",
};
export function useCallText() {
  const { language } = useI18n();
  return (text: string, spanish?: string) =>
    language === "es" ? (spanish ?? es[text] ?? text) : text;
}
