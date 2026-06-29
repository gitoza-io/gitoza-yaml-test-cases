export async function openExternalUrl(url) {
  if (typeof url === "string" && url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
