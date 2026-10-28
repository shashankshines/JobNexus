'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ElapsedProgressResult {
  isScrollingCards: boolean;
  rawElapsedCount: number;
  progressPercent: number;
  isAllViewed: boolean;
}

export interface ContainerRectInput {
  top: number;
  bottom: number;
  height: number;
}

/**
 * Pure calculation logic for tracking elapsed roles progress during scroll.
 * Separated for testability and zero-dependency unit verification.
 */
export function calculateElapsedProgress(
  containerRect: ContainerRectInput | null,
  cardTops: number[],
  totalJobs: number,
  viewportHeight: number,
  scrollY: number,
  docHeight: number,
  readingThresholdRatio = 0.65
): ElapsedProgressResult {
  if (totalJobs <= 0 || !containerRect) {
    return {
      isScrollingCards: false,
      rawElapsedCount: 0,
      progressPercent: 0,
      isAllViewed: false,
    };
  }

  const readingLine = viewportHeight * readingThresholdRatio;

  // 1. If grid top is below the reading threshold, user is still above the cards section (in hero/search console)
  if (containerRect.top > readingLine) {
    return {
      isScrollingCards: false,
      rawElapsedCount: 0,
      progressPercent: 0,
      isAllViewed: false,
    };
  }

  // 2. If the user reached the absolute bottom of the document or scrolled past the grid
  const isDocumentBottom = viewportHeight + scrollY >= docHeight - 50;
  const isPastGridBottom = containerRect.bottom < 60;

  if (isDocumentBottom || isPastGridBottom) {
    return {
      isScrollingCards: true,
      rawElapsedCount: totalJobs,
      progressPercent: 100,
      isAllViewed: true,
    };
  }

  // 3. Otherwise, determine which card index has elapsed past the reading threshold
  let maxElapsed = 1;
  if (cardTops.length > 0) {
    for (let i = 0; i < cardTops.length; i++) {
      if (cardTops[i] <= readingLine) {
        maxElapsed = i + 1;
      } else {
        break; // Cards in grid are arranged sequentially; remaining cards are further down
      }
    }
  } else {
    // Fallback: estimate from container scroll progress if individual card tops are not supplied
    const scrolledPastTop = Math.max(0, readingLine - containerRect.top);
    const scrollRatio = containerRect.height > 0 ? Math.min(1, scrolledPastTop / containerRect.height) : 0;
    maxElapsed = Math.max(1, Math.ceil(scrollRatio * totalJobs));
  }

  const clamped = Math.max(1, Math.min(maxElapsed, totalJobs));
  const progressPercent = Math.min(100, Math.max(0, (clamped / totalJobs) * 100));
  const isAllViewed = clamped >= totalJobs;

  return {
    isScrollingCards: true,
    rawElapsedCount: clamped,
    progressPercent,
    isAllViewed,
  };
}

/**
 * Calculates the next step value for smooth, non-blocking counting animation.
 */
export function calculateCounterStep(current: number, target: number, speedDivisor = 5): number {
  if (current === target) return target;
  const diff = target - current;
  const step = Math.max(1, Math.ceil(Math.abs(diff) / speedDivisor));
  return diff > 0 ? Math.min(target, current + step) : Math.max(target, current - step);
}

export interface UseElapsedJobCounterOptions {
  gridRef: React.RefObject<HTMLElement | null>;
  totalJobs: number;
  isActive: boolean;
}

export interface UseElapsedJobCounterReturn {
  isScrollingCards: boolean;
  rawElapsedCount: number;
  animatedElapsedCount: number;
  progressPercent: number;
  isAllViewed: boolean;
}

/**
 * Custom React hook for tracking elapsed roles viewed while scrolling through job cards.
 * Operates at 60fps via requestAnimationFrame and passive event listeners.
 */
export function useElapsedJobCounter({
  gridRef,
  totalJobs,
  isActive,
}: UseElapsedJobCounterOptions): UseElapsedJobCounterReturn {
  const [isScrollingCards, setIsScrollingCards] = useState<boolean>(false);
  const [rawElapsedCount, setRawElapsedCount] = useState<number>(0);
  const [animatedElapsedCount, setAnimatedElapsedCount] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isAllViewed, setIsAllViewed] = useState<boolean>(false);

  const scrollRafIdRef = useRef<number | null>(null);
  const animRafIdRef = useRef<number | null>(null);

  // Fast scroll handler that samples the DOM positions in requestAnimationFrame
  const updateElapsedFromScroll = useCallback(() => {
    if (!isActive || totalJobs <= 0 || !gridRef.current || typeof window === 'undefined') {
      setIsScrollingCards(false);
      setRawElapsedCount(0);
      setProgressPercent(0);
      setIsAllViewed(false);
      return;
    }

    const container = gridRef.current;
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;

    // Collect tops of cards with data-job-card-index
    const cardNodes = container.querySelectorAll<HTMLElement>('[data-job-card-index]');
    const cardTops: number[] = [];
    for (let i = 0; i < cardNodes.length; i++) {
      cardTops.push(cardNodes[i].getBoundingClientRect().top);
    }

    const result = calculateElapsedProgress(
      { top: rect.top, bottom: rect.bottom, height: rect.height },
      cardTops,
      totalJobs,
      viewportHeight,
      scrollY,
      docHeight
    );

    setIsScrollingCards(result.isScrollingCards);
    setRawElapsedCount(result.rawElapsedCount);
    setProgressPercent(result.progressPercent);
    setIsAllViewed(result.isAllViewed);
  }, [isActive, totalJobs, gridRef]);

  // Set up passive scroll & resize listener
  useEffect(() => {
    if (!isActive || totalJobs <= 0) {
      setIsScrollingCards(false);
      setRawElapsedCount(0);
      setAnimatedElapsedCount(0);
      setProgressPercent(0);
      setIsAllViewed(false);
      return;
    }

    const handleScroll = () => {
      if (scrollRafIdRef.current) return;
      scrollRafIdRef.current = window.requestAnimationFrame(() => {
        scrollRafIdRef.current = null;
        updateElapsedFromScroll();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (scrollRafIdRef.current) {
        window.cancelAnimationFrame(scrollRafIdRef.current);
        scrollRafIdRef.current = null;
      }
    };
  }, [isActive, totalJobs, updateElapsedFromScroll]);

  // Smooth counting animation loop
  useEffect(() => {
    if (!isScrollingCards || rawElapsedCount <= 0) {
      setAnimatedElapsedCount(0);
      return;
    }

    // Check for reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimatedElapsedCount(rawElapsedCount);
      return;
    }

    let isRunning = true;

    const tick = () => {
      setAnimatedElapsedCount((prev) => {
        if (prev === rawElapsedCount) return prev;
        const next = calculateCounterStep(prev, rawElapsedCount, 4);
        if (next !== rawElapsedCount && isRunning) {
          animRafIdRef.current = window.requestAnimationFrame(tick);
        }
        return next;
      });
    };

    animRafIdRef.current = window.requestAnimationFrame(tick);

    return () => {
      isRunning = false;
      if (animRafIdRef.current) {
        window.cancelAnimationFrame(animRafIdRef.current);
        animRafIdRef.current = null;
      }
    };
  }, [isScrollingCards, rawElapsedCount]);

  return {
    isScrollingCards,
    rawElapsedCount,
    animatedElapsedCount,
    progressPercent,
    isAllViewed,
  };
}
