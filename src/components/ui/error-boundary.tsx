import React, { Component, ReactNode } from "react";
import { formatError } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Alert, AlertDescription } from "./alert";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({ error }: { error: unknown }) {
  const { name, message } = formatError(this.state.error);
  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Uh-oh! Something went wrong
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">{name}</div>
            <div className="text-sm text-muted-foreground mt-1">{message}</div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
