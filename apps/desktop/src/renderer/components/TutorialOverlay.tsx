import React from 'react';
import type { AnalyticsToolId } from './AnalyticsLanding';
import { tutorialContent } from './tutorialContent';

interface TutorialOverlayProps {
  toolId: AnalyticsToolId;
  onDismiss: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ toolId, onDismiss }) => {
  const content = tutorialContent[toolId];
  if (!content) return null;

  const handleDismiss = async () => {
    await window.api.tutorials.markCompleted(toolId);
    onDismiss();
  };

  return (
    <div className="tutorial-overlay" onClick={handleDismiss}>
      <div className="tutorial-modal" onClick={e => e.stopPropagation()}>
        <div className="tutorial-header">
          <span className="tutorial-icon">{content.icon}</span>
          <h3 className="tutorial-title">{content.title}</h3>
        </div>
        <ul className="tutorial-points">
          {content.points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
        <button className="btn btn-primary tutorial-dismiss" onClick={handleDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
};

export default TutorialOverlay;
