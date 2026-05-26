export default function ConfirmModal({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  if (!title) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel} className="modal-btn-cancel">{cancelLabel || 'Cancel'}</button>
          <button onClick={onConfirm} className="modal-btn-confirm">{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}
