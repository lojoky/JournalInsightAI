import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";


const notionConfigSchema = z.object({
  notionIntegrationSecret: z.string().min(1, "Integration secret is required"),
  notionPageUrl: z.string().url("Please enter a valid Notion page URL"),
});

type NotionConfigForm = z.infer<typeof notionConfigSchema>;

interface NotionConfigDialogProps {
  children: React.ReactNode;
}

export default function NotionConfigDialog({ children }: NotionConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<NotionConfigForm>({
    resolver: zodResolver(notionConfigSchema),
    defaultValues: {
      notionIntegrationSecret: "",
      notionPageUrl: "",
    },
  });

  const updateNotionSettings = useMutation({
    mutationFn: async (data: NotionConfigForm) => {
      // Get Firebase auth token if available
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Check if we have a Firebase user and get the auth token
      try {
        const user = auth.currentUser;
        if (user) {
          const token = await user.getIdToken();
          headers.Authorization = `Bearer ${token}`;
          console.log('Adding Firebase auth token to request');
        } else {
          console.log('No Firebase user found, using session auth');
        }
      } catch (authError) {
        console.error('Auth token error:', authError);
      }

      console.log('Making request to /api/user/notion-settings with headers:', headers);
      console.log('Request body:', data);

      const response = await fetch("/api/user/notion-settings", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || "Failed to update Notion settings");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notion integration configured successfully. Your journal entries will now sync to Notion.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to configure Notion integration. Please check your credentials and try again.",
        variant: "destructive",
      });
      console.error("Notion configuration error:", error);
    },
  });

  const onSubmit = (data: NotionConfigForm) => {
    updateNotionSettings.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Notion Integration</DialogTitle>
          <DialogDescription>
            Connect your Notion workspace to automatically sync journal entries.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="notionIntegrationSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Integration Secret</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="secret_..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your Notion integration token from{" "}
                    <a
                      href="https://www.notion.so/my-integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      notion.so/my-integrations
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notionPageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://notion.so/your-page-url"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    URL of the Notion page where journal entries should be stored.
                    Make sure to share this page with your integration.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-amber-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-amber-900 mb-2">Setup Steps:</h4>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Create an integration at notion.so/my-integrations</li>
                <li>Copy the "Internal Integration Token"</li>
                <li>Share a Notion page with your integration</li>
                <li>Copy the page URL and paste it above</li>
              </ol>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateNotionSettings.isPending}
              >
                {updateNotionSettings.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}