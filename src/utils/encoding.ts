// Buffer in Node, btoa in the browser.
export function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(str);
  }
  return str;
}
