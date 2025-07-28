import {
  type AuthError,
  createClient,
  Session,
  User,
} from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function useAuth() {
  const [error, setError] = useState<AuthError | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoading(false);
      setSession(session);
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (
    username: string,
    password: string
  ): Promise<void> => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });
    setError(error);
    setUser(data.user);
    setSession(data.session);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return {
    handleLogin,
    handleLogout,
    isLoading,
    session,
    user,
    error,
  };
}
