import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GenerateRFQ from './pages/GenerateRFQ';
import RfqConfirm from './pages/RfqConfirm';
import RfqDataCheck from './pages/RfqDataCheck';
import RunDetail from './pages/RunDetail';
import Runs from './pages/Runs';
import PromptsEditor from './pages/PromptsEditor';
import Users from './pages/Users';
import ProductFields from './pages/ProductFields';
import RfqRepository from './pages/RfqRepository';
import Approvals from './pages/Approvals';
import ApprovalTemplates from './pages/ApprovalTemplates';
import DocxTemplate from './pages/DocxTemplate';
import CompanyConfig from './pages/CompanyConfig';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: 'admin' | 'super_admin'; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin' && !['admin', 'super_admin'].includes(user.role)) return <Navigate to="/" replace />;
  if (role === 'super_admin' && user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<RfqRepository />} />
        <Route path="generate" element={<GenerateRFQ />} />
        <Route path="generate/confirm/:runId" element={<RfqConfirm />} />
        <Route path="generate/data/:runId" element={<RfqDataCheck />} />
        <Route path="runs" element={<Runs />} />
        <Route path="runs/:runId" element={<RunDetail />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="dashboard" element={<RequireRole role="admin"><Dashboard /></RequireRole>} />
        <Route path="prompts" element={<RequireRole role="admin"><PromptsEditor /></RequireRole>} />
        <Route path="users" element={<RequireRole role="super_admin"><Users /></RequireRole>} />
        <Route path="admin/products" element={<RequireRole role="admin"><ProductFields /></RequireRole>} />
        <Route path="admin/approval-templates" element={<RequireRole role="admin"><ApprovalTemplates /></RequireRole>} />
        <Route path="admin/docx-template" element={<RequireRole role="admin"><DocxTemplate /></RequireRole>} />
        <Route path="admin/company-config" element={<RequireRole role="admin"><CompanyConfig /></RequireRole>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
