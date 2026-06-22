import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { AppProvider as MYTAppProvider } from "@/myt/lib/app-context";
import { SettingsProvider as MYTSettingsProvider } from "@/myt/lib/settings-context";
import { TourDataProvider as MYTTourDataProvider } from "@/myt/lib/tour-data-context";
import { AuthGate } from "@/components/AuthGate";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Align Deal Flow - Gharpayy CRM" },
      { name: "description", content: "Real-estate closing CRM with HR, Flow Ops, TCM, and Owner modules." },
      { property: "og:title", content: "Align Deal Flow - Gharpayy CRM" },
      { name: "twitter:title", content: "Align Deal Flow - Gharpayy CRM" },
      { property: "og:description", content: "Real-estate closing CRM with HR, Flow Ops, TCM, and Owner modules." },
      { name: "twitter:description", content: "Real-estate closing CRM with HR, Flow Ops, TCM, and Owner modules." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cdbd98a7-e10c-4823-bffd-0d94377d1a44/id-preview-d6582724--03dde394-5d87-421b-b74f-5c9974de7c0d.lovable.app-1776859196342.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cdbd98a7-e10c-4823-bffd-0d94377d1a44/id-preview-d6582724--03dde394-5d87-421b-b74f-5c9974de7c0d.lovable.app-1776859196342.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <MYTSettingsProvider>
        <MYTTourDataProvider>
          <MYTAppProvider>
            <AuthGate>
              <Outlet />
              <KeyboardShortcuts />
            </AuthGate>
            <Toaster />
          </MYTAppProvider>
        </MYTTourDataProvider>
      </MYTSettingsProvider>
    </QueryClientProvider>
  );
}
