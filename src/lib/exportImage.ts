import { toPng } from "html-to-image";
import { getFlowInstance } from "@/lib/flowInstance";

const PIXEL_RATIO = 2;
const BG = "#ffffff";

function safeFilename(name: string, ext: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return `${base || "logging-strategy"}.${ext}`;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode captured image"));
  });
  return img;
}

async function captureFlow(): Promise<string | null> {
  const el = document.querySelector(".react-flow") as HTMLElement | null;
  if (!el) return null;

  const inst = getFlowInstance();
  const prev = inst?.getViewport();

  // Hide UI chrome (controls, minimap, panels) so the export is clean.
  const chrome = el.querySelectorAll<HTMLElement>(
    ".react-flow__controls, .react-flow__minimap, .react-flow__panel, .react-flow__attribution"
  );
  const prevDisplay = new Map<HTMLElement, string>();
  chrome.forEach((c) => {
    prevDisplay.set(c, c.style.display);
    c.style.display = "none";
  });

  try {
    if (inst) {
      inst.fitView({ padding: 0.08, duration: 0 });
      await nextFrame();
    }
    return await toPng(el, {
      backgroundColor: BG,
      pixelRatio: PIXEL_RATIO,
      cacheBust: true,
    });
  } finally {
    prevDisplay.forEach((d, c) => {
      c.style.display = d;
    });
    if (inst && prev) {
      inst.setViewport(prev, { duration: 0 });
    }
  }
}

async function captureCostSheet(): Promise<string | null> {
  const el = document.querySelector(".cost-sheet") as HTMLElement | null;
  if (!el) return null;
  // Capture the element at its scroll size so the whole table is included.
  const width = Math.max(el.scrollWidth, el.clientWidth);
  const height = Math.max(el.scrollHeight, el.clientHeight);
  return toPng(el, {
    backgroundColor: BG,
    pixelRatio: PIXEL_RATIO,
    cacheBust: true,
    width,
    height,
    style: { width: `${width}px`, height: `${height}px` },
  });
}

async function composeStack(dataUrls: string[]): Promise<string> {
  if (dataUrls.length === 1) return dataUrls[0];
  const imgs = await Promise.all(dataUrls.map(loadImage));
  const width = Math.max(...imgs.map((i) => i.width));
  const gap = 24 * PIXEL_RATIO;
  const height = imgs.reduce((sum, i) => sum + i.height, 0) + gap * (imgs.length - 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const img of imgs) {
    const x = Math.round((width - img.width) / 2);
    ctx.drawImage(img, x, y);
    y += img.height + gap;
  }
  return canvas.toDataURL("image/png");
}

async function captureScene(): Promise<string> {
  const parts: string[] = [];
  const flow = await captureFlow();
  if (flow) parts.push(flow);
  const sheet = await captureCostSheet();
  if (sheet) parts.push(sheet);
  if (parts.length === 0) {
    throw new Error("Nothing to export on this page");
  }
  return composeStack(parts);
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportFlowPng(scenarioName: string) {
  const url = await captureScene();
  triggerDownload(url, safeFilename(scenarioName, "png"));
}

export async function exportFlowPdf(scenarioName: string) {
  const url = await captureScene();
  const { jsPDF } = await import("jspdf");
  const img = await loadImage(url);
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
  pdf.save(safeFilename(scenarioName, "pdf"));
}
