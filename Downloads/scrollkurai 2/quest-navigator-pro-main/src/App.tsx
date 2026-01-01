import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/Layout/AppLayout";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { usePaymentProofNotifications } from "@/hooks/usePaymentProofNotifications";
import Dashboard from "./pages/Dashboard";
import LeaderboardPage from "./pages/LeaderboardPage";
import LeaguesPage from "./pages/LeaguesPage";
import CalendarPage from "./pages/CalendarPage";
import CommunityPage from "./pages/CommunityPage";
import ChallengesPage from "./pages/ChallengesPage";
import CompetePage from "./pages/CompetePage";
import FriendsPage from "./pages/FriendsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import ProfilePage from "./pages/ProfilePage";
import PersonalizationPage from "./pages/PersonalizationPage";
import InsightsPage from "./pages/InsightsPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";
import TeamsPage from "./pages/Teams/TeamsPage";
import PremiumPage from "./pages/Premium/PremiumPage";
import PowerUpsPage from "./pages/PowerUps/PowerUpsPage";
import CoursesPage from "./pages/Premium/CoursesPage";
import ChatbotPage from "./pages/Premium/ChatbotPage";
import CounsellingRequestPage from "./pages/Premium/CounsellingRequestPage";
import PaymentHistoryPage from "./pages/PaymentHistoryPage";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import { AdminRouteGuard } from "./components/Admin/AdminRouteGuard";
import GeminiPlaygroundPage from "./pages/GeminiPlaygroundPage";

/**
 * Main App component
 * Note: BrowserRouter is already provided in main.tsx
 * All React providers are at the root level to prevent context errors
 */
const App = () => {
  // Enable payment proof notifications
  usePaymentProofNotifications();

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/compete" element={<CompetePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/leagues" element={<LeaguesPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/personalization" element={<PersonalizationPage />} />
        <Route path="/insights" element={isFeatureEnabled("enable_analytics_dashboard") ? <InsightsPage /> : <Navigate to="/" replace />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/teams" element={isFeatureEnabled("enable_team_challenges") ? <TeamsPage /> : <Navigate to="/" replace />} />
        <Route path="/premium" element={isFeatureEnabled("enable_premium_tier") ? <PremiumPage /> : <Navigate to="/" replace />} />
        <Route path="/power-ups" element={isFeatureEnabled("enable_power_ups") ? <PowerUpsPage /> : <Navigate to="/" replace />} />
        <Route path="/premium/courses" element={isFeatureEnabled("enable_premium_expansion") ? <CoursesPage /> : <Navigate to="/" replace />} />
        <Route path="/premium/chatbot" element={isFeatureEnabled("enable_premium_expansion") ? <ChatbotPage /> : <Navigate to="/" replace />} />
        <Route path="/premium/counselling" element={isFeatureEnabled("enable_premium_expansion") ? <CounsellingRequestPage /> : <Navigate to="/" replace />} />
        <Route path="/payment-history" element={<PaymentHistoryPage />} />
        <Route path="/admin" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
        <Route path="/gemini" element={<GeminiPlaygroundPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
