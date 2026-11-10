import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ message: "" });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpts(options);
      setOpen(true);
    });
  }, []);

  const finish = (value: boolean) => {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open ? (
        <div className="adm-confirm" role="dialog" aria-modal="true" aria-labelledby="adm-confirm-title">
          <button type="button" className="adm-confirm-scrim" aria-label="Close" onClick={() => finish(false)} />
          <div className="adm-confirm-panel">
            <h2 id="adm-confirm-title">{opts.title ?? "Confirm"}</h2>
            <p>{opts.message}</p>
            <div className="adm-confirm-actions">
              <button type="button" className="adm-btn" onClick={() => finish(false)}>
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className={opts.danger ? "adm-btn is-danger" : "adm-btn is-primary"}
                onClick={() => finish(true)}
              >
                {opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}
