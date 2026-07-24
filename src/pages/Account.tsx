import { Link } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/components/Loading";
import useAuth from "@/hooks/useAuth";

export default function Account() {
  const { isLoading, error, user, handleLogout } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <User className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Account</h1>
              <p className="text-sm text-slate-400">Your profile</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="bg-slate-800 border border-slate-700 text-white hover:bg-slate-600 rounded shadow-sm"
            >
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-slate-800 border border-slate-700 text-white hover:bg-slate-600 rounded shadow-sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <User className="h-5 w-5 mr-2 text-emerald-400" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-slate-200">
              <div>
                <dt className="text-sm text-slate-400">Email</dt>
                <dd className="font-medium">{user?.email ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
