import { Navigate } from "react-router-dom";
import useAuth from "./hooks/useAuth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactElement;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
