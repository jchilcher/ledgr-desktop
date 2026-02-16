interface WhatsNewModalProps {
  version: string;
  releaseNotes: string;
  onClose: () => void;
}

export default function WhatsNewModal({ version, releaseNotes, onClose }: WhatsNewModalProps) {
  return (
    <div className="about-dialog-overlay" onClick={onClose}>
      <div className="whats-new-modal" onClick={(e) => e.stopPropagation()}>
        <button className="about-dialog-close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <h2 style={{ margin: '0 0 16px 0' }}>What&apos;s New in v{version}</h2>

        <div
          className="whats-new-content"
          dangerouslySetInnerHTML={{ __html: releaseNotes }}
        />

        <div style={{ textAlign: 'right', marginTop: '16px' }}>
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
