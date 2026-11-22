import { useCallback, useEffect, useRef, useState } from "react";

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus(); // the safe choice has focus by default
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="backdrop" onClick={onCancel}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-message" className="item-sub">{message}</p>
        <div className="modal-actions">
          <button className="btn" ref={cancelRef} onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? "btn-danger-solid" : "btn-primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * const [confirm, confirmDialog] = useConfirm();
 * if (!(await confirm({ title, message, confirmLabel, danger }))) return;
 * ...and render {confirmDialog} somewhere in the component.
 */
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    []
  );

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const dialog = options ? (
    <ConfirmDialog
      title={options.title || "Are you sure?"}
      message={options.message || ""}
      confirmLabel={options.confirmLabel || "Confirm"}
      danger={!!options.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return [confirm, dialog];
}