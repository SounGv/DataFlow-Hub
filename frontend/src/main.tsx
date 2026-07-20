import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import './index.css';
import AfterSales from './pages/AfterSales';
import Analytics from './pages/Analytics';
import AuditLogs from './pages/AuditLogs';
import CustomerChat from './pages/CustomerChat';
import CustomerProfile from './pages/CustomerProfile';
import CustomerVoice from './pages/CustomerVoice';
import DataSources from './pages/DataSources';
import KnowledgeBase from './pages/KnowledgeBase';
import Login from './pages/Login';
import Overview from './pages/Overview';
import PrintCenter from './pages/PrintCenter';
import ReportCenter from './pages/ReportCenter';
import ProductService from './pages/ProductService';
import SalesPerformance from './pages/SalesPerformance';
import Settings from './pages/Settings';
import Shipments from './pages/Shipments';
import SpareParts from './pages/SpareParts';
import SyncMonitor from './pages/SyncMonitor';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <Overview /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'reports', element: <ReportCenter /> },
      { path: 'customer-chat', element: <CustomerChat /> },
      { path: 'sales', element: <SalesPerformance /> },
      { path: 'after-sales', element: <AfterSales /> },
      { path: 'shipments', element: <Shipments /> },
      { path: 'customer-voice', element: <CustomerVoice /> },
      { path: 'product-service', element: <ProductService /> },
      { path: 'spare-parts', element: <SpareParts /> },
      { path: 'knowledge-base', element: <KnowledgeBase /> },
      { path: 'data-sources', element: <DataSources /> },
      { path: 'sync-monitor', element: <SyncMonitor /> },
      { path: 'audit-logs', element: <AuditLogs /> },
      { path: 'settings', element: <Settings /> },
      { path: 'print-center', element: <PrintCenter /> },
      { path: 'customers/:id', element: <CustomerProfile /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
