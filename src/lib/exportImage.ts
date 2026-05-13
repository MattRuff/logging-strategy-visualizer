import { toPng } from "html-to-image";

function findFlowElement(): HTMLElement | null {
  return (
    (document.querySelector(".react-flow__viewport") as HTMLElement | null) ??
    (document.querySelector(".react-flow") as HTMLElement | null)
  );
}

async function captureFlowPng(): Promise<string> {
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  const container = document.querySelector(".react-flow") as HTMLElement | null;
  const target = viewport ?? container ?? findFlowElement();
  if (!target) throw new Error("Flow canvas not found");

  // If we have the viewport, compute the bounding box of nodes so we capture
  // the full graph regardless of pan/zoom. Otherwise fall back to container.
  if (viewport) {
    const nodes = Array.from(
      document.querySelectorAll(".react-flow__node")
    ) as HTMLElement[];
    if (nodes.length > 0) {
      const transform = window.getComputedStyle(viewport).transform;
      // We bypass the transform by temporarily resetting it for capture.
      const prev = viewport.style.transform;
      viewport.style.transform = "translate(0px, 0px) scale(1)";
      try {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
          const x = parseFloat(n.style.left || "0") ||
            (n.getBoundingClientRect().left - viewport.getBoundingClientRect().left);
          const y = parseFloat(n.style.top || "0") ||
            (n.getBoundingClientRect().top - viewport.getBoundingClientRect().top);
          // Prefer translate3d in transform
          const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(n.style.transform || "");
          const tx = m ? parseFloat(m[1]) : x;
          const ty = m ? parseFloat(m[2]) : y;
          const w = n.offsetWidth;
          const h = n.offsetHeight;
          minX = Math.min(minX, tx);
          minY = Math.min(minY, ty);
          maxX = Math.max(maxX, tx + w);
          maxY = Math.max(maxY, ty + h);
        }
        const pad = 40;
        const width = Math.ceil(maxX - minX + pad * 2);
        const height = Math.ceil(maxY - minY + pad * 2);
        const offsetX = -minX + pad;
        const offsetY = -minY + pad;
        viewport.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`;
        const dataUrl = await toPng(viewport, {
          width,
          height,
          backgroundColor: "#ffffff",
          pixelRatio: 2,
          cacheBust: true,
          style: { width: `${width}px`, height: `${height}px` },
        });
        return dataUrl;
      } finally {
        viewport.style.transform = prev || transform;
      }
    }
  }

  return toPng(target, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
  });
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportFlowPng(filename = "logging-strategy.png") {
  const url = await captureFlowPng();
  triggerDownload(url, filename);
}

export async function exportFlowPdf(filename = "logging-strategy.pdf") {
  const url = await captureFlowPng();
  const { jsPDF } = await import("jspdf");
  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode PNG for PDF"));
  });
  const orientation = img.width >= img.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scale = Math.min(availW / img.width, availH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;
  pdf.addImage(url, "PNG", x, y, w, h);
  pdf.save(filename);
}
