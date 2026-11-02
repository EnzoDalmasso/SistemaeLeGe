"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { IconMic } from "./icons";
import { Spinner } from "./ui";

/** Graba un audio desde el micrófono del celular o la PC y lo devuelve transcripto. */
export function VoiceButton({ onText, onError }: { onText: (text: string) => void; onError: (msg: string) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const recorder = useRef<MediaRecorder | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("busy");
        try {
          const type = rec.mimeType || "audio/webm";
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          const form = new FormData();
          form.append("audio", new Blob(chunks, { type }), `audio.${ext}`);
          const { text } = await api<{ text: string }>("/api/assistant/transcribe", { method: "POST", body: form });
          onText(text);
        } catch (e) {
          onError(e instanceof Error ? e.message : "No se pudo transcribir");
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recorder.current = rec;
      setState("rec");
    } catch {
      onError("No se pudo acceder al micrófono");
    }
  }

  return (
    <button
      type="button"
      onClick={() => (state === "rec" ? recorder.current?.stop() : state === "idle" && start())}
      disabled={state === "busy"}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
        state === "rec" ? "animate-pulse bg-bad text-white" : "border border-line bg-card text-ink hover:border-brand/40"
      }`}
    >
      {state === "busy" ? <Spinner /> : <IconMic />}
      {state === "rec" ? "Detener" : state === "busy" ? "Transcribiendo…" : "Grabar audio"}
    </button>
  );
}
