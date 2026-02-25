import React, { useState, useCallback, useRef } from 'react';
import {
  PreviewActivity, PredictionItem, WordAssociationItem, TrueFalseItem,
  PreviewPhaseResult, PreviewPredictionResult, PreviewWordAssocResult, PreviewTrueFalseResult,
} from '../types';
import { ClassroomTheme } from './Settings';
import { PredictionActivity } from './PredictionActivity';
import { WordAssociationActivity } from './WordAssociationActivity';
import { TrueFalseActivity } from './TrueFalseActivity';

interface PreviewPhaseProps {
  activities: PreviewActivity[];
  theme?: ClassroomTheme;
  onComplete: (results: PreviewPhaseResult) => void;
  onSkip: (results: PreviewPhaseResult) => void;
}

export const PreviewPhase: React.FC<PreviewPhaseProps> = ({
  activities,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const previewResults = useRef<PreviewPhaseResult>({ completed: false });

  const currentActivity = activities[currentActivityIndex];
  const isLastActivity = currentActivityIndex === activities.length - 1;

  const handlePredictionComplete = useCallback((results: PreviewPredictionResult[]) => {
    previewResults.current.prediction = results;
    if (isLastActivity) {
      previewResults.current.completed = true;
      onComplete(previewResults.current);
    } else {
      setCurrentActivityIndex(prev => prev + 1);
    }
  }, [isLastActivity, onComplete]);

  const handleWordAssocComplete = useCallback((results: PreviewWordAssocResult[]) => {
    previewResults.current.wordAssociation = results;
    if (isLastActivity) {
      previewResults.current.completed = true;
      onComplete(previewResults.current);
    } else {
      setCurrentActivityIndex(prev => prev + 1);
    }
  }, [isLastActivity, onComplete]);

  const handleTrueFalseComplete = useCallback((results: PreviewTrueFalseResult[]) => {
    previewResults.current.trueFalse = results;
    if (isLastActivity) {
      previewResults.current.completed = true;
      onComplete(previewResults.current);
    } else {
      setCurrentActivityIndex(prev => prev + 1);
    }
  }, [isLastActivity, onComplete]);

  const handleActivitySkip = useCallback(() => {
    if (isLastActivity) {
      previewResults.current.completed = true;
      onComplete(previewResults.current);
    } else {
      setCurrentActivityIndex(prev => prev + 1);
    }
  }, [isLastActivity, onComplete]);

  // Handle skip all preview
  const handleSkipAll = useCallback(() => {
    onSkip(previewResults.current);
  }, [onSkip]);

  if (!currentActivity || activities.length === 0) {
    // No activities, just complete
    onComplete(previewResults.current);
    return null;
  }

  // Render the appropriate activity component based on type
  switch (currentActivity.type) {
    case 'prediction':
      return (
        <PredictionActivity
          items={currentActivity.items as PredictionItem[]}
          theme={theme}
          onComplete={handlePredictionComplete}
          onSkip={isLastActivity ? handleSkipAll : handleActivitySkip}
        />
      );

    case 'wordAssociation':
      return (
        <WordAssociationActivity
          items={currentActivity.items as WordAssociationItem[]}
          theme={theme}
          onComplete={handleWordAssocComplete}
          onSkip={isLastActivity ? handleSkipAll : handleActivitySkip}
        />
      );

    case 'trueFalse':
      return (
        <TrueFalseActivity
          items={currentActivity.items as TrueFalseItem[]}
          theme={theme}
          onComplete={handleTrueFalseComplete}
          onSkip={isLastActivity ? handleSkipAll : handleActivitySkip}
        />
      );

    default:
      // Unknown activity type, skip to next
      handleActivitySkip();
      return null;
  }
};
