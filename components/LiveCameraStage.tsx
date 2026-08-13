"use client";

/* ------------------------------------------------------------------ */
/*  LiveCameraStage — LOCAL camera/microphone capture for the live     */
/*  room stage. Fills the on-stage tile of the person broadcasting     */
/*  (host or active guest) with their real camera feed via             */
/*  navigator.mediaDevices.getUserMedia().                             */
/*                                                                     */
/*  HONESTY CONTRACT: this is capture + self-view ONLY. No media       */
/*  transport exists yet — the captured stream is never published      */
/*  anywhere, and the UI must never claim viewers can see it. When     */
/*  real ingest ships (WebRTC SFU / Cloudflare Stream / LiveKit), the  */
/*  MediaStream this component owns is exactly what gets published.    */
/*                                                                     */
/*  Permission handling is explicit: every getUserMedia failure mode   */
/*  maps to a clear, actionable message rendered INSIDE the tile —     */
/*  never a blocking overlay, so chat/host controls stay reachable.    */
/* ------------------------------------------------------------------ */

import { Camera, CameraOff, Mic, MicOff, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CamState =
  | { kind: "requesting" }
  | { kind: "granted" }
  | { kind: "error"; reason: string; detail: string; retryable: boolean };

/** Map a getUserMedia rejection to an honest, actionable message. */
function explain(err: unknown): { reason: string; detail: string; retryable: boolean } {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError": {
      // NotAllowedError covers TWO different worlds: the user/browser said
      // no, OR the page itself is vetoed by a Permissions-Policy header /
      // iframe allow attribute. Blaming the user for a site-level block
      // sent people digging through browser settings that were already
      // correct — check the document's own feature policy and say which
      // one it actually is.
      try {
        const fp = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy;
        if (fp && !fp.allowsFeature("camera"))
          return {
            reason: "Blocked by the site's security policy",
            detail:
              "This deployment's Permissions-Policy (or an embedding frame) forbids camera access for the page itself — no browser setting can override it. This is a site configuration issue, not your browser.",
            retryable: false,
          };
      } catch {
        /* featurePolicy API unavailable — fall through to the generic case */
      }
      return {
        reason: "Camera & microphone blocked",
        detail:
          "You (or the browser) denied access. Allow camera and microphone for this site in the address-bar permissions, then try again.",
        retryable: true,
      };
    }
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        reason: "No camera or microphone found",
        detail: "Plug in or enable a camera/microphone, then try again. Your live stays up — chat and reactions keep working.",
        retryable: true,
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        reason: "Camera is in use by another app",
        detail: "Close the other app or browser tab that's holding the camera, then try again.",
        retryable: true,
      };
    case "OverconstrainedError":
      return {
        reason: "Camera doesn't support the requested settings",
        detail: "Trying again uses relaxed settings.",
        retryable: true,
      };
    case "SecurityError":
      return {
        reason: "Blocked by browser security settings",
        detail: "This page's context doesn't permit camera access (embedded frames can block it). Open the live in its own tab.",
        retryable: true,
      };
    default:
      return {
        reason: "Couldn't start the camera",
        detail: err instanceof Error && err.message ? err.message : "An unknown error occurred. Try again.",
        retryable: true,
      };
  }
}

export default function LiveCameraStage({ displayName }: { displayName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>({ kind: "requesting" });
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [relaxed, setRelaxed] = useState(false); // fallback constraints after OverconstrainedError

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    stopAll();
    setState({ kind: "requesting" });

    // Insecure/unsupported context: mediaDevices simply doesn't exist
    // (plain http, some embedded webviews). Say so — never fake it.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState({
        kind: "error",
        reason: "Camera unavailable in this context",
        detail: "This browser context doesn't expose camera access (it requires HTTPS and a non-restricted frame).",
        retryable: false,
      });
      return;
    }

    try {
      const constraints: MediaStreamConstraints = relaxed
        ? { video: true, audio: true }
        : {
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true },
          };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // some browsers need an explicit play() after attaching
        videoRef.current.play().catch(() => {});
      }
      stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      setState({ kind: "granted" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "OverconstrainedError" && !relaxed) {
        setRelaxed(true); // retry once with bare constraints
        return;
      }
      setState({ kind: "error", ...explain(err) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relaxed, stopAll]);

  // acquire on mount / relaxed-retry; release on unmount (stage leaves the
  // DOM when the stream ends, so tracks are always freed)
  useEffect(() => {
    start();
    return stopAll;
  }, [start, stopAll]);

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };
  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };

  return (
    <div className="absolute inset-0" data-guide="live-camera-stage">
      {/* self-view: mirrored, muted (no feedback), always local-only */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full -scale-x-100 object-cover ${state.kind === "granted" && camOn ? "" : "hidden"}`}
      />

      {state.kind === "granted" && !camOn && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
          <CameraOff size={22} className="text-zinc-500" />
          <p className="text-xs text-zinc-500">Camera off</p>
        </div>
      )}

      {state.kind === "requesting" && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
          <p className="text-xs text-zinc-400">Requesting camera & microphone…</p>
          <p className="px-4 text-center text-[10px] text-zinc-600">Your browser will ask for permission.</p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center" data-guide="live-camera-error">
          <CameraOff size={20} className="text-rose-300" />
          <p className="text-xs font-semibold text-rose-300">{state.reason}</p>
          <p className="max-w-[36ch] text-[10px] leading-snug text-zinc-500">{state.detail}</p>
          {state.retryable && (
            <button
              onClick={start}
              className="mt-1 flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-600"
              data-guide="live-camera-retry"
            >
              <RefreshCw size={11} /> Try again
            </button>
          )}
        </div>
      )}

      {/* name + local-only honesty tag */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-100">{displayName} · you</span>
        {state.kind === "granted" && (
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-amber-300">preview only — not transmitted</span>
        )}
      </div>

      {/* cam / mic toggles — small, inside the tile, nothing else covered */}
      {state.kind === "granted" && (
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <button
            onClick={toggleCam}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            data-guide="live-cam-toggle"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              camOn ? "bg-black/60 text-zinc-100 hover:bg-black/80" : "bg-rose-500/90 text-white hover:bg-rose-400"
            }`}
          >
            {camOn ? <Camera size={14} /> : <CameraOff size={14} />}
          </button>
          <button
            onClick={toggleMic}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            data-guide="live-mic-toggle"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              micOn ? "bg-black/60 text-zinc-100 hover:bg-black/80" : "bg-rose-500/90 text-white hover:bg-rose-400"
            }`}
          >
            {micOn ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
