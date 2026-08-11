export const CREATE_MODAL_EVENT = "mavyn:open-create";

export function openCreateModal(kind?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CREATE_MODAL_EVENT, { detail: kind }));
}
