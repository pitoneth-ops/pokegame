interface Props {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title, message, detail, confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, onConfirm, onCancel,
}: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="card animate-slide-up"
        style={{
          maxWidth: 400, width: "100%",
          border: `1px solid ${danger ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.12)"}`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.8)`,
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">{danger ? "⚠️" : "❓"}</span>
          <div>
            <h3 className="font-black text-white text-base leading-tight">{title}</h3>
            <p className="text-gray-400 text-sm mt-1">{message}</p>
            {detail && (
              <p className="text-gray-500 text-xs mt-1.5 px-2 py-1.5 rounded-lg"
                 style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {detail}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button className="btn-gray flex-1" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`${danger ? "btn-red" : "btn-yellow"} flex-1`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
