import { type AuthError, createClient, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function useAuth() {
  const session: Session | null = null;

  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    // Check Supabase session
    const session = supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    });
    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session);
      }
    );
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogin = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });
    if (!error) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  return {
    handleLogin,
    handleLogout,
    isLoading,
    session,
    error,
    isAuthenticated,
  };
}
