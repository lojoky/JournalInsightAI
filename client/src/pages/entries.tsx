import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, FileText, Tag, Download, ChevronLeft, ChevronRight, Edit, Trash2, Save, X, CheckSquare, Square } from "lucide-react";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import ExportDialog from "@/components/export-dialog";
// Google Docs integration removed - will be rebuilt
import type { JournalEntryWithDetails } from "@shared/schema";

export default function Entries() {
  const [page, setPage] = useState(1);
  const entriesPerPage = 20;
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allEntries, isLoading } = useQuery({
    queryKey: ['/api/journal-entries'],
    queryFn: async () => {
      const response = await fetch('/api/journal-entries?limit=200');
      return response.json() as Promise<JournalEntryWithDetails[]>;
    }
  });

  // Edit entry mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, transcribedText }: { id: number; transcribedText: string }) => {
      const response = await fetch(`/api/journal-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transcribedText }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry Updated",
        description: "Your journal entry has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
      setEditingEntry(null);
      setEditText("");
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Making DELETE request for entry ${id}`);
      const response = await fetch(`/api/journal-entries/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      console.log(`DELETE response status: ${response.status}`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`DELETE failed with error:`, error);
        throw new Error(error.message);
      }
      
      const result = await response.json();
      console.log(`DELETE success:`, result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Entry Deleted",
        description: "Your journal entry has been deleted successfully",
      });
      // Invalidate all journal entry queries to update both pages
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recent-entries'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/journal-entries/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entryIds: ids }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Entries Deleted",
        description: `Successfully deleted ${data.deletedCount} journal entries`,
      });
      setSelectedEntries(new Set());
      setIsSelectMode(false);
      // Invalidate all journal entry queries to update both pages
      queryClient.invalidateQueries({ queryKey: ['/api/journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recent-entries'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditStart = (entry: JournalEntryWithDetails) => {
    setEditingEntry(entry.id);
    setEditText(entry.transcribedText || "");
  };

  const handleEditSave = () => {
    if (editingEntry) {
      editMutation.mutate({ id: editingEntry, transcribedText: editText });
    }
  };

  const handleEditCancel = () => {
    setEditingEntry(null);
    setEditText("");
  };

  const handleDelete = (id: number) => {
    console.log(`Attempting to delete entry ${id}`);
    deleteMutation.mutate(id);
  };

  const handleSelectEntry = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedEntries);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedEntries(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(entries.map(entry => entry.id));
      setSelectedEntries(allIds);
    } else {
      setSelectedEntries(new Set());
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedEntries);
    bulkDeleteMutation.mutate(ids);
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedEntries(new Set());
  };

  const totalPages = Math.ceil((allEntries?.length || 0) / entriesPerPage);
  const startIndex = (page - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const entries = allEntries?.slice(startIndex, endIndex) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-[#111827]">Journal Entries</h1>
                <p className="text-sm text-gray-500">
                  {selectedEntries.size > 0 
                    ? `${selectedEntries.size} selected • ${allEntries?.length || 0} total entries`
                    : `${allEntries?.length || 0} total entries`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isSelectMode ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleSelectMode}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select
                  </Button>
                  <ExportDialog>
                    <Button className="bg-[#6366F1] hover:bg-indigo-700">
                      <Download className="w-4 h-4 mr-2" />
                      Export All
                    </Button>
                  </ExportDialog>
                </>
              ) : (
                <>
                  {selectedEntries.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={bulkDeleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete {selectedEntries.size}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Entries</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedEntries.size} journal entries? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleSelectMode}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Entries List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Select All/None when in select mode */}
        {isSelectMode && entries.length > 0 && (
          <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={entries.length > 0 && entries.every(entry => selectedEntries.has(entry.id))}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">
                Select all entries on this page ({entries.length})
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {selectedEntries.size} of {allEntries?.length || 0} total entries selected
            </div>
          </div>
        )}

        {!entries || entries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No entries yet</h3>
            <p className="text-gray-500 mb-6">Start by uploading your first journal image</p>
            <Link href="/">
              <Button>Upload First Entry</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {isSelectMode && (
                        <Checkbox
                          checked={selectedEntries.has(entry.id)}
                          onCheckedChange={(checked) => handleSelectEntry(entry.id, checked as boolean)}
                          className="mt-1"
                        />
                      )}
                      <div className="flex-1">
                        <Link href={`/entry/${entry.id}`} className="cursor-pointer">
                          <CardTitle className="text-lg hover:text-[#6366F1] transition-colors">{entry.title}</CardTitle>
                        </Link>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(entry.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={entry.processingStatus === 'completed' ? 'default' : 'secondary'}
                        className={entry.processingStatus === 'completed' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {entry.processingStatus}
                      </Badge>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {editingEntry === entry.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleEditSave}
                              disabled={editMutation.isPending}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleEditCancel}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditStart(entry);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this journal entry? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(entry.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingEntry === entry.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Edit your journal entry..."
                        className="min-h-[120px]"
                      />
                    </div>
                  ) : (
                    <>
                      {entry.transcribedText && (
                        <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                          {entry.transcribedText.substring(0, 200)}
                          {entry.transcribedText.length > 200 ? '...' : ''}
                        </p>
                      )}
                    </>
                  )}
                  
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-4 h-4 text-gray-400" />
                      {entry.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                      {entry.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{entry.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, allEntries?.length || 0)} of {allEntries?.length || 0} entries
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className={page === pageNum ? "bg-[#6366F1] hover:bg-indigo-700" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}