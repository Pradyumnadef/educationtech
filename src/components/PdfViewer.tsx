import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function PdfPage({
  document,
  pageNumber,
  width,
  zoom,
  onError,
}: {
  document: any;
  pageNumber: number;
  width: number;
  zoom: number;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !document || !canvasRef.current || !width) return;
    let cancelled = false;
    let renderTask: any;
    (async () => {
      try {
        setRendering(true);
        const page = await document.getPage(pageNumber);
        if (cancelled) return;
        const natural = page.getViewport({ scale: 1 });
        const fit = Math.max(0.4, (width - 32) / natural.width);
        const viewport = page.getViewport({ scale: fit * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("PDF drawing is not supported.");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
      } catch (reason: any) {
        if (!cancelled && reason?.name !== "RenderingCancelledException")
          onError(reason?.message || "A PDF page could not be displayed.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [visible, document, pageNumber, width, zoom, onError]);
  return (
    <div className="pdf-page" data-pdf-page={pageNumber} ref={pageRef}>
      {(!visible || rendering) && (
        <div className="pdf-page-loading">
          <LoaderCircle size={20} /> Loading page {pageNumber}…
        </div>
      )}
      <canvas ref={canvasRef} />
      <span className="pdf-page-number">Page {pageNumber}</span>
    </div>
  );
}

export default function PdfViewer({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  const viewerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(true);

  useEffect(() => {
    const updateFullscreen = () =>
      setFullscreen(document.fullscreenElement === viewerRef.current);
    setFullscreenSupported(
      Boolean(document.fullscreenEnabled && viewerRef.current?.requestFullscreen),
    );
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

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

  const goToPage = (nextPage: number) => {
    const value = Math.max(1, Math.min(pages, nextPage));
    setPage(value);
    const container = containerRef.current;
    const target = container?.querySelector<HTMLElement>(
      `[data-pdf-page="${value}"]`,
    );
    if (container && target)
      container.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
  };
  const trackPage = () => {
    const container = containerRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top + 80;
    let closest = page;
    let distance = Number.POSITIVE_INFINITY;
    container
      .querySelectorAll<HTMLElement>("[data-pdf-page]")
      .forEach((item) => {
        const currentDistance = Math.abs(
          item.getBoundingClientRect().top - top,
        );
        if (currentDistance < distance) {
          distance = currentDistance;
          closest = Number(item.dataset.pdfPage);
        }
      });
    if (closest !== page) setPage(closest);
  };
  const toggleFullscreen = async () => {
    if (!viewerRef.current || !fullscreenSupported) return;
    try {
      if (document.fullscreenElement === viewerRef.current)
        await document.exitFullscreen();
      else await viewerRef.current.requestFullscreen();
    } catch {
      setFullscreenSupported(false);
    }
  };

  return (
    <section
      ref={viewerRef}
      className="pdf-canvas-viewer"
      aria-label={`PDF viewer: ${filename}`}
    >
      <div className="pdf-viewer-toolbar">
        <div>
          <button
            className="icon-button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
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
            onClick={() => goToPage(page + 1)}
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
          <button
            type="button"
            className="icon-button pdf-fullscreen-button"
            disabled={!fullscreenSupported}
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit PDF fullscreen" : "View PDF fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>
      <div
        className="pdf-canvas-stage"
        ref={containerRef}
        onScroll={trackPage}
        tabIndex={0}
        aria-label="Scrollable PDF pages"
      >
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
          document &&
          Array.from({ length: pages }, (_, index) => (
            <PdfPage
              key={index + 1}
              document={document}
              pageNumber={index + 1}
              width={width}
              zoom={zoom}
              onError={setError}
            />
          ))
        )}
      </div>
    </section>
  );
}
