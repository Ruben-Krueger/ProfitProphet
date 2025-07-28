import Loading from "@/components/Loading";
import useAuth from "@/hooks/useAuth";

export default function Account() {
  const { isLoading, error, user } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="min-h-screen justify-center items-center flex">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <main className="items-center flex justify-center min-h-screen">
      <div>
        <h1 className="text-4xl">Account</h1>
        <p className="text-lg">Email: {user?.email}</p>
      </div>
    </main>
  );
}
