/**
 * Mudbrick v2 -- Onboarding Tooltips
 *
 * First-run tooltip sequence highlighting key features.
 * Shows on first launch, remembers dismissal in the session store.
 * Ported from v1 js/onboarding.js tour step pattern.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import styles from './OnboardingTooltips.module.css';

interface TourStep {
  id: string;
  title: string;
  text: string;
  target: string; // CSS selector
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Mudbrick!',
    text: 'Drop a PDF here or click Open to get started. Your files never leave your device.',
    target: '.app-main',
    position: 'bottom',
  },
  {
    id: 'toolbar',
    title: 'Annotation Tools',
    text: 'Use the toolbar to draw, highlight, add text, shapes, stamps, and redactions.',
    target: '.app-toolbar',
    position: 'bottom',
  },
  {
    id: 'sidebar',
    title: 'Page Thumbnails',
    text: 'Thumbnails show all pages. Right-click for options like rotate, delete, or reorder.',
    target: '.app-sidebar',
    position: 'right',
  },
  {
    id: 'export',
    title: 'Export Your PDF',
    text: 'When you\'re done, export your PDF with all annotations permanently applied.',
    target: '.app-toolbar',
    position: 'bottom',
  },
];

export function OnboardingTooltips() {
  const showOnboarding = useSessionStore((s) => s.preferences.showOnboarding);
  const updatePreference = useSessionStore((s) => s.updatePreference);

  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [active, setActive] = useState(false);

  // Activate tour on first render if showOnboarding is true
  useEffect(() => {
    if (showOnboarding) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setActive(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showOnboarding]);

  const step = useMemo(
    () => (active ? TOUR_STEPS[currentStep] : null),
    [active, currentStep],
  );

  // Position the tooltip near the target element
  useEffect(() => {
    if (!step) {
      setTooltipPos(null);
      return;
    }

    const target = document.querySelector(step.target);
    if (!target) {
      // Target not found (e.g., sidebar closed) -- position center
      setTooltipPos({ top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - 160 });
      return;
    }

    const rect = target.getBoundingClientRect();
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + 20;
        break;
      case 'top':
        top = rect.top - gap - 120;
        left = rect.left + 20;
        break;
      case 'right':
        top = rect.top + 20;
        left = rect.right + gap;
        break;
      case 'left':
        top = rect.top + 20;
        left = rect.left - gap - 320;
        break;
    }

    // Clamp to viewport
    top = Math.max(8, Math.min(top, window.innerHeight - 200));
    left = Math.max(8, Math.min(left, window.innerWidth - 340));

    setTooltipPos({ top, left });
  }, [step]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Tour complete
      setActive(false);
      updatePreference('showOnboarding', false);
    }
  }, [currentStep, updatePreference]);

  const handleSkip = useCallback(() => {
    setActive(false);
    updatePreference('showOnboarding', false);
  }, [updatePreference]);

  if (!active || !step || !tooltipPos) return null;

  const arrowClass =
    step.position === 'bottom'
      ? styles.arrowTop
      : step.position === 'top'
        ? styles.arrowBottom
        : step.position === 'right'
          ? styles.arrowLeft
          : styles.arrowRight;

  return (
    <>
      <div className={styles.overlay} onClick={handleSkip} />
      <div
        className={styles.tooltip}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        role="dialog"
        aria-label={`Tour step ${currentStep + 1} of ${TOUR_STEPS.length}`}
      >
        <div className={`${styles.arrow} ${arrowClass}`} />
        <h3 className={styles.tooltipTitle}>{step.title}</h3>
        <p className={styles.tooltipText}>{step.text}</p>
        <div className={styles.tooltipActions}>
          <span className={styles.stepIndicator}>
            {currentStep + 1} / {TOUR_STEPS.length}
          </span>
          <div className={styles.btnGroup}>
            <button className={styles.skipBtn} onClick={handleSkip}>
              Skip tour
            </button>
            <button className={styles.nextBtn} onClick={handleNext}>
              {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
