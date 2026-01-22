import React, { useState, useRef } from 'react';
import { SavedAudio, ListeningTest, TestAttempt } from '../types';
import { ArrowLeftIcon, PlayIcon, PauseIcon, RefreshIcon } from './Icons';

interface TestTakerProps {
  test: ListeningTest;
  audio: SavedAudio;
  onComplete: (attempt: TestAttempt) => void;
  onBack: () => void;
}

export const TestTaker: React.FC<TestTakerProps> = ({ test, audio, onComplete, onBack }) => {
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const updateAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    // Calculate score
    let correct = 0;
    test.questions.forEach(q => {
      const userAnswer = answers[q.id]?.toLowerCase().trim() || '';
      const correctAnswer = q.correctAnswer.toLowerCase().trim();
      if (userAnswer === correctAnswer) {
        correct++;
      }
    });

    const finalScore = Math.round((correct / test.questions.length) * 100);
    setScore(finalScore);
    setIsSubmitted(true);

    const attempt: TestAttempt = {
      testId: test.id,
      answers,
      score: finalScore,
      completedAt: new Date().toISOString(),
    };

    onComplete(attempt);
  };

  const handleRetry = () => {
    setAnswers({});
    setIsSubmitted(false);
    setScore(null);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const getAnswerStatus = (questionId: string) => {
    if (!isSubmitted) return null;
    const question = test.questions.find(q => q.id === questionId);
    if (!question) return null;
    const userAnswer = answers[questionId]?.toLowerCase().trim() || '';
    const correctAnswer = question.correctAnswer.toLowerCase().trim();
    return userAnswer === correctAnswer ? 'correct' : 'incorrect';
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Audio Player */}
      <div className="bg-slate-900 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm mb-1">Listen to the audio:</p>
            <p className="text-white font-medium">{audio.title}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePlayPause}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleRestart}
              className="p-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
            >
              <RefreshIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {audio.audioUrl && (
          <audio
            ref={audioRef}
            src={audio.audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            className="hidden"
          />
        )}
      </div>

      {/* Score Display (after submission) */}
      {isSubmitted && score !== null && (
        <div className={`rounded-2xl p-6 mb-6 text-center ${
          score >= 70 ? 'bg-green-50 border-2 border-green-200' : 'bg-amber-50 border-2 border-amber-200'
        }`}>
          <p className="text-lg font-bold mb-1">
            {score >= 70 ? 'Great job!' : 'Keep practicing!'}
          </p>
          <p className="text-4xl font-bold mb-2">
            {score}%
          </p>
          <p className="text-sm text-slate-600">
            You got {test.questions.filter(q => getAnswerStatus(q.id) === 'correct').length} out of {test.questions.length} correct
          </p>
          <button
            onClick={handleRetry}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Questions */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
        <div className="space-y-6">
          {test.questions.map((question, index) => {
            const status = getAnswerStatus(question.id);

            return (
              <div
                key={question.id}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  status === 'correct'
                    ? 'border-green-300 bg-green-50'
                    : status === 'incorrect'
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    status === 'correct'
                      ? 'bg-green-200 text-green-700'
                      : status === 'incorrect'
                      ? 'bg-red-200 text-red-700'
                      : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {index + 1}
                  </span>
                  <p className="font-medium text-slate-900">{question.questionText}</p>
                </div>

                {/* Multiple Choice */}
                {test.type === 'listening-comprehension' && question.options && (
                  <div className="ml-11 space-y-2">
                    {question.options.map((option, optIndex) => (
                      <label
                        key={optIndex}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSubmitted
                            ? option === question.correctAnswer
                              ? 'bg-green-100 border border-green-300'
                              : answers[question.id] === option
                              ? 'bg-red-100 border border-red-300'
                              : 'bg-white border border-slate-200'
                            : answers[question.id] === option
                            ? 'bg-indigo-100 border border-indigo-300'
                            : 'bg-white border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={() => updateAnswer(question.id, option)}
                          disabled={isSubmitted}
                          className="text-indigo-600"
                        />
                        <span className="text-sm">{option}</span>
                        {isSubmitted && option === question.correctAnswer && (
                          <span className="ml-auto text-xs text-green-600 font-medium">Correct</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                {/* Fill in Blank / Dictation */}
                {(test.type === 'fill-in-blank' || test.type === 'dictation') && (
                  <div className="ml-11">
                    <input
                      type="text"
                      value={answers[question.id] || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Type your answer..."
                      className={`w-full p-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                        isSubmitted
                          ? status === 'correct'
                            ? 'bg-green-100 border-green-300'
                            : 'bg-red-100 border-red-300'
                          : 'bg-white border-slate-200'
                      }`}
                    />
                    {isSubmitted && status === 'incorrect' && (
                      <p className="mt-2 text-sm text-green-600">
                        Correct answer: <strong>{question.correctAnswer}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Explanation (shown when answer is incorrect) */}
                {isSubmitted && status === 'incorrect' && question.explanation && (
                  <div className="ml-11 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Explanation:</strong> {question.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        {!isSubmitted && (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < test.questions.length}
            className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Answers ({Object.keys(answers).length}/{test.questions.length} answered)
          </button>
        )}
      </div>
    </div>
  );
};
