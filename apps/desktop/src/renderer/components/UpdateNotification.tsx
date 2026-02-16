import { useState, useEffect } from 'react';
import WhatsNewModal from './WhatsNewModal';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

function normalizeReleaseNotes(notes: unknown): string {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) {
    return notes
      .map((n: { version?: string; note?: string }) =>
        `<h3>${n.version ?? ''}</h3>${n.note ?? ''}`
      )
      .join('');
  }
  return '';
}

export default function UpdateNotification() {
  const [state, setState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    // Register IPC event listeners
    const cleanupAvailable = window.api.updater.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setState('available');
      setIsVisible(true);

      // Persist release notes for post-update modal
      const html = normalizeReleaseNotes(info.releaseNotes);
      if (html) {
        try {
          localStorage.setItem(
            'ledgr:pendingUpdateNotes',
            JSON.stringify({ version: info.version, releaseNotes: html })
          );
        } catch { /* localStorage full — non-critical */ }
      }

      // Auto-dismiss after 15 seconds if user doesn't interact
      const timeout = setTimeout(() => {
        setIsVisible(false);
        setState('idle');
      }, 15000);

      return () => clearTimeout(timeout);
    });

    const cleanupProgress = window.api.updater.onDownloadProgress((progressInfo: DownloadProgress) => {
      setProgress(Math.round(progressInfo.percent));
    });

    const cleanupDownloaded = window.api.updater.onUpdateDownloaded(() => {
      setState('downloaded');
      setIsVisible(true);
    });

    const cleanupError = window.api.updater.onError((error) => {
      setErrorMessage(error.message);
      setState('error');
      setIsVisible(true);

      // Auto-dismiss error after 8 seconds
      setTimeout(() => {
        setIsVisible(false);
        setState('idle');
        setErrorMessage('');
      }, 8000);
    });

    // Cleanup all listeners on unmount
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  const handleDownload = async () => {
    setState('downloading');
    setProgress(0);
    try {
      await window.api.updater.downloadUpdate();
    } catch (err) {
      console.error('Download error:', err);
      // Error will be handled by onError listener
    }
  };

  const handleInstall = async () => {
    try {
      await window.api.updater.installUpdate();
    } catch (err) {
      console.error('Install error:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setState('idle');
  };

  // Don't render if not visible or in idle/checking state
  if (!isVisible || state === 'idle' || state === 'checking') {
    return null;
  }

  return (
    <div className={`update-toast update-toast--${state}`}>
      {state === 'available' && updateInfo && (
        <>
          <div className="update-toast-content">
            <strong>Ledgr v{updateInfo.version} is available</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
              Download to update on next restart
            </p>
          </div>
          <div className="update-actions">
            <button onClick={handleDownload} className="btn btn-primary btn-sm">
              Download
            </button>
            {updateInfo.releaseNotes && (
              <button onClick={() => setShowWhatsNew(true)} className="btn-link btn-sm">
                What&apos;s New
              </button>
            )}
            <button onClick={handleDismiss} className="btn btn-ghost btn-sm">
              Later
            </button>
          </div>
        </>
      )}

      {state === 'downloading' && (
        <>
          <div className="update-toast-content">
            <strong>Downloading update... {progress}%</strong>
            <div className="progress-bar" style={{ marginTop: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </>
      )}

      {state === 'downloaded' && updateInfo && (
        <>
          <div className="update-toast-content">
            <strong>Update ready to install</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
              Restart now or install automatically on next quit
            </p>
          </div>
          <div className="update-actions">
            <button onClick={handleInstall} className="btn btn-primary btn-sm">
              Restart Now
            </button>
            <button onClick={handleDismiss} className="btn btn-ghost btn-sm">
              Later
            </button>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="update-toast-content">
            <strong>Update error</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
              {errorMessage}
            </p>
          </div>
        </>
      )}

      {showWhatsNew && updateInfo?.releaseNotes && (
        <WhatsNewModal
          version={updateInfo.version}
          releaseNotes={normalizeReleaseNotes(updateInfo.releaseNotes)}
          onClose={() => setShowWhatsNew(false)}
        />
      )}
    </div>
  );
}
