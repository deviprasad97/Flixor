"use client";

import { ReactNode, Suspense, useEffect } from "react";
import ThemeProvider from "@/components/theme-provier";
import { AuthProvider } from "@/components/auth-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/hooks/use-session";
import { uuid, uuidv4 } from "@/lib/utils";
import { MetaScreen } from "@/components/screens/meta-screen";
import { useSearchParams } from "next/navigation";
import { WatchScreen } from "@/components/screens/watch-screen";
import { LibraryScreen } from "@/components/screens/library-screen";

const client = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const watch = searchParams.get("watch");
  const key = searchParams.get("key");
  const libtitle = searchParams.get("libtitle");
  const full = searchParams.get("full");
  const contentDirectoryID = searchParams.get("contentDirectoryID");

  useEffect(() => {
    if (!localStorage.getItem("clientId")) {
      localStorage.setItem("clientId", uuidv4());
    }

    if (!sessionStorage.getItem("sessionId")) {
      sessionStorage.setItem("sessionId", uuid());
    }
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <AuthProvider>
          <SessionProvider>
            <Suspense>
              <MetaScreen />
              <WatchScreen watch={watch ?? undefined} />
              <LibraryScreen
                contentDirectoryID={contentDirectoryID ?? undefined}
                title={libtitle ?? undefined}
                keypath={key ?? undefined}
                full={!!(full && full === "true")}
              />
            </Suspense>
            {children}
          </SessionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
