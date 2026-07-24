import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar from "@/components/AppSidebar";  // Now our horizontal top bar
// Remove this line if you're deleting TopNavbar
// import TopNavbar from "@/components/TopNavbar";

import InsightsDashboard from "@/pages/InsightsDashboard";
import ConversationsInbox from "@/pages/ConversationsInbox";
import ConversationLogsPage from "@/pages/ConversationLogsPage";
import CallLogsPage from "@/pages/CallLogsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import TemplateManager from "@/pages/TemplateManager";
import CampaignManager from "@/pages/CampaignManager";
import UserManagementPage from "@/pages/UserManagementPage";
import ContactsPage from "@/pages/ContactsPage";
import BillingPage from "@/pages/BillingPage";
import SettingsPage from "@/pages/SettingsPage";
import SmartFlowsPage from "@/pages/SmartFlowsPage";
import SmartFlowBuilderPage from "@/pages/SmartFlowBuilderPage";
import WhatsAppOnboardPage from "@/pages/WhatsAppOnboardPage";
import WhatsAppConnectPage from "@/pages/WhatsAppConnectPage";
import WhatsAppSignupLauncherPage from "@/pages/WhatsAppSignupLauncherPage";
import InstagramCallbackPage from "@/pages/InstagramCallbackPage";
import InstagramPagesCallbackPage from "@/pages/InstagramPagesCallbackPage";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import AcceptInvitationPage from "@/pages/AcceptInvitationPage";
import AgencyDashboard from "@/pages/Agency/AgencyDashboard";
import AgencyWorkspaces from "@/pages/Agency/AgencyWorkspaces";
import AgencyTeam from "@/pages/Agency/AgencyTeam";
import AgencyRoles from "@/pages/Agency/AgencyRoles";
import AgencyLogs from "@/pages/Agency/AgencyLogs";
import WorkspaceLogs from "@/pages/Agency/WorkspaceLogs";
import AgencyPlans from "@/pages/Agency/AgencyPlans";
import AgencyAPI from "@/pages/Agency/AgencyAPI";
import AgencyBillingPlans from "@/pages/Agency/AgencyBillingPlans";
import AgencyBillingManage from "@/pages/Agency/AgencyBillingManage";
import AgencyLegal from "@/pages/Agency/AgencyLegal";
import AgencyHelp from "@/pages/Agency/AgencyHelp";
import AgencyGeneralSettings from "@/pages/Agency/AgencyGeneralSettings";
import AgencyChangePassword from "@/pages/Agency/AgencyChangePassword";
import AgencyNotificationsSettings from "@/pages/Agency/AgencyNotificationsSettings";
import AgencyNotificationsPage from "@/pages/Agency/AgencyNotificationsPage";
import AgencyWhiteLabelSettings from "@/pages/Agency/AgencyWhiteLabelSettings";
import ProtectedRoute from "@/components/ProtectedRoute";
import AgencyLayout from "@/components/AgencyLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SiteProvider, useSite } from "@/contexts/SiteContext";
import GlobalBrandingFetcher from "@/components/GlobalBrandingFetcher";
import { I18nextProvider } from "react-i18next";
import i18n from "./lib/i18n";

function DashboardDispatcher({ siteType, isAgencyRoute }: { siteType: string; isAgencyRoute?: boolean }) {
  const userInfo = JSON.parse(localStorage.getItem("user_info") || "{}");
  const userRole = userInfo.role;
  
  if (userRole === "AGENCY" || userRole === "agency" || siteType === "AGENCY" || isAgencyRoute || window.location.host.startsWith("agency.")) {
    return <AgencyDashboard />;
  }
  return <InsightsDashboard />;
}

