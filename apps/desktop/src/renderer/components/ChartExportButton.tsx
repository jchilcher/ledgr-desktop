import React, { useCallback, useState } from 'react';

interface ChartExportButtonProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
}

const ChartExportButton: React.FC<ChartExportButtonProps> = ({ chartRef, filename = 'chart' }) => {
  const [copying, setCopying] = useState(false);

  const getSvgCanvas = useCallback((): Promise<HTMLCanvasElement | null> => {
    const container = chartRef.current;
    if (!container) return Promise.resolve(null);

    const svgElement = container.querySelector('svg');
    if (!svgElement) return Promise.resolve(null);

    return new Promise((resolve) => {
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // Ensure the SVG has explicit dimensions
      const bbox = svgElement.getBoundingClientRect();
      clonedSvg.setAttribute('width', String(bbox.width));
      clonedSvg.setAttribute('height', String(bbox.height));

      // Inline computed styles for text elements so they render correctly in the exported image
      const sourceTexts = svgElement.querySelectorAll('text');
      const clonedTexts = clonedSvg.querySelectorAll('text');
      sourceTexts.forEach((srcText, i) => {
        const computed = window.getComputedStyle(srcText);
        const target = clonedTexts[i];
        if (target) {
          target.setAttribute('fill', computed.fill || target.getAttribute('fill') || '#000');
          target.style.fontFamily = computed.fontFamily;
          target.style.fontSize = computed.fontSize;
        }
      });

      // Resolve CSS variables on strokes and fills
      const allElements = clonedSvg.querySelectorAll('*');
      allElements.forEach((el) => {
        const htmlEl = el as SVGElement;
        const stroke = htmlEl.getAttribute('stroke');
        const fill = htmlEl.getAttribute('fill');
        if (stroke && stroke.startsWith('var(')) {
          const resolved = getComputedStyle(document.documentElement).getPropertyValue(
            stroke.replace(/var\((--[^)]+)\)/, '$1')
          ).trim();
          if (resolved) htmlEl.setAttribute('stroke', resolved);
        }
        if (fill && fill.startsWith('var(')) {
          const resolved = getComputedStyle(document.documentElement).getPropertyValue(
            fill.replace(/var\((--[^)]+)\)/, '$1')
          ).trim();
          if (resolved) htmlEl.setAttribute('fill', resolved);
        }
      });

      // Set a white background for the exported image
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', '#ffffff');
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // 2x for retina clarity
        canvas.width = bbox.width * scale;
        canvas.height = bbox.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
        }
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }, [chartRef]);

  const handleDownload = useCallback(async () => {
    const canvas = await getSvgCanvas();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [getSvgCanvas, filename]);

  const handleCopy = useCallback(async () => {
    const canvas = await getSvgCanvas();
    if (!canvas) return;

    setCopying(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      }
    } catch {
      // Clipboard write may fail in some environments; silently ignore
    } finally {
      setTimeout(() => setCopying(false), 1500);
    }
  }, [getSvgCanvas]);

  return (
    <div className="chart-export-buttons">
      <button
        className="btn btn-secondary chart-export-btn"
        onClick={handleDownload}
        title="Download chart as PNG"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        PNG
      </button>
      <button
        className="btn btn-secondary chart-export-btn"
        onClick={handleCopy}
        title="Copy chart to clipboard"
      >
        {copying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {copying ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};

export default ChartExportButton;
