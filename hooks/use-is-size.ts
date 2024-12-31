import { useEffect, useState } from "react";

export const GIANT_BREAKPOINT = 2000;
export const DESKTOP_BREAKPOINT = 1800;
export const TABLET_BREAKPOINT = 1400;
export const MOBILE_BREAKPOINT = 1000;
export const TINY_BREAKPOINT = 800;

const useIsSize = () => {
  const [isGiant, setIsGiant] = useState<boolean | undefined>(undefined);
  const [isDesktop, setIsDesktop] = useState<boolean | undefined>(undefined);
  const [isTablet, setIsTablet] = useState<boolean | undefined>(undefined);
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  const [isTiny, setIsTiny] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsGiant(window.innerWidth < GIANT_BREAKPOINT);
      setIsDesktop(window.innerWidth < DESKTOP_BREAKPOINT);
      setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setIsTiny(window.innerWidth < TINY_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsGiant(window.innerWidth < GIANT_BREAKPOINT);
    setIsDesktop(window.innerWidth < DESKTOP_BREAKPOINT);
    setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    setIsTiny(window.innerWidth < TINY_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return {
    isGiant: !!isGiant,
    isDesktop: !!isDesktop,
    isTablet: !!isTablet,
    isMobile: !!isMobile,
    isTiny: !!isTiny,
  };
};

export { useIsSize };
