import React, { useState, useEffect, useRef, useCallback } from 'react';

const FindBar: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [matchInfo, setMatchInfo] = useState<{ active: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setVisible(false);
    setQuery('');
    setMatchInfo(null);
    window.api.find.stopFindInPage();
  }, []);

  // Listen for Ctrl+F from the menu / main process
  useEffect(() => {
    const cleanup = window.api.find.onOpen(() => {
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    });
    return cleanup;
  }, []);

  // Also listen for Ctrl+F from the keyboard directly (in case menu doesn't fire)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setVisible(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && visible) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, close]);

  // Listen for match results from main process
  useEffect(() => {
    const cleanup = window.api.find.onResult((result) => {
      if (result.finalUpdate) {
        setMatchInfo({ active: result.activeMatchOrdinal, total: result.matches });
      }
    });
    return cleanup;
  }, []);

  // Trigger search when query changes
  useEffect(() => {
    if (!visible) return;
    if (query.length > 0) {
      window.api.find.findInPage(query);
    } else {
      window.api.find.stopFindInPage();
      setMatchInfo(null);
    }
  }, [query, visible]);

  const handleNext = () => {
    if (query.length > 0) {
      window.api.find.findInPage(query, { forward: true, findNext: true });
    }
  };

  const handlePrev = () => {
    if (query.length > 0) {
      window.api.find.findInPage(query, { forward: false, findNext: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    if (e.key === 'Escape') {
      close();
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: 'var(--color-surface, #fff)',
        borderBottom: '1px solid var(--color-border, #ccc)',
        borderLeft: '1px solid var(--color-border, #ccc)',
        borderBottomLeftRadius: 'var(--radius-sm, 4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
      data-testid="find-bar"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        style={{
          width: '220px',
          padding: '4px 8px',
          fontSize: '13px',
          border: '1px solid var(--color-border, #ccc)',
          borderRadius: 'var(--radius-sm, 4px)',
          outline: 'none',
          background: 'var(--color-bg, #fff)',
          color: 'var(--color-text, #000)',
        }}
        data-testid="find-input"
      />
      {matchInfo && query.length > 0 && (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', minWidth: '50px', textAlign: 'center' }}>
          {matchInfo.total === 0 ? 'No matches' : `${matchInfo.active} / ${matchInfo.total}`}
        </span>
      )}
      <button
        onClick={handlePrev}
        disabled={!query}
        style={{
          padding: '2px 8px',
          fontSize: '13px',
          cursor: query ? 'pointer' : 'default',
          border: '1px solid var(--color-border, #ccc)',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'var(--color-bg, #fff)',
          color: 'var(--color-text, #000)',
        }}
        title="Previous match (Shift+Enter)"
      >
        &#x25B2;
      </button>
      <button
        onClick={handleNext}
        disabled={!query}
        style={{
          padding: '2px 8px',
          fontSize: '13px',
          cursor: query ? 'pointer' : 'default',
          border: '1px solid var(--color-border, #ccc)',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'var(--color-bg, #fff)',
          color: 'var(--color-text, #000)',
        }}
        title="Next match (Enter)"
      >
        &#x25BC;
      </button>
      <button
        onClick={close}
        style={{
          padding: '2px 8px',
          fontSize: '13px',
          cursor: 'pointer',
          border: '1px solid var(--color-border, #ccc)',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'var(--color-bg, #fff)',
          color: 'var(--color-text, #000)',
        }}
        title="Close (Escape)"
      >
        &#x2715;
      </button>
    </div>
  );
};

export default FindBar;
