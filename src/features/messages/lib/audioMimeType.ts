export function audioMimeType(
  supports: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
) {
  return ["audio/webm;codecs=opus", "audio/mp4"].find(supports) ?? null;
}
export const audioExtension = (mime: string) => (mime.startsWith("audio/mp4") ? "m4a" : "webm");
