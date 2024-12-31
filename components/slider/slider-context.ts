import { createContext, RefObject } from "react";

export default createContext({} as { elementRef: RefObject<HTMLDivElement> });
