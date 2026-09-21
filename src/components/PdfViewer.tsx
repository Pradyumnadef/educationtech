import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export default function PdfViewer({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: any;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) throw new Error("This PDF could not be opened.");
        task = pdfjs.getDocument({ data: await response.arrayBuffer() });
        const loaded = await task.promise;
        if (cancelled) return loaded.destroy();
        setDocument(loaded);
        setPages(loaded.numPages);
        setPage(1);
      } catch (reason: any) {
        if (!cancelled)
          setError(reason?.message || "This PDF could not be opened.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy?.();
    };
  }, [url]);

  useEffect(() => {
    if (!document || !canvasRef.current || !width) return;
    let cancelled = false;
    let renderTask: any;
    (async () => {
      try {
        setLoading(true);
        const pdfPage = await document.getPage(page);
        if (cancelled) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const fit = Math.max(0.45, (width - 32) / natural.width);
        const viewport = pdfPage.getViewport({ scale: fit * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("PDF drawing is not supported.");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
      } catch (reason: any) {
        if (!cancelled && reason?.name !== "RenderingCancelledException")
          setError(reason?.message || "This PDF page could not be displayed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [document, page, width, zoom]);

  return (
    <section
      className="pdf-canvas-viewer"
      aria-label={`PDF viewer: ${filename}`}
    >
      <div className="pdf-viewer-toolbar">
        <div>
          <button
            className="icon-button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            aria-label="Previous PDF page"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Page {page} of {pages || "—"}
          </span>
          <button
            className="icon-button"
            disabled={!pages || page >= pages}
            onClick={() => setPage((value) => Math.min(pages, value + 1))}
            aria-label="Next PDF page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div>
          <button
            className="icon-button"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            disabled={zoom >= 2}
            onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
      <div className="pdf-canvas-stage" ref={containerRef}>
        {loading && (
          <div className="pdf-viewer-loading" role="status">
            <LoaderCircle size={24} /> Loading PDF…
          </div>
        )}
        {error ? (
          <div className="pdf-viewer-error" role="alert">
            {error}
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </section>
  );
}
