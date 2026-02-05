import React, { useState, useCallback } from 'react';
import { PreviewActivity, PredictionItem, WordAssociationItem, TrueFalseItem } from '../types';
import { ClassroomTheme } from './Settings';
import { PredictionActivity } from './PredictionActivity';
import { WordAssociationActivity } from './WordAssociationActivity';
import { TrueFalseActivity } from './TrueFalseActivity';

interface PreviewPhaseProps {
  activities: PreviewActivity[];
  theme?: ClassroomTheme;
  onComplete: () => void;
  onSkip: () => void;
}

export const PreviewPhase: React.FC<PreviewPhaseProps> = ({
  activities,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);

  const currentActivity = activities[currentActivityIndex];
  const isLastActivity = currentActivityIndex === activities.length - 1;

  const handleActivityComplete = useCallback(() => {
    if (isLastActivity) {
      onComplete();
    } else {
      setCurrentActivityIndex(prev => prev + 1);
    }
  }, [isLastActivity, onComplete]);

  const handleActivitySkip = useCallback(() => {
    // Skipping an activity advances to the next one
    if (isLastActivity) {
      onComplete();
    } else {
      setCurrentActivityIndex(prev => prev + 1);
    }
  }, [isLastActivity, onComplete]);

  // Handle skip all preview
  const handleSkipAll = useCallback(() => {
    onSkip();
  }, [onSkip]);

  if (!currentActivity || activities.length === 0) {
    // No activities, just complete
    onComplete();
    return null;
  }

  // Render the appropriate activity component based on type
  switch (currentActivity.type) {
    case 'prediction':
      return (
        <PredictionActivity
          items={currentActivity.items as PredictionItem[]}
          theme={theme}
          onComplete={handleActivityComplete}
          onSkip={isLastActivity ? handleSkipAll : handleActivitySkip}
        />
      );

    case 'wordAssociation':
      return (
        <WordAssociationActivity
          items={currentActivity.items as WordAssociationItem[]}
          theme={theme}
          onComplete={handleActivityComplete}
          onSkip={isLastActivity ? handleSkipAll : handleActivitySkip}
        />
      );

    case 'trueFalse':
      return (
        <TrueFalseActivity
          items={currentActivity.items as TrueFalseItem[]}
          theme={theme}
          onComplete={handleActivityComplete}
          onSkip={isLastActivity ? handleSkipAll : handleActivitySkip}
        />
      );

    default:
      // Unknown activity type, skip to next
      handleActivityComplete();
      return null;
  }
};