function Router({ siteType, isAgencyRoute }: { siteType: string; isAgencyRoute?: boolean }) {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/accept-invitation" component={AcceptInvitationPage} />

      <Route path="/">
        <ProtectedRoute>
          <DashboardDispatcher siteType={siteType} isAgencyRoute={isAgencyRoute} />
        </ProtectedRoute>
      </Route>

      <Route path="/insights">
        <ProtectedRoute><DashboardDispatcher siteType={siteType} isAgencyRoute={isAgencyRoute} /></ProtectedRoute>
      </Route>

      <Route path="/workspace">
        <Redirect to="/insights" />
      </Route>

      <Route path="/conversations/inbox">
        <ProtectedRoute permissions={["workspace.inbox.access"]}><ConversationsInbox /></ProtectedRoute>
      </Route>

      <Route path="/conversations/conversation-logs">
        <ProtectedRoute><ConversationLogsPage /></ProtectedRoute>
      </Route>
      <Route path="/conversations/call-logs">
        <ProtectedRoute><CallLogsPage /></ProtectedRoute>
      </Route>
      <Route path="/templates">
        <ProtectedRoute><TemplateManager /></ProtectedRoute>
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute permissions={["workspace.broadcast.view"]}><CampaignManager /></ProtectedRoute>
      </Route>
      <Route path="/contacts">
        <ProtectedRoute permissions={["workspace.company.view"]}><ContactsPage /></ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute><UserManagementPage /></ProtectedRoute>
      </Route>
      <Route path="/billing">
        <ProtectedRoute><BillingPage /></ProtectedRoute>
      </Route>
      <Route path="/settings/workspace/:section">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/settings/whatsapp-onboard">
        <ProtectedRoute><WhatsAppOnboardPage /></ProtectedRoute>
      </Route>
      <Route path="/settings/whatsapp-connect">
        <ProtectedRoute><WhatsAppConnectPage /></ProtectedRoute>
      </Route>
      {/* Self-hosted Embedded Signup launcher (replyagent "metaconnect" parity):
          Coex → /coexistence, Business API → /whatsapp. Runs the Meta dialog
          then redirects to /settings/whatsapp-onboard with the result hash. */}
      <Route path="/coexistence">
        <ProtectedRoute><WhatsAppSignupLauncherPage /></ProtectedRoute>
      </Route>
      <Route path="/whatsapp">
        <ProtectedRoute><WhatsAppSignupLauncherPage /></ProtectedRoute>
      </Route>
      <Route path="/instagram-callback">
        <ProtectedRoute><InstagramCallbackPage /></ProtectedRoute>
      </Route>
      <Route path="/instagram-pages">
        <ProtectedRoute><InstagramPagesCallbackPage /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute><NotificationsPage /></ProtectedRoute>
      </Route>
      <Route path="/automations/:id">
        <ProtectedRoute><SmartFlowBuilderPage /></ProtectedRoute>
      </Route>
      <Route path="/automations">
        <ProtectedRoute><SmartFlowsPage /></ProtectedRoute>
      </Route>

      <Route path="/agency/notifications">
        <ProtectedRoute permissions={["agency.*"]}><AgencyNotificationsPage /></ProtectedRoute>
      </Route>

      <Route path="/agency/settings/white-label">
        <ProtectedRoute permissions={["agency.*"]}><AgencyWhiteLabelSettings /></ProtectedRoute>
      </Route>

      <Route path="/agency/settings/notifications">
        <ProtectedRoute permissions={["agency.*"]}><AgencyNotificationsSettings /></ProtectedRoute>
      </Route>

      <Route path="/agency/settings/general">
        <ProtectedRoute permissions={["agency.settings.*"]}><AgencyGeneralSettings /></ProtectedRoute>
      </Route>

      <Route path="/agency/settings/change-password">
        <ProtectedRoute permissions={["agency.*"]}><AgencyChangePassword /></ProtectedRoute>
      </Route>

      <Route path="/agency/help">
        <ProtectedRoute permissions={["agency.*"]}><AgencyHelp /></ProtectedRoute>
      </Route>

      <Route path="/agency/legal">
        <ProtectedRoute permissions={["agency.legal.*"]}><AgencyLegal /></ProtectedRoute>
      </Route>

      <Route path="/agency/billing/plans">
        <ProtectedRoute permissions={["agency.*"]}><AgencyBillingPlans /></ProtectedRoute>
      </Route>
      <Route path="/agency/billing/manage">
        <ProtectedRoute permissions={["agency.*"]}><AgencyBillingManage /></ProtectedRoute>
      </Route>

      <Route path="/agency/saas/api">
        <ProtectedRoute permissions={["agency.*"]}><AgencyAPI /></ProtectedRoute>
      </Route>
      <Route path="/agency/saas/plans">
        <ProtectedRoute permissions={["agency.*"]}><AgencyPlans /></ProtectedRoute>
      </Route>

      <Route path="/agency/audit-logs/workspace">
        <ProtectedRoute permissions={["agency.*"]}><WorkspaceLogs /></ProtectedRoute>
      </Route>

      <Route path="/agency/audit-logs/agency">
        <ProtectedRoute permissions={["agency.*"]}><AgencyLogs /></ProtectedRoute>
      </Route>

      <Route path="/agency/roles">
        <ProtectedRoute permissions={["agency.acl.*"]}><AgencyRoles /></ProtectedRoute>
      </Route>

      <Route path="/agency/team">
        <ProtectedRoute permissions={["agency.users.*"]}><AgencyTeam /></ProtectedRoute>
      </Route>

      <Route path="/agency/workspaces">
        <ProtectedRoute permissions={["agency.workspace.*"]}><AgencyWorkspaces /></ProtectedRoute>
      </Route>

      <Route path="/agency">
        <ProtectedRoute><AgencyDashboard /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const checkAuthStatus = () => {
    const token = localStorage.getItem("auth_token");
    return !!token;
  };

  useEffect(() => {
    setIsLoggedIn(checkAuthStatus());
  }, [location]);

  const { siteData, loading } = useSite();

  const isBuilderRoute = location.startsWith("/automations/") && location.split("/").length === 3;
  const isAuthRoute = location === "/login" || location === "/forgot-password" || location === "/signup";
  const siteType = siteData?.app?.site_type || "WORKSPACE";

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading application...</div>;
  }

  const isAgencyRoute = location.startsWith("/agency");

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <GlobalBrandingFetcher />
          <TooltipProvider>
            {isAuthRoute ? (
              <Router siteType={siteType} isAgencyRoute={isAgencyRoute} />
            ) : (siteType === "AGENCY" || isAgencyRoute || window.location.host.startsWith("agency.")) ? (
              <AgencyLayout>
                <Router siteType={siteType} isAgencyRoute={isAgencyRoute} />
              </AgencyLayout>
            ) : (
              <div className="flex h-screen overflow-hidden bg-background">
                {/* New: Horizontal Top Bar (only shown when logged in) */}
                {isLoggedIn && !isBuilderRoute && <AppSidebar />}

                {/* Main content area - now full width, with top padding */}
                {/* Main content — leaves room for the floating rounded
                    header above (top-3 = 12px + h-16 = 64px + 8px card
                    gap ≈ 88px, so mt-[88px]). Only applied when the top
                    bar is visible (not on auth screens or the builder). */}
                <main className={`flex-1 overflow-auto bg-accent/30 ${isLoggedIn && !isBuilderRoute ? "mt-[88px]" : ""}`}>
                  <Router siteType={siteType} isAgencyRoute={isAgencyRoute} />
                </main>
              </div>
            )}

            {/* Global toast outlet — mounted once for ALL layouts (auth, agency,
                workspace) so toasts show everywhere. Previously it lived only in
                the workspace branch, so agency routes never rendered any toast. */}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <SiteProvider>
      <AppContent />
    </SiteProvider>
  );
}

export default App;