/**
 * Print styles for markdown content export to PDF.
 * These styles ensure tables and other elements render properly in print mode,
 * independent from the application theme.
 */
const PRINT_STYLES = `
@media print {
  body {
    margin: 24px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #111827;
    background-color: #ffffff;
  }

  .vprose {
    max-width: 800px;
    margin: 0 auto;
  }

  .vprose h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 1.5rem 0 0.75rem;
  }

  .vprose h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem;
  }

  .vprose h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  .vprose p {
    margin: 0 0 0.5rem;
  }

  .vprose ul,
  .vprose ol {
    margin: 0.5rem 0 0.5rem 1.5rem;
    padding: 0;
  }

  .vprose li {
    margin: 0.25rem 0;
  }

  .vprose table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  .vprose th,
  .vprose td {
    border: 1px solid #d1d5db;
    padding: 0.5rem 0.75rem;
    vertical-align: top;
  }

  .vprose thead th {
    background-color: #f3f4f6;
    font-weight: 600;
  }

  .vprose pre,
  .vprose code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
  }

  .vprose pre {
    padding: 0.75rem;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    background-color: #f9fafb;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Hide chart action buttons when printing */
  .chart-actions {
    display: none !important;
  }

  /* Hide interactive elements in agent conversation when printing */
  .print-hidden,
  [class*="print:hidden"],
  button[title="Copy message"],
  button[title="Copy to clipboard"],
  button[title="Export as PNG"],
  .message-actions {
    display: none !important;
  }

  /* Prevent page breaks inside elements */
  .vprose table,
  .vprose pre,
  .vprose blockquote,
  .vprose figure,
  .vprose img,
  [class*="chart"],
  [class*="Chart"] {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Keep headings with following content */
  .vprose h1,
  .vprose h2,
  .vprose h3,
  .vprose h4,
  .vprose h5,
  .vprose h6 {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* Keep list items together when possible */
  .vprose li {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;

/**
 * Opens the browser print dialog with the content of a given HTML element.
 * Uses a hidden iframe to avoid opening a new window.
 *
 * @param sourceElement - The HTML element whose content to print
 * @param title - The document title for the printed page
 * @returns true if print dialog was opened successfully, false otherwise
 */
export function printElementToPdf(sourceElement: HTMLElement, title: string): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return false;
    }

    // Use a hidden iframe to avoid opening a new window
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
        iframe.parentNode?.removeChild(iframe);
        return false;
    }

    const doc = iframeWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><title>${title}</title></head><body></body></html>`);
    doc.close();
    doc.title = title;

    const styles = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("link[rel=\"stylesheet\"], style");
    styles.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
    });

    // Add dedicated print styles
    const printStyle = doc.createElement("style");
    printStyle.textContent = PRINT_STYLES;
    doc.head.appendChild(printStyle);

    doc.body.innerHTML = sourceElement.innerHTML;
    iframeWindow.focus();
    iframeWindow.print();

    setTimeout(() => {
        iframe.parentNode?.removeChild(iframe);
    }, 1000);

    return true;
}
