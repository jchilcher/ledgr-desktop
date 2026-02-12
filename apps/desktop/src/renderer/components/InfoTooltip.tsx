import React, { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  text: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Show below if too close to top of viewport
      setPosition(rect.top < 120 ? 'below' : 'above');
    }
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block', marginLeft: '6px' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(v => !v)}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-border)',
        color: 'var(--color-text-muted)',
        fontSize: '11px',
        fontWeight: 700,
        cursor: 'help',
        userSelect: 'none',
        lineHeight: 1,
      }}>?</span>
      {visible && (
        <span style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          ...(position === 'above'
            ? { bottom: 'calc(100% + 8px)' }
            : { top: 'calc(100% + 8px)' }
          ),
          backgroundColor: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: '0.8rem',
          color: 'var(--color-text)',
          lineHeight: 1.4,
          width: '240px',
          boxShadow: 'var(--shadow-md)',
          zIndex: 100,
          pointerEvents: 'none',
          textAlign: 'left',
          fontWeight: 'normal',
        }}>{text}</span>
      )}
    </span>
  );
};

export default InfoTooltip;
