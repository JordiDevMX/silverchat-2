import { useI18n } from "@/app/providers/i18n-provider";

/** Copy of the public surfaces: landing, login, signup, check-email, 2FA, errors, onboarding. */
const es: Record<string, string> = {
  // Shared chrome
  "SilverChat home": "Inicio de SilverChat",
  "A little more space": "Un poco más de espacio",
  "for your people.": "para tu gente.",
  "Conversations that belong to you.": "Conversaciones que te pertenecen.",
  "Start with your email. Stay for the connection.":
    "Empieza con tu correo. Quédate por la conexión.",
  "Privacy-first messaging": "Mensajería con privacidad primero",
  "Your conversations. Your space.": "Tus conversaciones. Tu espacio.",
  // Login and signup
  "Welcome back": "Bienvenido de nuevo",
  "Your next conversation starts here. Sign in with your email.":
    "Tu próxima conversación empieza aquí. Inicia sesión con tu correo.",
  "Create your account": "Crea tu cuenta",
  "We’ll send you a magic link — no password needed.":
    "Te enviaremos un enlace mágico — sin contraseña.",
  "Email address": "Correo electrónico",
  "Account creation is temporarily unavailable. Please try again later.":
    "La creación de cuentas no está disponible por ahora. Inténtalo de nuevo más tarde.",
  "Sending your link…": "Enviando tu enlace…",
  "Create account": "Crear cuenta",
  "Send magic link": "Enviar enlace mágico",
  "Already have an account?": "¿Ya tienes cuenta?",
  "Don’t have an account?": "¿No tienes cuenta?",
  "Sign up": "Regístrate",
  "No passwords to remember. Just you and your inbox.":
    "Sin contraseñas que recordar. Solo tú y tu bandeja de entrada.",
  "We couldn’t send a link. Please try again in a moment.":
    "No pudimos enviar el enlace. Inténtalo de nuevo en un momento.",
  "Enter a valid email address": "Introduce un correo electrónico válido",
  // Check email
  "Check your email": "Revisa tu correo",
  "your email": "tu correo",
  "We sent a magic link to": "Enviamos un enlace mágico a",
  "Click it to continue. The link expires in 10 minutes.":
    "Haz clic en él para continuar. El enlace expira en 10 minutos.",
  "Open the link in this browser to finish signing in.":
    "Abre el enlace en este navegador para completar el inicio de sesión.",
  "Sending…": "Enviando…",
  "Resend email": "Reenviar correo",
  "Email sent again. Check your inbox.": "Correo enviado de nuevo. Revisa tu bandeja de entrada.",
  "Change email": "Cambiar correo",
  "Didn’t receive it? Check your spam folder.": "¿No lo recibiste? Revisa tu carpeta de spam.",
  // Two-factor authentication
  "Enter the 6-digit code from your authenticator app.":
    "Introduce el código de 6 dígitos de tu app autenticadora.",
  "Enter one of your saved backup codes.": "Introduce uno de tus códigos de respaldo guardados.",
  "Backup code": "Código de respaldo",
  "Verifying…": "Verificando…",
  Verify: "Verificar",
  "Use authenticator instead": "Usar la app autenticadora",
  "Lost access? Use a backup code instead": "¿Sin acceso? Usa un código de respaldo",
  "That code couldn’t be verified. Check your authenticator and try again.":
    "No pudimos verificar ese código. Revisa tu app autenticadora e inténtalo de nuevo.",
  "That backup code couldn’t be verified. Try another code or request a new magic link.":
    "No pudimos verificar ese código de respaldo. Prueba otro código o solicita un enlace mágico nuevo.",
  "Enter all six digits": "Introduce los seis dígitos",
  "Enter your 10-character backup code": "Introduce tu código de respaldo de 10 caracteres",
  // Auth errors
  "This link is invalid.": "Este enlace no es válido.",
  "This link has expired.": "Este enlace ha expirado.",
  "Too many attempts. Try again in a few minutes.":
    "Demasiados intentos. Inténtalo de nuevo en unos minutos.",
  "Something went wrong.": "Algo salió mal.",
  "Request a new magic link to continue.": "Solicita un nuevo enlace mágico para continuar.",
  "Request a new link": "Solicitar un nuevo enlace",
  "Go back": "Volver",
  // Onboarding
  "Pick your username": "Elige tu nombre de usuario",
  "This is how others will find you. You can’t change it easily.":
    "Así te encontrarán los demás. No podrás cambiarlo fácilmente.",
  "Your handle:": "Tu nombre de usuario:",
  "This username is taken": "Este nombre de usuario ya está en uso",
  "Someone just took this username. Try another.":
    "Alguien acaba de tomar este nombre de usuario. Prueba otro.",
  "We couldn’t save your username. Please try again.":
    "No pudimos guardar tu nombre de usuario. Inténtalo de nuevo.",
  "Use at least 3 characters": "Usa al menos 3 caracteres",
  "Use no more than 20 characters": "Usa no más de 20 caracteres",
  "Use lowercase letters, numbers, and underscores":
    "Usa letras minúsculas, números y guiones bajos",
  "Choose a username that isn’t an automatically assigned name":
    "Elige un nombre de usuario que no sea asignado automáticamente",
  Continue: "Continuar",
  "Make this space feel like yours. You can change these later.":
    "Haz que este espacio sea tuyo. Puedes cambiarlo más tarde.",
  "You can add one later.": "Puedes añadirla más tarde.",
  "Language preference": "Preferencia de idioma",
  English: "Inglés",
  "Add another layer of security": "Añade otra capa de seguridad",
  "Enable two-factor authentication in settings.":
    "Activa la autenticación de dos factores en Ajustes.",
  "Security settings": "Ajustes de seguridad",
  "Skip for now": "Saltar por ahora",
  "We couldn’t save your preferences. Try again or skip for now.":
    "No pudimos guardar tus preferencias. Inténtalo de nuevo o saltalo por ahora.",
  // Session and app shell
  "Your session has expired": "Tu sesión ha expirado",
  "Please log in again to continue.": "Inicia sesión de nuevo para continuar.",
  "Let’s reconnect": "Volvamos a conectar",
  "We couldn’t reconnect. Check your connection and try again.":
    "No pudimos reconectar. Revisa tu conexión e inténtalo de nuevo.",
  "Page not found": "Página no encontrada",
  "This page could not be found.": "No se pudo encontrar esta página.",
  "Something went wrong": "Algo salió mal",
  "This page couldn’t be opened. Please try again.":
    "No se pudo abrir esta página. Inténtalo de nuevo.",
  "Skip to content": "Ir al contenido",
  "Your SilverChat account is ready.": "Tu cuenta de SilverChat está lista.",
  "Backup code used. Please re-enable 2FA in settings.":
    "Código de respaldo usado. Vuelve a activar 2FA en Ajustes.",
  "Signing out…": "Cerrando sesión…",
  "Signing you in…": "Iniciando sesión…",
  "Signed out here, but server revocation could not be confirmed. Try signing in and out again.":
    "Cerraste sesión aquí, pero no se pudo confirmar la revocación en el servidor. Intenta iniciar y cerrar sesión de nuevo.",
};

/** Translates the public surfaces, falling back to the shared dictionary. */
export function useAuthText() {
  const { language, t } = useI18n();
  return (text: string | undefined | null, spanish?: string) => {
    if (!text) return "";
    if (language !== "es") return text;
    return spanish ?? es[text] ?? t(text);
  };
}
