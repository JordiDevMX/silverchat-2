export async function videoThumbnail(
  file: File,
  signal: AbortSignal,
): Promise<{ file: File; width: number; height: number; duration: number }> {
  signal.throwIfAborted();
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  try {
    return await new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (error) reject(error);
      };
      const abort = () => finish(new DOMException("Upload cancelled", "AbortError"));
      const timer = setTimeout(() => finish(new Error("Video preview timed out")), 15000);
      signal.addEventListener("abort", abort, { once: true });
      video.onerror = () => finish(new Error("This video cannot be previewed"));
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || !video.videoWidth) {
          finish(new Error("Invalid video"));
          return;
        }
        video.currentTime = Math.min(0.1, video.duration / 2);
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * ratio);
        canvas.height = Math.round(video.videoHeight * ratio);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (signal.aborted) {
              abort();
              return;
            }
            if (!blob) {
              finish(new Error("Video preview failed"));
              return;
            }
            finish();
            resolve({
              file: new File([blob], `${file.name}.thumb.jpg`, { type: "image/jpeg" }),
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
            });
          },
          "image/jpeg",
          0.8,
        );
      };
      video.src = url;
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
