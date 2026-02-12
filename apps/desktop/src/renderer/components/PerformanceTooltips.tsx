import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  quickTip: string;
  fullExplanation: React.ReactNode;
}

/**
 * Performance tooltip with dual trigger:
 * - Hover shows quick tip
 * - Click info icon opens full explanation
 * - Click outside dismisses
 */
export function PerformanceTooltip({ children, quickTip, fullExplanation }: TooltipProps) {
  const [showQuick, setShowQuick] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowFull(false);
      }
    }

    if (showFull) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFull]);

  return (
    <div
      className="performance-tooltip-wrapper"
      ref={tooltipRef}
      onMouseEnter={() => !showFull && setShowQuick(true)}
      onMouseLeave={() => setShowQuick(false)}
    >
      <span className="tooltip-trigger">
        {children}
        <button
          className="info-icon"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(!showFull);
            setShowQuick(false);
          }}
          aria-label="More information"
        >
          i
        </button>
      </span>

      {showQuick && !showFull && (
        <div className="tooltip-quick">{quickTip}</div>
      )}

      {showFull && (
        <div className="tooltip-full">
          {fullExplanation}
        </div>
      )}
    </div>
  );
}

/**
 * TWR (Time-Weighted Return) tooltip with full explanation.
 */
export function TWRTooltip({ value }: { value: number }) {
  const formatted = (value * 100).toFixed(2);
  const isPositive = value >= 0;

  return (
    <PerformanceTooltip
      quickTip="Return that removes the impact of contributions/withdrawals"
      fullExplanation={
        <div className="tooltip-content">
          <h4>Time-Weighted Return (TWR)</h4>
          <p className="tooltip-definition">
            <strong>What it measures:</strong> How well your investments performed,
            independent of when you added or withdrew money.
          </p>
          <p className="tooltip-example">
            <strong>Example:</strong> If you invested $10,000 and your TWR is 10%,
            your investments grew by 10% regardless of whether you added more money
            during the year.
          </p>
          <p className="tooltip-usage">
            <strong>When to use:</strong> Compare your portfolio performance to
            benchmarks or other investors. TWR shows pure investment skill.
          </p>
        </div>
      }
    >
      <span className={`metric-value ${isPositive ? 'gain' : 'loss'}`}>
        TWR: {isPositive ? '+' : ''}{formatted}%
      </span>
    </PerformanceTooltip>
  );
}

/**
 * MWR (Money-Weighted Return) tooltip with full explanation.
 */
export function MWRTooltip({ value }: { value: number }) {
  const formatted = (value * 100).toFixed(2);
  const isPositive = value >= 0;

  return (
    <PerformanceTooltip
      quickTip="Your personal return based on when you added/withdrew money"
      fullExplanation={
        <div className="tooltip-content">
          <h4>Money-Weighted Return (MWR)</h4>
          <p className="tooltip-definition">
            <strong>What it measures:</strong> Your actual return considering the
            timing and size of your contributions and withdrawals.
          </p>
          <p className="tooltip-example">
            <strong>Example:</strong> If you added $5,000 right before a 20% gain,
            your MWR would be higher than your TWR because more of your money
            benefited from that gain.
          </p>
          <p className="tooltip-usage">
            <strong>When to use:</strong> Understand your personal wealth growth.
            MWR reflects your actual dollar gains based on your timing decisions.
          </p>
        </div>
      }
    >
      <span className={`metric-value ${isPositive ? 'gain' : 'loss'}`}>
        MWR: {isPositive ? '+' : ''}{formatted}%
      </span>
    </PerformanceTooltip>
  );
}

/**
 * Benchmark comparison tooltip.
 */
export function BenchmarkTooltip({ portfolioReturn, benchmarkReturn }: {
  portfolioReturn: number;
  benchmarkReturn: number;
}) {
  const difference = portfolioReturn - benchmarkReturn;
  const diffFormatted = (difference * 100).toFixed(2);
  const isOutperforming = difference >= 0;

  return (
    <PerformanceTooltip
      quickTip={`Your portfolio ${isOutperforming ? 'outperformed' : 'underperformed'} S&P 500 by ${Math.abs(difference * 100).toFixed(1)}%`}
      fullExplanation={
        <div className="tooltip-content">
          <h4>Benchmark Comparison</h4>
          <p className="tooltip-definition">
            <strong>S&P 500:</strong> A stock market index tracking 500 of the largest
            US companies. It is a common benchmark for portfolio performance.
          </p>
          <p className="tooltip-usage">
            <strong>What this means:</strong> {isOutperforming
              ? 'Your portfolio beat the market average over this period.'
              : 'The market average outperformed your portfolio over this period.'
            } Remember that past performance does not guarantee future results.
          </p>
        </div>
      }
    >
      <span className={`metric-value ${isOutperforming ? 'gain' : 'loss'}`}>
        vs S&P 500: {isOutperforming ? '+' : ''}{diffFormatted}%
      </span>
    </PerformanceTooltip>
  );
}
