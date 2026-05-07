/**
 * portal.ts
 * Svelte action to teleport an element to another part of the DOM (usually document.body).
 */
export function portal(node: HTMLElement, target: string | HTMLElement = "body") {
  let targetEl: HTMLElement | null;

  function update(newTarget: string | HTMLElement) {
    targetEl = typeof newTarget === "string" ? document.querySelector(newTarget) : newTarget;
    if (targetEl) {
      targetEl.appendChild(node);
    }
  }

  update(target);

  return {
    update,
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    },
  };
}
