'use client';

import React, { useState, useEffect } from 'react';
import OnboardingWelcome from './OnboardingWelcome';
import GuidedTour from './GuidedTour';

const OnboardingManager = ({ userId }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const checkOnboardingStatus = () => {
      const onboardingKey = `onboarding_completed_${userId}`;
      const hasCompletedOnboarding = localStorage.getItem(onboardingKey);
      
      if (!hasCompletedOnboarding && userId) {
        setIsNewUser(true);
        // Small delay to let the page load before showing modal
        setTimeout(() => {
          setShowWelcome(true);
        }, 1000);
      }
    };

    checkOnboardingStatus();
  }, [userId]);

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    // Mark as completed even if they skip
    const onboardingKey = `onboarding_completed_${userId}`;
    localStorage.setItem(onboardingKey, 'true');
  };

  const handleStartTour = () => {
    setShowWelcome(false);
    setShowTour(true);
  };

  const handleTourClose = () => {
    setShowTour(false);
    // Mark as completed
    const onboardingKey = `onboarding_completed_${userId}`;
    localStorage.setItem(onboardingKey, 'true');
  };

  const handleTourComplete = (tourWorkflowId) => {
    setShowTour(false);
    // Mark as completed and store tour workflow ID
    const onboardingKey = `onboarding_completed_${userId}`;
    const tourKey = `tour_workflow_${userId}`;
    localStorage.setItem(onboardingKey, 'true');
    if (tourWorkflowId) {
      localStorage.setItem(tourKey, tourWorkflowId);
    }
    
    // Optionally redirect to the tour workflow
    if (tourWorkflowId && window.location.pathname === '/workflows') {
      // Refresh the workflows page to show the new tour workflow
      window.location.reload();
    }
  };

  // Method to manually trigger onboarding (for help menu, etc.)
  const startOnboarding = () => {
    setShowWelcome(true);
  };

  return (
    <>
      <OnboardingWelcome
        open={showWelcome}
        onClose={handleWelcomeClose}
        onStartTour={handleStartTour}
      />
      <GuidedTour
        open={showTour}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
      />
    </>
  );
};

// Export both the manager and a hook to trigger onboarding manually
export const useOnboarding = () => {
  const triggerOnboarding = () => {
    // This could be enhanced to work with the OnboardingManager
    // For now, we'll use a simple approach
    const event = new CustomEvent('triggerOnboarding');
    window.dispatchEvent(event);
  };

  return { triggerOnboarding };
};

export default OnboardingManager;
