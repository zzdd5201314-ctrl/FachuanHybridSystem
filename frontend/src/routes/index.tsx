import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { AuthGuard, GuestGuard } from './guards'
import { PATHS } from './paths'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { PublicLayout } from '@/layouts/PublicLayout'

const HomePage = lazy(() =>
  import('@/pages/public/HomePage').then((module) => ({ default: module.HomePage })),
)
const PricingPage = lazy(() =>
  import('@/pages/public/PricingPage').then((module) => ({ default: module.PricingPage })),
)
const TutorialPage = lazy(() =>
  import('@/pages/public/TutorialPage').then((module) => ({ default: module.TutorialPage })),
)

const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('@/pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })),
)

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))

const ClientListPage = lazy(() => import('@/pages/dashboard/clients/ClientListPage'))
const ClientNewPage = lazy(() => import('@/pages/dashboard/clients/ClientNewPage'))
const ClientDetailPage = lazy(() => import('@/pages/dashboard/clients/ClientDetailPage'))
const ClientEditPage = lazy(() => import('@/pages/dashboard/clients/ClientEditPage'))

const CaseListPage = lazy(() => import('@/pages/dashboard/cases/CaseListPage'))
const CaseNewPage = lazy(() => import('@/pages/dashboard/cases/CaseNewPage'))
const CaseDetailPage = lazy(() => import('@/pages/dashboard/cases/CaseDetailPage'))
const CaseEditPage = lazy(() => import('@/pages/dashboard/cases/CaseEditPage'))

const CaseLogCenterPage = lazy(() => import('@/pages/dashboard/logs/CaseLogCenterPage'))
const CaseLogBoardPage = lazy(() => import('@/pages/dashboard/logs/CaseLogBoardPage'))
const CaseLogCreatePage = lazy(() => import('@/pages/dashboard/logs/CaseLogCreatePage'))
const CaseLogEditPage = lazy(() => import('@/pages/dashboard/logs/CaseLogEditPage'))

const ContractListPage = lazy(() => import('@/pages/dashboard/contracts/ContractListPage'))
const ContractNewPage = lazy(() => import('@/pages/dashboard/contracts/ContractNewPage'))
const ContractDetailPage = lazy(() => import('@/pages/dashboard/contracts/ContractDetailPage'))
const ContractEditPage = lazy(() => import('@/pages/dashboard/contracts/ContractEditPage'))

const InboxListPage = lazy(() => import('@/pages/dashboard/inbox/InboxListPage'))
const InboxDetailPage = lazy(() => import('@/pages/dashboard/inbox/InboxDetailPage'))

const RemindersPage = lazy(() => import('@/pages/dashboard/reminders'))

const OrganizationPage = lazy(() => import('@/pages/dashboard/organization/OrganizationPage'))
const LawFirmNewPage = lazy(() => import('@/pages/dashboard/organization/lawfirms/LawFirmNewPage'))
const LawFirmDetailPage = lazy(() => import('@/pages/dashboard/organization/lawfirms/LawFirmDetailPage'))
const LawFirmEditPage = lazy(() => import('@/pages/dashboard/organization/lawfirms/LawFirmEditPage'))
const LawyerNewPage = lazy(() => import('@/pages/dashboard/organization/lawyers/LawyerNewPage'))
const LawyerDetailPage = lazy(() => import('@/pages/dashboard/organization/lawyers/LawyerDetailPage'))
const LawyerEditPage = lazy(() => import('@/pages/dashboard/organization/lawyers/LawyerEditPage'))

