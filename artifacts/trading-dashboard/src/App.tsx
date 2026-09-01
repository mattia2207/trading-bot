import { lazy, Suspense, useEffect, useRef } from "react";
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Home         = lazy(() => import("@/pages/home"));
const Analytics    = lazy(() => import("@/pages/analytics"));
const SignalDetail = lazy(() => import("@/pages/signal-detail"));
const NotFound     = lazy(() => import("@/pages/not-found"));

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#ef6548",
    colorForeground: "#193036",
    colorMutedForeground: "#617176",
    colorDanger: "#c9433d",
    colorBackground: "#fffdf8",
    colorInput: "#f5f0e7",
    colorInputForeground: "#193036",
    colorNeutral: "#d8d0c2",
    fontFamily: "Manrope, sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d8d0c2]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#193036] font-bold",
    headerSubtitle: "text-[#617176]",
    socialButtonsBlockButtonText: "text-[#193036]",
    formFieldLabel: "text-[#193036]",
    footerActionLink: "text-[#d94f34]",
    footerActionText: "text-[#617176]",
    dividerText: "text-[#617176]",
    identityPreviewEditButton: "text-[#d94f34]",
    formFieldSuccessText: "text-[#1f795e]",
    alertText: "text-[#c9433d]",
    logoBox: "h-10",
    logoImage: "h-10",
    socialButtonsBlockButton: "border-[#d8d0c2] bg-[#f5f0e7]",
    formButtonPrimary: "bg-[#ef6548] text-white hover:bg-[#d94f34]",
    formFieldInput: "border-[#d8d0c2] bg-[#f5f0e7] text-[#193036]",
    footerAction: "border-[#d8d0c2]",
    dividerLine: "bg-[#d8d0c2]",
    alert: "border-[#c9433d]",
    otpCodeFieldInput: "border-[#d8d0c2] bg-[#f5f0e7] text-[#193036]",
    formFieldRow: "text-[#193036]",
    main: "bg-transparent",
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      gcTime:              300_000,
      retry:                     1,
      refetchOnWindowFocus:  false,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/"            component={HomeRedirect} />
        <Route path="/user-portal" component={UserPortal}    />
        <Route path="/sign-in/*?"  component={SignInPage}   />
        <Route path="/sign-up/*?"  component={SignUpPage}   />
        <Route path="/analytics"   component={Analytics}    />
        <Route path="/signals/:id" component={SignalDetail} />
        <Route                     component={NotFound}     />
      </Switch>
    </Suspense>
  );
}

function Landing() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <section className="max-w-xl text-center">
        <p className="font-data text-xs uppercase tracking-[0.28em] text-primary">Advisor Bot Terminal</p>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
          Paper trading, with institutional discipline.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          A private LONG-only cockpit for Binance Spot Testnet and paper execution.
          Every decision is gated by risk controls, manual approval and an audit trail.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a className="rounded-sm bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" href={`${basePath}/sign-up`}>
            Create account
          </a>
          <a className="rounded-sm border border-border px-5 py-3 text-sm font-bold text-foreground" href={`${basePath}/sign-in`}>
            Sign in
          </a>
        </div>
        <p className="mt-6 font-data text-xs text-muted-foreground">PAPER DEFAULT · NO LIVE TRADING</p>
      </section>
    </main>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/user-portal" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function UserPortal() {
  return (
    <>
      <Show when="signed-in"><Home /></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }), [addListener]);
  return null;
}

function ClerkShell() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to access your terminal" } },
        signUp: { start: { title: "Create your account", subtitle: "Start with safe paper trading" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  return (
    <WouterRouter base={basePath}>
      <ClerkShell />
    </WouterRouter>
  );
}

export default App;
