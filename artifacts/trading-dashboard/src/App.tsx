import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Home         = lazy(() => import("@/pages/home"));
const Analytics    = lazy(() => import("@/pages/analytics"));
const SignalDetail = lazy(() => import("@/pages/signal-detail"));
const NotFound     = lazy(() => import("@/pages/not-found"));

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
        <Route path="/"            component={Home}         />
        <Route path="/analytics"   component={Analytics}    />
        <Route path="/signals/:id" component={SignalDetail} />
        <Route                     component={NotFound}     />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
