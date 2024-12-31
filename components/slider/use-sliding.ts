import { useState, useRef, useEffect } from "react";

const PADDINGS = 110;

export const useSliding = (countElements: number) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalInViewport, setTotalInViewport] = useState(0);
  const [viewed, setViewed] = useState(0);

  useEffect(() => {
    const containerWidth = containerRef.current!.clientWidth - PADDINGS;

    if (!elementRef.current) return;
    setTotalInViewport(
      Math.floor(containerWidth / elementRef.current!.clientWidth),
    );
  }, [elementRef.current]);

  const handlePrev = () => {
    setViewed(viewed - totalInViewport);
  };

  const handleNext = () => {
    setViewed(viewed + totalInViewport);
  };

  const slideProps = {
    style: {
      transform: `translateX(${Math.ceil(-viewed * ((elementRef.current?.clientWidth ?? 0) + 10 - 0.35))}px)`,
    },
  };

  const hasPrev =
    -viewed * (Math.ceil(elementRef.current?.clientWidth ?? 0) + 10) < 0;
  const hasNext = viewed + totalInViewport < countElements;

  return {
    handlePrev,
    handleNext,
    slideProps,
    containerRef,
    hasPrev,
    hasNext,
    elementRef,
  };
};
