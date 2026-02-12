import { useState, useEffect } from 'react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VersionInfo {
  app: string;
  electron: string;
  node: string;
  chrome: string;
}

const URLS = {
  source: 'https://github.com/jchilcher/ledgr',
  privacy: 'https://github.com/jchilcher/ledgr/blob/main/PRIVACY.md',
  terms: 'https://github.com/jchilcher/ledgr/blob/main/TERMS.md',
  donate: 'https://buymeacoffee.com/techloomit',
};

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadVersionInfo();
    }
  }, [isOpen]);

  const loadVersionInfo = async () => {
    try {
      const info = await window.api.app.getVersion();
      setVersionInfo(info);
    } catch (err) {
      console.error('Error loading version info:', err);
    }
  };

  const handleCheckForUpdates = async () => {
    setChecking(true);
    setCheckResult('');

    try {
      await window.api.updater.checkForUpdates();
      // If no update is available, the UpdateNotification component won't show anything
      // So we show a brief feedback message here
      setCheckResult('Checking...');

      // Clear the message after 3 seconds (either UpdateNotification will show, or we assume up to date)
      setTimeout(() => {
        setCheckResult('');
      }, 3000);
    } catch (err) {
      console.error('Error checking for updates:', err);
      setCheckResult('Check failed');
      setTimeout(() => setCheckResult(''), 3000);
    } finally {
      setChecking(false);
    }
  };

  const openExternal = (url: string) => {
    window.api.shell.openExternal(url).catch((err) => {
      console.error('Error opening URL:', err);
    });
  };

  const handleClose = () => {
    setCheckResult('');
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="about-dialog-overlay" onClick={handleClose}>
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="about-dialog-close" onClick={handleClose} aria-label="Close">
          ×
        </button>

        <div className="about-dialog-content">
          <div className="about-icon">
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: 'var(--color-primary)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              margin: '0 auto 16px'
            }}>
              L
            </div>
          </div>

          <h2 style={{ margin: '0 0 8px 0', textAlign: 'center' }}>Ledgr</h2>

          {versionInfo && (
            <>
              <p style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: 'center',
                margin: '0 0 12px 0',
                color: 'var(--color-text)'
              }}>
                Version {versionInfo.app}
              </p>

              <p style={{
                fontSize: '0.85rem',
                textAlign: 'center',
                margin: '0 0 8px 0',
                color: 'var(--color-text-muted)'
              }}>
                Electron {versionInfo.electron} | Node {versionInfo.node} | Chrome {versionInfo.chrome}
              </p>
            </>
          )}

          <p style={{
            fontSize: '0.8rem',
            textAlign: 'center',
            margin: '0 0 24px 0',
            color: 'var(--color-text-muted)'
          }}>
            Copyright &copy; 2024-2026 Johnathen Chilcher / Techloom.it LLC
          </p>

          <div className="about-actions">
            <button
              onClick={handleCheckForUpdates}
              disabled={checking}
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '12px' }}
            >
              {checking ? 'Checking...' : 'Check for Updates'}
            </button>

            {checkResult && (
              <p style={{
                fontSize: '0.9rem',
                textAlign: 'center',
                margin: '0 0 12px 0',
                color: 'var(--color-info)'
              }}>
                {checkResult}
              </p>
            )}

            <button
              onClick={() => openExternal(URLS.source)}
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: '8px' }}
            >
              View Source Code
            </button>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                onClick={() => openExternal(URLS.privacy)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Privacy Policy
              </button>
              <button
                onClick={() => openExternal(URLS.terms)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Terms of Service
              </button>
            </div>

            <button
              onClick={() => openExternal(URLS.donate)}
              className="btn btn-ghost"
              style={{
                width: '100%',
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Support Ledgr
            </button>
          </div>

          <div style={{
            margin: '20px 0 0 0',
            padding: '12px',
            backgroundColor: 'var(--color-surface-raised, var(--color-bg))',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}>
            <p style={{
              fontSize: '0.8rem',
              textAlign: 'center',
              margin: '0 0 8px 0',
              fontWeight: '600',
              color: 'var(--color-text)',
            }}>
              AGPL-3.0 License
            </p>
            <p style={{
              fontSize: '0.7rem',
              textAlign: 'center',
              margin: 0,
              color: 'var(--color-text-muted)',
              lineHeight: 1.4,
            }}>
              This program comes with ABSOLUTELY NO WARRANTY. This is free software, and you
              are welcome to redistribute it under certain conditions. See the AGPL-3.0 license
              for details.
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={handleClose} className="btn btn-ghost">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
