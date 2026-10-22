import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import { readPreference, writePreference } from "@/lib/preferences";

const spanish: Record<string, string> = {
  Settings: "Ajustes",
  "Your space, your way.": "Tu espacio, a tu manera.",
  Profile: "Perfil",
  "Edit profile": "Editar perfil",
  Account: "Cuenta",
  Devices: "Dispositivos",
  Storage: "Almacenamiento",
  Privacy: "Privacidad",
  Appearance: "Apariencia",
  Notifications: "Notificaciones",
  About: "Acerca de",
  Security: "Seguridad",
  Back: "Volver",
  "Back to chats": "Volver a chats",
  "Log out": "Cerrar sesión",
  Cancel: "Cancelar",
  Save: "Guardar",
  "Saving…": "Guardando…",
  Saved: "Guardado",
  "Loading…": "Cargando…",
  "Try again": "Reintentar",
  "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "Display name": "Nombre visible",
  "First name": "Nombre",
  "Last name": "Apellido",
  Username: "Nombre de usuario",
  Bio: "Biografía",
  "Social links": "Enlaces sociales",
  "Save profile": "Guardar perfil",
  "Profile updated": "Perfil actualizado",
  "Change photo": "Cambiar foto",
  "View photo": "Ver foto",
  "Take photo": "Tomar foto",
  "Upload photo": "Subir foto",
  "Remove photo": "Eliminar foto",
  Zoom: "Ampliación",
  "Profile photo updated": "Foto de perfil actualizada",
  Theme: "Tema",
  Light: "Claro",
  Dark: "Oscuro",
  System: "Sistema",
  "Accent color": "Color de acento",
  Language: "Idioma",
  blue: "azul",
  purple: "morado",
  red: "rojo",
  orange: "naranja",
  yellow: "amarillo",
  green: "verde",
  "Make yourself at home.": "Siéntete como en casa.",
  "These preferences follow you across devices.":
    "Estas preferencias te acompañan en todos tus dispositivos.",
  Sound: "Sonido",
  "Message previews": "Vista previa de mensajes",
  "Notification preferences": "Preferencias de notificaciones",
  "Push notifications require installing the app. In-browser notifications are shown while the app is open in a tab.":
    "Las notificaciones push requieren instalar la app. Las notificaciones del navegador se muestran mientras la app está abierta en una pestaña.",
  "Web push is coming in a later release.":
    "Las notificaciones push llegarán en una versión futura.",
  "Preview notification": "Probar notificación",
  "New message": "Nuevo mensaje",
  "This is how your message previews look.": "Así se ven las vistas previas de tus mensajes.",
  Email: "Correo electrónico",
  "Change email": "Cambiar correo",
  "New email": "Nuevo correo",
  Confirm: "Confirmar",
  "Delete account": "Eliminar cuenta",
  "Cancel deletion": "Cancelar eliminación",
  "Add another account": "Añadir otra cuenta",
  "Two-factor authentication": "Autenticación de dos factores",
  "Delete your account?": "¿Eliminar tu cuenta?",
  "Type DELETE to confirm": "Escribe DELETE para confirmar",
  "Schedule deletion": "Programar eliminación",
  "Log out of SilverChat?": "¿Cerrar sesión en SilverChat?",
  "You’ll need to sign in again with a magic link.":
    "Tendrás que iniciar sesión de nuevo con un enlace mágico.",
  "Also sign out of all other devices": "Cerrar sesión también en los demás dispositivos",
  "Sign out all other devices": "Cerrar sesión en los demás dispositivos",
  "Your current session will stay signed in.": "Tu sesión actual permanecerá abierta.",
  "Other devices signed out": "Sesión cerrada en los demás dispositivos",
  "This device": "Este dispositivo",
  "No devices recorded yet.": "Todavía no hay dispositivos registrados.",
  "Blocked contacts": "Contactos bloqueados",
  "You haven’t blocked anyone.": "No has bloqueado a nadie.",
  Unblock: "Desbloquear",
  Unblocked: "Desbloqueado",
  Block: "Bloquear",
  "Search contacts": "Buscar contactos",
  "No contacts found.": "No se encontraron contactos.",
  "Profile photo": "Foto de perfil",
  "Last seen & online": "Última conexión y en línea",
  Stories: "Historias",
  "Show when I’m online and last seen": "Mostrar cuándo estoy en línea y mi última conexión",
  "Send read receipts": "Enviar confirmaciones de lectura",
  "When on, others can see when you’ve read their messages. When off, you won’t see their read receipts either.":
    "Si están activadas, otros ven cuándo has leído sus mensajes. Si están desactivadas, tampoco verás sus confirmaciones.",
  "Turn off read receipts?": "¿Desactivar confirmaciones de lectura?",
  "When read receipts are off, you won’t see when others have read your messages, and they won’t see when you’ve read theirs. This applies to everyone until you turn it back on.":
    "Si desactivas las confirmaciones, no verás cuándo otros leen tus mensajes y ellos tampoco verán cuándo lees los suyos. Se aplica a todos hasta que las vuelvas a activar.",
  "Keep enabled": "Mantener activadas",
  "Turn off": "Desactivar",
  Everyone: "Todos",
  "My contacts": "Mis contactos",
  "My contacts except…": "Mis contactos excepto…",
  Nobody: "Nadie",
  "Manage exclusions": "Gestionar exclusiones",
  "Hide from…": "Ocultar a…",
  "Custom links": "Enlaces personalizados",
  "Add custom link": "Añadir enlace personalizado",
  "Save links": "Guardar enlaces",
  Label: "Etiqueta",
  "URL or text": "URL o texto",
  "Remove link": "Eliminar enlace",
  Avatars: "Avatares",
  "Chat media": "Archivos de chats",
  "Channel media": "Archivos de canales",
  "Storage usage": "Uso de almacenamiento",
  used: "usados",
  "Soft indicator only; this is not an account quota.":
    "Solo un indicador orientativo; no es una cuota de cuenta.",
  "Files are automatically compressed on upload. Larger limits may apply.":
    "Los archivos se comprimen al subirlos. Pueden aplicarse límites mayores.",
  "Terms of Service": "Términos del servicio",
  "Privacy Policy": "Política de privacidad",
  "Coming soon": "Próximamente",
  "Open-source licenses": "Licencias de código abierto",
  Version: "Versión",
  "Send message": "Enviar mensaje",
  "Profile unavailable": "Perfil no disponible",
  "This profile is unavailable or hidden by privacy settings.":
    "Este perfil no está disponible o está oculto por los ajustes de privacidad.",
  "Your account will be permanently deleted after a 30-day grace period. During this time, you can cancel this from any device.":
    "Tu cuenta se eliminará permanentemente tras un plazo de 30 días. Durante este tiempo puedes cancelarlo desde cualquier dispositivo.",
  "Your messages will remain visible to other users in your conversations but attributed to “Deleted User”. Your profile, avatar, and personal data will be removed.":
    "Tus mensajes seguirán visibles para otros usuarios como «Usuario eliminado». Se eliminarán tu perfil, avatar y datos personales.",
};
const I18nContext = createContext<{
  language: "en" | "es";
  setLanguage: (value: "en" | "es") => void;
  t: (value: string) => string;
} | null>(null);
export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<"en" | "es">(() =>
    readPreference("language", ["en", "es"], "en"),
  );
  useEffect(() => {
    document.documentElement.lang = language;
    writePreference("language", language);
  }, [language]);
  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: (value) => (language === "es" ? (spanish[value] ?? value) : value),
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider missing");
  return value;
}
