import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarkets } from "../hooks";
import getKalshiURL from "@/utils/getKalshiURL";
import Loading from "./Loading";

export const Markets = () => {
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, error } = useMarkets({
    status: status || undefined,
    category: category || undefined,
    limit,
    offset: page * limit,
  });

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  console.log(data.markets);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="settled">Settled</option>
            </select>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
            >
              <option value="">All Categories</option>
              <option value="politics">Politics</option>
              <option value="sports">Sports</option>
              <option value="entertainment">Entertainment</option>
              <option value="technology">Technology</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Markets List */}
      <div className="grid gap-4">
        {data?.markets.map(market => (
          <Card key={market.id} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <a
                    href={getKalshiURL(market.id, market.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <h3 className="text-lg font-semibold text-white">
                      {market.title}
                    </h3>
                  </a>
                  <p className="text-slate-400 text-sm">{market.question}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-slate-300">
                      {market.category}
                    </Badge>
                    <Badge
                      variant={
                        market.status === "active" ? "default" : "secondary"
                      }
                      className={
                        market.status === "active"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-slate-500/20 text-slate-400"
                      }
                    >
                      {market.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm text-slate-400">
                    Yes: {market.yesPrice}
                  </div>
                  <div className="text-sm text-slate-400">
                    No: {market.noPrice}
                  </div>
                  <div className="text-sm text-slate-400">
                    Volume: {market.volume.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {data && (
        <div className="flex justify-between items-center">
          <div className="text-slate-400">
            Showing {page * limit + 1} to{" "}
            {Math.min((page + 1) * limit, data.pagination.total)} of{" "}
            {data.pagination.total} markets
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="border-slate-600 text-slate-300"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!data.pagination.hasMore}
              className="border-slate-600 text-slate-300"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
