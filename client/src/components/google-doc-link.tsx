import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

interface GoogleDocLinkProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  showIcon?: boolean;
}

export default function GoogleDocLink({ 
  variant = "outline", 
  size = "sm", 
  className = "",
  showIcon = true 
}: GoogleDocLinkProps) {
  const { data: googleDocsConfig, isLoading } = useQuery<{
    enabled: boolean;
    configured: boolean;
    config?: {
      folderName: string;
      documentUrl?: string;
    };
  }>({
    queryKey: ['/api/integrations/google-docs'],
  });

  // Don't render if Google Docs is not enabled or configured
  if (isLoading || !googleDocsConfig?.enabled || !googleDocsConfig?.config?.documentUrl) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      asChild
      className={`flex items-center gap-2 ${className}`}
    >
      <a
        href={googleDocsConfig.config?.documentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2"
      >
        {showIcon && <FileText className="h-4 w-4" />}
        View Google Doc
        <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}