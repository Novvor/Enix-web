import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Rive as RiveInstance, ViewModelInstanceNumber } from "@rive-app/webgl2";
import "./ENIXMascot.css";

export const ENIX_MOOD = {
  idle: 0,
  greeting: 1,
  attentive: 2,
  thinking: 3,
  ready: 4,
  error: 5,
} as const;

export type ENIXMood = (typeof ENIX_MOOD)[keyof typeof ENIX_MOOD];

export interface ENIXMascotProps {
  /** URL pública del .riv exportado; no un archivo .rml. */
  src: string;
  /** SVG estático de confianza, como elemento React o <img src="...svg" alt="" />. */
  fallbackSvg: ReactNode;
  /** Lo controla el estado real del chat; el componente nunca genera mensajes ni estados comerciales. */
  mood?: ENIXMood;
  size?: number;
  paused?: boolean;
  decorative?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Aviso técnico opcional para el padre. No se muestra ni anuncia automáticamente al visitante. */
  onError?: (error: Error) => void;
}

const ARTBOARD = "EnixMascot";
const STATE_MACHINE = "EnixCompanion";
const LOAD_TIMEOUT_MS = 20_000;

type Status = "waiting" | "loading" | "ready" | "error";
type MascotStyle = CSSProperties & { "--enix-mascot-size": string };

/**
 * Capa visual para Astro + React. No llama a ninguna API de IA.
 * El runtime se importa al entrar en pantalla; SSR y movimiento reducido usan el SVG.
 */