const AutomationIndexPage = lazy(() => import('@/pages/dashboard/automation/AutomationIndexPage'))
const QuoteListPage = lazy(() => import('@/pages/dashboard/automation/preservation-quotes/QuoteListPage'))
const QuoteDetailPage = lazy(() => import('@/pages/dashboard/automation/preservation-quotes/QuoteDetailPage'))
const RecognitionListPage = lazy(() => import('@/pages/dashboard/automation/document-recognition/RecognitionListPage'))
const RecognitionDetailPage = lazy(() => import('@/pages/dashboard/automation/document-recognition/RecognitionDetailPage'))

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: PATHS.HOME, element: <HomePage /> },
      { path: PATHS.PRICING, element: <PricingPage /> },
      { path: PATHS.TUTORIAL, element: <TutorialPage /> },
    ],
  },
  {
    element: <GuestGuard />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: PATHS.LOGIN, element: <LoginPage /> },
          { path: PATHS.REGISTER, element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <Navigate to={PATHS.ADMIN_DASHBOARD} replace /> },
          { path: PATHS.ADMIN_DASHBOARD, element: <DashboardPage /> },

          { path: PATHS.ADMIN_INBOX, element: <InboxListPage /> },
          { path: PATHS.ADMIN_INBOX_DETAIL, element: <InboxDetailPage /> },

          { path: PATHS.ADMIN_CLIENTS, element: <ClientListPage /> },
          { path: PATHS.ADMIN_CLIENT_NEW, element: <ClientNewPage /> },
          { path: PATHS.ADMIN_CLIENT_DETAIL, element: <ClientDetailPage /> },
          { path: PATHS.ADMIN_CLIENT_EDIT, element: <ClientEditPage /> },

          { path: PATHS.ADMIN_CASES, element: <CaseListPage /> },
          { path: PATHS.ADMIN_CASE_NEW, element: <CaseNewPage /> },
          { path: PATHS.ADMIN_CASE_DETAIL, element: <CaseDetailPage /> },
          { path: PATHS.ADMIN_CASE_EDIT, element: <CaseEditPage /> },

          { path: PATHS.ADMIN_LOGS, element: <CaseLogCenterPage /> },
          { path: PATHS.ADMIN_LOG_NEW, element: <CaseLogCreatePage /> },
          { path: PATHS.ADMIN_LOG_EDIT, element: <CaseLogEditPage /> },
          { path: PATHS.ADMIN_LOG_DETAIL, element: <CaseLogBoardPage /> },

          { path: PATHS.ADMIN_CONTRACTS, element: <ContractListPage /> },
          { path: PATHS.ADMIN_CONTRACT_NEW, element: <ContractNewPage /> },
          { path: PATHS.ADMIN_CONTRACT_DETAIL, element: <ContractDetailPage /> },
          { path: PATHS.ADMIN_CONTRACT_EDIT, element: <ContractEditPage /> },

          { path: PATHS.ADMIN_REMINDERS, element: <RemindersPage /> },

          { path: PATHS.ADMIN_ORGANIZATION, element: <OrganizationPage /> },
          { path: PATHS.ADMIN_LAWFIRMS, element: <OrganizationPage /> },
          { path: PATHS.ADMIN_LAWFIRM_NEW, element: <LawFirmNewPage /> },
          { path: PATHS.ADMIN_LAWFIRM_DETAIL, element: <LawFirmDetailPage /> },
          { path: PATHS.ADMIN_LAWFIRM_EDIT, element: <LawFirmEditPage /> },
          { path: PATHS.ADMIN_LAWYERS, element: <OrganizationPage /> },
          { path: PATHS.ADMIN_LAWYER_NEW, element: <LawyerNewPage /> },
          { path: PATHS.ADMIN_LAWYER_DETAIL, element: <LawyerDetailPage /> },
          { path: PATHS.ADMIN_LAWYER_EDIT, element: <LawyerEditPage /> },
          { path: PATHS.ADMIN_TEAMS, element: <OrganizationPage /> },
          { path: PATHS.ADMIN_CREDENTIALS, element: <OrganizationPage /> },

          { path: PATHS.ADMIN_AUTOMATION, element: <AutomationIndexPage /> },
          { path: PATHS.ADMIN_AUTOMATION_QUOTES, element: <QuoteListPage /> },
          { path: PATHS.ADMIN_AUTOMATION_QUOTE_DETAIL, element: <QuoteDetailPage /> },
          { path: PATHS.ADMIN_AUTOMATION_RECOGNITION, element: <RecognitionListPage /> },
          { path: PATHS.ADMIN_AUTOMATION_RECOGNITION_DETAIL, element: <RecognitionDetailPage /> },
        ],
      },
    ],
  },
])
