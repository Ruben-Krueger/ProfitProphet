import { Navigate } from "react-router-dom";
import useAuth from "./hooks/useAuth";
import Loading from "./components/Loading";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactElement;
}) {
  const { session, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (session == null) return <Navigate to="/login" replace />;
  return children;
}
