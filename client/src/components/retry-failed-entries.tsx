import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RetryResult {
  message: string;
  processedCount: number;
  failedCount: number;
  errors?: string[];
}

interface FailedCountResponse {
  count: number;
}

export default function RetryFailedEntries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get count of failed entries
  const { data: failedCount, isLoading: isLoadingCount } = useQuery<FailedCountResponse>({
    queryKey: ['/api/failed-entries-count'],
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (): Promise<RetryResult> => {
      const response = await fetch('/api/retry-failed-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry entries');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Retry Completed",
        description: `Processed ${result.processedCount} entries. ${result.failedCount} still failed.`,
      });
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/failed-entries-count'] });
    },
    onError: (error) => {
      toast({
        title: "Retry Failed",
        description: "Could not retry failed entries. Please try again.",
        variant: "destructive",
      });
      console.error("Retry error:", error);
    },
  });

  const handleRetry = () => {
    retryMutation.mutate();
  };

  if (isLoadingCount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Processing Status
          </CardTitle>
          <CardDescription>
            Checking for failed entries...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-4 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const count = failedCount?.count || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {count > 0 ? (
            <AlertCircle className="h-5 w-5 text-orange-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          Processing Status
        </CardTitle>
        <CardDescription>
          {count > 0 
            ? `${count} journal entries failed to process and need retry`
            : "All journal entries have been processed successfully"
          }
        </CardDescription>
      </CardHeader>
      
      {count > 0 && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Failed entries may be due to temporary processing issues or image quality problems.
            </div>
          </div>
          
          <Button 
            onClick={handleRetry}
            disabled={retryMutation.isPending}
            className="w-full"
          >
            {retryMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Failed Entries
              </>
            )}
          </Button>
          
          {retryMutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              Failed to retry entries. Please check your connection and try again.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}