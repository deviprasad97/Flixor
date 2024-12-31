import { useEffect, useState } from "react";

export const useIsScrollAtTop = () => {
  const [isScrollAtTop, setIsScrollAtTop] = useState(true);

  useEffect(() => {
    const scroll = () => {
      setIsScrollAtTop(window.scrollY === 0);
    };

    window.addEventListener("scroll", scroll);

    return () => {
      window.removeEventListener("scroll", scroll);
    };
  }, []);

  return isScrollAtTop;
};
