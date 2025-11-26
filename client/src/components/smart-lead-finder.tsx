import { useState } from "react";
import { Search, Globe, Phone, Mail, Building2, Loader2, Import, ChevronDown, ChevronUp, Plus, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BusinessResult {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  source: string;
}

interface SearchResponse {
  keyword: string;
  location: string | null;
  results: BusinessResult[];
  totalResults?: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

interface ImportResponse {
  message: string;
  success: number;
  skipped: number;
  failed: number;
  errors: { name: string; error: string }[];
  duplicates: { name: string; reason: string }[];
  imported: any[];
}

interface SmartLeadFinderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BUSINESS_CATEGORIES = [
  "IT & Technology",
  "Marketing & Advertising",
  "Real Estate",
  "Healthcare",
  "Education",
  "Finance & Banking",
  "Construction",
  "Retail & E-commerce",
  "Hospitality & Tourism",
  "Manufacturing",
  "Professional Services",
  "Other",
];

export function SmartLeadFinder({ open, onOpenChange }: SmartLeadFinderProps) {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showImportOptions, setShowImportOptions] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (page: number) => {
      const response = await apiRequest("POST", "/api/leads/smart-finder/search", {
        keyword: keyword.trim(),
        location: location.trim() || undefined,
        page,
        perPage: 40,
        previousTotal: page > 1 ? totalResults : 0, // Send previous total for monotonic accumulator
      });
      return response as SearchResponse;
    },
    onSuccess: (data, page) => {
      if (page === 1) {
        setResults(data.results);
        setSelectedIds(new Set());
        setSearchKeyword(data.keyword);
        setSearchLocation(data.location || "");
      } else {
        setResults(prev => [...prev, ...data.results]);
      }
      
      setCurrentPage(data.page);
      setHasMore(data.hasMore);
      // DEFENSIVE: Ensure totalResults never decreases (double-check monotonic)
      setTotalResults(prev => Math.max(data.totalResults || data.results.length, prev));
      setShowResults(true);
      
      const categories = new Set(data.results.map(r => r.category || "Uncategorized"));
      setExpandedCategories(categories);
      
      if (page === 1) {
        toast({
          title: "Search Complete",
          description: `Found ${data.results.length} business${data.results.length !== 1 ? "es" : ""} for "${data.keyword}"`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search for businesses",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (selectedLeads: BusinessResult[]) => {
      const response = await apiRequest("POST", "/api/leads/smart-finder/import", {
        selectedLeads,
        defaultCategory: selectedCategory || undefined,
      });
      return response as ImportResponse;
    },
    onSuccess: (data) => {
      const parts = [];
      if (data.success > 0) parts.push(`✓ ${data.success} imported`);
      if (data.skipped > 0) parts.push(`⊘ ${data.skipped} duplicates`);
      if (data.failed > 0) parts.push(`✗ ${data.failed} failed`);
      
      toast({
        title: "Import Complete",
        description: parts.join(" • "),
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      
      if (data.success > 0) {
        const importedIds = data.imported.map((_, i) => Array.from(selectedIds)[i]);
        setSelectedIds(new Set(Array.from(selectedIds).filter(id => !importedIds.includes(id))));
        
        if (data.duplicates.length > 0 || data.errors.length > 0) {
          setShowImportOptions(false);
        } else {
          onOpenChange(false);
          handleReset();
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import leads",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!keyword.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a search keyword",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(1);
  };

  const handleLoadMore = () => {
    searchMutation.mutate(currentPage + 1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(results.map((_, i) => i)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(index);
    } else {
      newSelected.delete(index);
    }
    setSelectedIds(newSelected);
  };

  const handleImport = () => {
    const selected = Array.from(selectedIds).map(i => results[i]);
    if (selected.length === 0) {
      toast({
        title: "Selection Error",
        description: "Please select at least one lead to import",
        variant: "destructive",
      });
      return;
    }
    setShowImportOptions(true);
  };

  const handleConfirmImport = () => {
    const selected = Array.from(selectedIds).map(i => results[i]);
    importMutation.mutate(selected);
  };

  const handleReset = () => {
    setKeyword("");
    setLocation("");
    setResults([]);
    setSelectedIds(new Set());
    setShowResults(false);
    setCurrentPage(1);
    setHasMore(false);
    setTotalResults(0);
    setSearchKeyword("");
    setSearchLocation("");
    setSelectedCategory("");
    setShowImportOptions(false);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const groupByCategory = () => {
    const grouped = new Map<string, { results: BusinessResult[]; indices: number[] }>();
    results.forEach((result, index) => {
      const category = result.category || "Uncategorized";
      if (!grouped.has(category)) {
        grouped.set(category, { results: [], indices: [] });
      }
      grouped.get(category)!.results.push(result);
      grouped.get(category)!.indices.push(index);
    });
    return grouped;
  };

  const allSelected = results.length > 0 && selectedIds.size === results.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < results.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Smart Lead Finder
          </DialogTitle>
          <DialogDescription>
            Search for businesses online and import them as leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Form */}
          <div className="flex gap-2">
            <Input
              data-testid="input-keyword"
              placeholder="e.g., IT Companies, Real Estate, Restaurants"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={searchMutation.isPending}
              className="flex-1"
            />
            <Input
              data-testid="input-location"
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={searchMutation.isPending}
              className="w-64"
            />
            <Button
              data-testid="button-search"
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              variant="default"
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {/* Results Section */}
          {showResults && (
            <>
              {/* Summary Header */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium" data-testid="text-result-count">
                    Found {totalResults} result{totalResults !== 1 ? 's' : ''}
                  </span>
                  <span className="text-muted-foreground">
                    Showing {results.length} of {totalResults}
                  </span>
                  {selectedIds.size > 0 && (
                    <Badge variant="secondary" data-testid="text-selected-count">
                      {selectedIds.size} selected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <Button
                      data-testid="button-import-selected"
                      onClick={handleImport}
                      disabled={importMutation.isPending}
                      size="sm"
                    >
                      <Import className="h-4 w-4 mr-2" />
                      Import Selected ({selectedIds.size})
                    </Button>
                  )}
                </div>
              </div>

              {/* Import Options */}
              {showImportOptions && (
                <Card className="p-4 border-primary">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Import Options</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowImportOptions(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Default Category (optional)
                      </label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        If not specified, we'll use the category from the search results
                      </p>
                    </div>
                    <Button
                      data-testid="button-confirm-import"
                      onClick={handleConfirmImport}
                      disabled={importMutation.isPending}
                      className="w-full"
                    >
                      {importMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Confirm Import ({selectedIds.size} leads)
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Results Table */}
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          data-testid="checkbox-select-all"
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                          className={someSelected ? "opacity-50" : ""}
                        />
                      </TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => {
                      const hasEmail = !!result.email;
                      const hasPhone = !!result.phone;
                      const hasWebsite = !!result.website;
                      
                      return (
                        <TableRow key={index} data-testid={`row-result-${index}`}>
                          <TableCell>
                            <Checkbox
                              data-testid={`checkbox-select-${index}`}
                              checked={selectedIds.has(index)}
                              onCheckedChange={(checked) => handleSelectRow(index, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-name-${index}`}>
                            {result.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {hasEmail ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span data-testid={`text-email-${index}`}>{result.email}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                              {hasPhone ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <span data-testid={`text-phone-${index}`}>{result.phone}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {hasWebsite && result.website ? (
                              <a
                                href={result.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                                data-testid={`link-website-${index}`}
                              >
                                <Globe className="h-3 w-3" />
                                {(() => {
                                  try {
                                    const url = new URL(result.website.startsWith('http') ? result.website : `https://${result.website}`);
                                    return url.hostname;
                                  } catch {
                                    return result.website;
                                  }
                                })()}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`badge-category-${index}`}>
                              {result.category || "General"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {result.rating ? (
                              <div className="flex items-center justify-end gap-1" data-testid={`text-rating-${index}`}>
                                <span className="font-medium">{result.rating}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({result.reviews || 0})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    data-testid="button-load-more"
                    onClick={handleLoadMore}
                    disabled={searchMutation.isPending}
                    variant="outline"
                  >
                    {searchMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Load More Results
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!showResults && !searchMutation.isPending && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Search for Businesses</p>
              <p className="text-sm">
                Enter a keyword like "Construction companies USA" or "Digital marketing agencies Dubai"
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
