
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";

import { PickerProvider } from "@/hooks/use-picker";
import { DriverProvider } from "@/hooks/use-driver";
import { ActiveCustomerProvider } from "@/hooks/use-active-customer";
import { RealtimeInvalidationBridge } from "@/hooks/use-realtime-invalidation";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-ink">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ABL Distribution" },
      { name: "description", content: "ABL Distribution — Barbados foodservice supply ordering." },
      { property: "og:title", content: "ABL Distribution" },
      { name: "twitter:title", content: "ABL Distribution" },
      { property: "og:description", content: "ABL Distribution — Barbados foodservice supply ordering." },
      { name: "twitter:description", content: "ABL Distribution — Barbados foodservice supply ordering." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/57f4cbdb-3664-4f6b-882e-8b24ab491dc6/id-preview-381bf953--fcf5cce5-91aa-4989-bf4f-11bcf374b6a6.lovable.app-1780088966714.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/57f4cbdb-3664-4f6b-882e-8b24ab491dc6/id-preview-381bf953--fcf5cce5-91aa-4989-bf4f-11bcf374b6a6.lovable.app-1780088966714.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PickerProvider>
          <DriverProvider>
            <ActiveCustomerProvider>
              <CartProvider>
                <RealtimeInvalidationBridge />
                <Outlet />
                <Toaster richColors position="top-right" />
              </CartProvider>
            </ActiveCustomerProvider>
          </DriverProvider>
        </PickerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