export function ENIXMascot({
  src,
  fallbackSvg,
  mood = ENIX_MOOD.idle,
  size = 72,
  paused = false,
  decorative = true,
  ariaLabel = "Mascota de ENIX Studio",
  className = "",
  onError,
}: ENIXMascotProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const applyRef = useRef<(() => void) | null>(null);
  const onErrorRef = useRef(onError);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  // Conservador durante SSR/hidratación: mostrar la imagen hasta leer la preferencia.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [activated, setActivated] = useState(false);
  const [status, setStatus] = useState<Status>("waiting");
  const validMood: ENIXMood = Number.isInteger(mood) && mood >= 0 && mood <= 5 ? mood : ENIX_MOOD.idle;
  const controlsRef = useRef({ mood: validMood, paused, inView, pageVisible, reducedMotion });

  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);

    let media: MediaQueryList | undefined;
    const updateMotion = () => setReducedMotion(media?.matches ?? true);
    try {
      if (typeof window.matchMedia === "function") {
        media = window.matchMedia("(prefers-reduced-motion: reduce)");
        updateMotion();
        if (typeof media.addEventListener === "function") media.addEventListener("change", updateMotion);
        else if (typeof media.addListener === "function") media.addListener(updateMotion);
      }
    } catch {
      setReducedMotion(true);
    }

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      if (media && typeof media.removeEventListener === "function") media.removeEventListener("change", updateMotion);
      else if (media && typeof media.removeListener === "function") media.removeListener(updateMotion);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (typeof IntersectionObserver === "function") {
      try {
        const observer = new IntersectionObserver(([entry]) => {
          setInView(Boolean(entry?.isIntersecting));
        }, { threshold: 0.01 });
        observer.observe(host);
        return () => observer.disconnect();
      } catch {
        // La comprobación geométrica conserva la carga diferida si el observer falla.
      }
    }

    const check = () => {
      const bounds = host.getBoundingClientRect();
      setInView(bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.right > 0
        && bounds.top < window.innerHeight && bounds.left < window.innerWidth);
    };
    check();
    window.addEventListener("resize", check, { passive: true });
    document.addEventListener("scroll", check, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", check);
      document.removeEventListener("scroll", check, true);
    };
  }, []);

  useEffect(() => {
    controlsRef.current = { mood: validMood, paused, inView, pageVisible, reducedMotion };
    applyRef.current?.();
    if (inView && pageVisible && !reducedMotion && !paused) setActivated(true);
  }, [validMood, paused, inView, pageVisible, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!activated || reducedMotion || !canvas) {
      setStatus("waiting");
      return;
    }

    let disposed = false;
    let failed = false;
    let loaded = false;
    let instance: RiveInstance | null = null;
    let moodProperty: ViewModelInstanceNumber | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const abort = new AbortController();

    const clearLoadTimeout = () => {
      if (timeout !== null) clearTimeout(timeout);
      timeout = null;
    };

    const release = () => {
      clearLoadTimeout();
      abort.abort();
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", contextLost);
      moodProperty = null;
      const current = instance;
      instance = null;
      loaded = false;
      if (current) {
        try { current.cleanup(); } catch { /* Un contexto ya perdido no impide desmontar React. */ }
      }
      if (applyRef.current === applyControls) applyRef.current = null;
    };

    const fail = (cause: unknown) => {
      if (disposed || failed) return;
      failed = true;
      release();
      setStatus("error");
      const error = cause instanceof Error ? cause : new Error("No se pudo cargar la mascota de ENIX.");
      try { onErrorRef.current?.(error); } catch { /* Un callback del padre no debe impedir el fallback. */ }
    };

    function applyControls() {
      if (!instance || !loaded || disposed || failed || !moodProperty) return;
      try {
        const controls = controlsRef.current;
        // Contrato de data binding: propiedad Number del View Model predeterminado.
        moodProperty.value = controls.mood;
        if (controls.inView && controls.pageVisible && !controls.paused && !controls.reducedMotion) {
          instance.play(STATE_MACHINE);
          instance.startRendering();
        } else {
          instance.pause(STATE_MACHINE);
          instance.stopRendering();
        }
      } catch (error) {
        fail(error);
      }
    }

    function resize() {
      if (!instance || !loaded || disposed || failed) return;
      try {
        instance.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2));
        applyControls();
      } catch (error) {
        fail(error);
      }
    }

    function contextLost() {
      fail(new Error("El contexto gráfico de la mascota dejó de estar disponible."));
    }

    const loadedFile = () => {
      if (disposed || failed || !instance) return;
      try {
        if (instance.activeArtboard !== ARTBOARD || !instance.stateMachineNames.includes(STATE_MACHINE)) {
          throw new Error("El archivo debe incluir EnixMascot y su máquina EnixCompanion.");
        }
        moodProperty = instance.viewModelInstance?.number("mood") ?? null;
        if (!moodProperty) {
          throw new Error("Falta la propiedad Number 'mood' en el View Model predeterminado exportado.");
        }
        loaded = true;
        clearLoadTimeout();
        if (typeof ResizeObserver === "function") {
          try {
            resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(canvas);
          } catch {
            resizeObserver?.disconnect();
            resizeObserver = null;
          }
        }
        window.addEventListener("resize", resize, { passive: true });
        resize();
        if (!failed) setStatus("ready");
      } catch (error) {
        fail(error);
      }
    };

    applyRef.current = applyControls;
    canvas.addEventListener("webglcontextlost", contextLost);
    setStatus("loading");
    timeout = setTimeout(() => fail(new Error("La carga de la mascota superó el tiempo disponible.")), LOAD_TIMEOUT_MS);

    void (async () => {
      try {
        // Ambos recursos se solicitan únicamente tras la primera entrada visible.
        const [runtime, buffer] = await Promise.all([
          import("@rive-app/webgl2"),
          fetch(src, { signal: abort.signal, credentials: "same-origin" }).then(async response => {
            if (!response.ok) throw new Error(`No se pudo leer el archivo Rive (HTTP ${response.status}).`);
            return response.arrayBuffer();
          }),
        ]);
        if (disposed || failed) return;
        instance = new runtime.Rive({
          canvas,
          buffer,
          artboard: ARTBOARD,
          stateMachine: STATE_MACHINE,
          autoBind: true,
          autoplay: false,
          layout: new runtime.Layout({ fit: runtime.Fit.Contain, alignment: runtime.Alignment.Center }),
          shouldDisableRiveListeners: true,
          shouldDisableGamepad: true,
          enableRiveAssetCDN: false,
          tabIndex: -1,
          // Deferir evita depender de que onLoad siempre sea asíncrono respecto al constructor.
          onLoad: () => { void Promise.resolve().then(loadedFile); },
          onLoadError: event => { void Promise.resolve().then(() => fail(new Error(typeof event.data === "string" ? event.data : "Archivo Rive no compatible."))); },
        });
        instance.volume = 0;
      } catch (error) {
        fail(error);
      }
    })();

    return () => {
      disposed = true;
      release();
    };
  }, [activated, reducedMotion, src]);

  const pixels = Number.isFinite(size) && size > 0 ? size : 72;
  const showCanvas = status === "ready" && !reducedMotion && !paused;
  const style: MascotStyle = { "--enix-mascot-size": `${pixels}px` };

  return (
    <span
      ref={hostRef}
      className={`enix-mascot ${className}`.trim()}
      style={style}
      data-rive-ready={showCanvas ? "true" : "false"}
      data-rive-status={status}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
    >
      <span className="enix-mascot__fallback" aria-hidden="true">{fallbackSvg}</span>
      <canvas ref={canvasRef} className="enix-mascot__canvas" aria-hidden="true" tabIndex={-1} />
    </span>
  );
}

export default ENIXMascot;
