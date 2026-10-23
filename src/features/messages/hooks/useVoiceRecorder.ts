import { useCallback, useEffect, useRef, useState } from "react";
import { audioExtension, audioMimeType } from "../lib/audioMimeType";
import { computePeaks, recordingLimitMs } from "../lib/voicePeaks";
import { useAudioStore } from "../stores/audioStore";
export type Recording = { file: File; url: string; peaks: number[]; duration: number };
export function useVoiceRecorder() {
  const [state, setState] = useState<
    "idle" | "requesting" | "recording" | "processing" | "preview" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [livePeaks, setLivePeaks] = useState<number[]>([]);
  const [recording, setRecording] = useState<Recording>();
  const session = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const url = useRef<string | null>(null);
  const release = useCallback(() => {
    clearInterval(interval.current);
    clearTimeout(deadline.current);
    stream.current?.getTracks().forEach((t) => {
      t.stop();
    });
    stream.current = null;
    const ctx = context.current;
    context.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  }, []);
  const discard = useCallback(() => {
    session.current++;
    const active = recorder.current;
    recorder.current = null;
    if (active && active.state !== "inactive") active.stop();
    release();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, [release]);
  useEffect(() => () => discard(), [discard]);
  const cancel = () => {
    discard();
    setRecording(undefined);
    setElapsed(0);
    setLivePeaks([]);
    setError("");
    setState("idle");
  };
  const stop = () => {
    const active = recorder.current;
    if (active?.state === "recording") {
      clearInterval(interval.current);
      clearTimeout(deadline.current);
      setState("processing");
      active.stop();
    }
  };
  const start = async () => {
    discard();
    const epoch = session.current;
    setRecording(undefined);
    setElapsed(0);
    setLivePeaks([]);
    setError("");
    const mime = audioMimeType();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("unsupported");
      return;
    }
    setState("requesting");
    useAudioStore.getState().stop();
    try {
      const ctx = new AudioContext();
      context.current = ctx;
      await ctx.resume();
      if (epoch !== session.current) return;
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (epoch !== session.current) {
        media.getTracks().forEach((t) => {
          t.stop();
        });
        return;
      }
      stream.current = media;
      const source = ctx.createMediaStreamSource(media);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const active = new MediaRecorder(media, { mimeType: mime });
      recorder.current = active;
      const chunks: Blob[] = [];
      const started = performance.now();
      active.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      active.onerror = () => {
        if (epoch !== session.current) return;
        discard();
        setState("error");
        setError("recording");
      };
      active.onstop = async () => {
        if (epoch !== session.current) return;
        release();
        recorder.current = null;
        setState("processing");
        let decoder: AudioContext | undefined;
        try {
          const blob = new Blob(chunks, { type: active.mimeType || mime });
          decoder = new AudioContext();
          const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
          if (epoch !== session.current) return;
          if (!decoded.duration || !blob.size) throw new Error("empty");
          const nextUrl = URL.createObjectURL(blob);
          url.current = nextUrl;
          setRecording({
            file: new File([blob], `voice-${Date.now()}.${audioExtension(blob.type)}`, {
              type: blob.type,
            }),
            url: nextUrl,
            peaks: computePeaks(decoded),
            duration: Math.min(300, decoded.duration),
          });
          setState("preview");
        } catch {
          if (epoch === session.current) {
            setState("error");
            setError("decode");
          }
        } finally {
          if (decoder && decoder.state !== "closed") void decoder.close().catch(() => {});
        }
      };
      active.start(250);
      setState("recording");
      interval.current = setInterval(() => {
        if (epoch !== session.current) return;
        setElapsed(Math.min(recordingLimitMs, performance.now() - started) / 1000);
        analyser.getFloatTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        setLivePeaks((old) => [...old.slice(-39), Math.round(peak * 100)]);
      }, 100);
      deadline.current = setTimeout(stop, recordingLimitMs);
    } catch (cause) {
      if (epoch !== session.current) return;
      discard();
      setState("error");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "permission"
          : "recording",
      );
    }
  };
  return { state, error, elapsed, livePeaks, recording, start, stop, cancel };
}
