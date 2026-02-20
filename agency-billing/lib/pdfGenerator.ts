export interface PdfGenerationResult {
  success: boolean;
  base64?: string;
  error?: string;
}

/**
 * Downloads a PDF from a URL
 */
export async function downloadPdf(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("Download error:", error);
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
}