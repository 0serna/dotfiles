export interface Osc52Renderer {
  isOsc52Supported?: () => boolean;
  copyToClipboardOSC52?: (text: string) => boolean;
}

export function copyToClipboard(
  renderer: Osc52Renderer,
  text: string,
): boolean {
  try {
    return (
      renderer.isOsc52Supported?.() === true &&
      renderer.copyToClipboardOSC52?.(text) === true
    );
  } catch {
    return false;
  }
}
