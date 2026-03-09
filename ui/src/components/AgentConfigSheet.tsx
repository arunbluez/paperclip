import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mcpServersApi } from "../api/mcp-servers";
import { skillsApi } from "../api/skills";
import { queryKeys } from "../lib/queryKeys";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Plug2, Sparkles, X, Plus, PenLine, FileUp } from "lucide-react";
import type { SkillCatalogEntry, CustomSkill } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";

interface AgentConfigSheetProps {
  agentId: string;
  companyId: string;
  initialTab: "mcp" | "skills";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentConfigSheet({
  agentId,
  companyId,
  initialTab,
  open,
  onOpenChange,
}: AgentConfigSheetProps) {
  const [tab, setTab] = useState<"mcp" | "skills">(initialTab);
  const queryClient = useQueryClient();

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // MCP queries
  const { data: agentMcpServers } = useQuery({
    queryKey: queryKeys.mcpServers.forAgent(agentId),
    queryFn: () => mcpServersApi.listForAgent(agentId),
    enabled: open,
  });

  const { data: companyMcpServers } = useQuery({
    queryKey: queryKeys.mcpServers.list(companyId),
    queryFn: () => mcpServersApi.list(companyId),
    enabled: open,
  });

  const assignMcp = useMutation({
    mutationFn: (mcpServerId: string) => mcpServersApi.assignToAgent(agentId, mcpServerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.forAgent(agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.agentCounts(companyId) });
    },
  });

  const removeMcp = useMutation({
    mutationFn: (mcpServerId: string) => mcpServersApi.removeFromAgent(agentId, mcpServerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.forAgent(agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.agentCounts(companyId) });
    },
  });

  // Skills queries
  const { data: agentSkills } = useQuery({
    queryKey: queryKeys.skills.forAgent(agentId),
    queryFn: () => skillsApi.listForAgent(agentId),
    enabled: open,
  });

  const { data: skillCatalog } = useQuery({
    queryKey: queryKeys.skills.catalog,
    queryFn: () => skillsApi.catalog(),
    enabled: open,
  });

  const { data: customSkills } = useQuery({
    queryKey: queryKeys.skills.custom(companyId),
    queryFn: () => skillsApi.listCustom(companyId),
    enabled: open,
  });

  const [skillSearch, setSkillSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", description: "", category: "", skillMdContent: "", fileName: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      // Parse frontmatter-style metadata from top of file
      const meta: Record<string, string> = {};
      const lines = content.split("\n");
      for (const line of lines) {
        const match = line.match(/^(\w[\w\s]*?):\s*(.+)$/);
        if (match) {
          meta[match[1].trim().toLowerCase()] = match[2].trim();
        } else if (line.trim() === "" || line.startsWith("---")) {
          continue;
        } else {
          break;
        }
      }
      setCustomForm((f) => ({
        ...f,
        skillMdContent: content,
        fileName: file.name,
        name: meta.name || f.name,
        description: meta.description || f.description,
        category: meta.category || f.category,
      }));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (!open) {
      setSkillSearch("");
      setSelectedCategory(null);
      setShowCreateCustom(false);
      setCustomForm({ name: "", description: "", category: "", skillMdContent: "", fileName: "" });
    }
  }, [open]);

  const assignSkill = useMutation({
    mutationFn: (entry: SkillCatalogEntry) =>
      skillsApi.assignToAgent(agentId, {
        skillSlug: entry.slug,
        skillName: entry.name,
        skillDescription: entry.description,
        skillCategory: entry.category,
        sourceUrl: entry.sourceUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.forAgent(agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.forCompany(companyId) });
    },
  });

  const assignCustomSkill = useMutation({
    mutationFn: (cs: CustomSkill) =>
      skillsApi.assignToAgent(agentId, {
        skillSlug: cs.slug,
        skillName: cs.name,
        skillDescription: cs.description,
        skillCategory: cs.category ?? "Custom",
        sourceUrl: `custom://${cs.id}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.forAgent(agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.forCompany(companyId) });
    },
  });

  const removeSkill = useMutation({
    mutationFn: (skillSlug: string) => skillsApi.removeFromAgent(agentId, skillSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.forAgent(agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.forCompany(companyId) });
    },
  });

  const createCustom = useMutation({
    mutationFn: () =>
      skillsApi.createCustom(companyId, {
        name: customForm.name,
        description: customForm.description || null,
        category: customForm.category || null,
        skillMdContent: customForm.skillMdContent || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.custom(companyId) });
      setShowCreateCustom(false);
      setCustomForm({ name: "", description: "", category: "", skillMdContent: "", fileName: "" });
    },
  });

  const deleteCustom = useMutation({
    mutationFn: (id: string) => skillsApi.removeCustom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.custom(companyId) });
    },
  });

  // Extract unique categories from catalog + custom skills
  const categories = useMemo(() => {
    const cats = new Set<string>();
    (skillCatalog ?? []).forEach((s) => { if (s.category) cats.add(s.category); });
    (customSkills ?? []).forEach((s) => { if (s.category) cats.add(s.category); });
    cats.add("Custom");
    return Array.from(cats).sort();
  }, [skillCatalog, customSkills]);

  const mcpCount = agentMcpServers?.length ?? 0;
  const skillCount = agentSkills?.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 sm:max-w-md flex flex-col" onWheel={(e) => e.stopPropagation()}>
        <SheetHeader>
          <SheetTitle>Agent Configuration</SheetTitle>
          <SheetDescription>Manage MCP servers and skills</SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-border px-4">
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === "mcp"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("mcp")}
          >
            <Plug2 className="h-3.5 w-3.5" />
            MCP Servers
            {mcpCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent text-[10px]">{mcpCount}</span>
            )}
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === "skills"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("skills")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Skills
            {skillCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent text-[10px]">{skillCount}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
          {tab === "mcp" && (
            <>
              {mcpCount === 0 && (
                <p className="text-xs text-muted-foreground">No MCP servers assigned.</p>
              )}
              {(agentMcpServers ?? []).map((a) => (
                <div key={a.mcpServerId} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium truncate">
                    <Plug2 className="h-3 w-3 shrink-0" />
                    {a.mcpServer?.name ?? "MCP Server"}
                  </span>
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => removeMcp.mutate(a.mcpServerId)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {(() => {
                const assignedIds = new Set((agentMcpServers ?? []).map((a) => a.mcpServerId));
                const available = (companyMcpServers ?? []).filter((s) => !assignedIds.has(s.id) && s.status === "active");
                if (available.length === 0) return null;
                return (
                  <div className="space-y-1 pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Available</p>
                    {available.map((server) => (
                      <button
                        key={server.id}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                        onClick={() => assignMcp.mutate(server.id)}
                      >
                        <Plus className="h-3 w-3 shrink-0" />
                        {server.name}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {tab === "skills" && (
            <>
              {/* Assigned skills */}
              {skillCount === 0 && (
                <p className="text-xs text-muted-foreground">No skills assigned.</p>
              )}
              {(agentSkills ?? []).map((skill) => (
                <div key={skill.skillSlug} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-medium truncate">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      {skill.skillName}
                    </span>
                    {skill.skillCategory && (
                      <span className="text-[10px] text-muted-foreground ml-4">{skill.skillCategory}</span>
                    )}
                  </div>
                  <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeSkill.mutate(skill.skillSlug)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Create custom skill inline form */}
              {showCreateCustom ? (
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">New Custom Skill</p>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {/* File picker button */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-4 w-4 shrink-0" />
                    {customForm.fileName ? (
                      <span className="truncate font-medium text-foreground">{customForm.fileName}</span>
                    ) : (
                      <span>Select a .md file from your computer</span>
                    )}
                  </button>

                  {customForm.skillMdContent && (
                    <p className="text-[10px] text-muted-foreground">
                      {Math.round(customForm.skillMdContent.length / 1024)}KB loaded
                    </p>
                  )}

                  <Input
                    placeholder="Skill name *"
                    value={customForm.name}
                    onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-7 text-xs"
                  />
                  <Input
                    placeholder="Category (optional)"
                    value={customForm.category}
                    onChange={(e) => setCustomForm((f) => ({ ...f, category: e.target.value }))}
                    className="h-7 text-xs"
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={customForm.description}
                    onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
                    className="h-7 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-6 text-xs px-3"
                      disabled={!customForm.name.trim() || !customForm.skillMdContent || createCustom.isPending}
                      onClick={() => createCustom.mutate()}
                    >
                      {createCustom.isPending ? "Creating..." : "Create"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-3"
                      onClick={() => {
                        setShowCreateCustom(false);
                        setCustomForm({ name: "", description: "", category: "", skillMdContent: "", fileName: "" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowCreateCustom(true)}
                >
                  <PenLine className="h-3 w-3" />
                  Create custom skill
                </button>
              )}

              {/* Custom skills (company-level) */}
              {(customSkills ?? []).length > 0 && (
                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Company Custom Skills</p>
                  {(() => {
                    const assignedSlugs = new Set((agentSkills ?? []).map((s) => s.skillSlug));
                    return (customSkills ?? []).map((cs) => (
                      <div key={cs.id} className="flex items-center justify-between gap-1">
                        <button
                          className="flex flex-col items-start flex-1 min-w-0 px-2 py-1.5 text-xs rounded hover:bg-accent/50 disabled:opacity-50"
                          disabled={assignedSlugs.has(cs.slug)}
                          onClick={() => assignCustomSkill.mutate(cs)}
                        >
                          <span className="flex items-center gap-1 font-medium">
                            {assignedSlugs.has(cs.slug) ? (
                              <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
                            ) : (
                              <Plus className="h-3 w-3 shrink-0" />
                            )}
                            {cs.name}
                          </span>
                          {cs.description && (
                            <span className="text-[10px] text-muted-foreground ml-4 line-clamp-1">{cs.description}</span>
                          )}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                          title="Delete custom skill"
                          onClick={() => deleteCustom.mutate(cs.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Search & category filter + catalog */}
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Skill Catalog</p>
                <Input
                  placeholder="Search skills catalog..."
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  className="h-7 text-xs"
                />

                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                        selectedCategory === null
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                      }`}
                      onClick={() => setSelectedCategory(null)}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                          selectedCategory === cat
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                        }`}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-0.5">
                  {(() => {
                    const assignedSlugs = new Set((agentSkills ?? []).map((s) => s.skillSlug));
                    const q = skillSearch.toLowerCase();
                    const filtered = (skillCatalog ?? []).filter(
                      (s) => !assignedSlugs.has(s.slug) &&
                        (!selectedCategory || s.category === selectedCategory) &&
                        (!q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
                    );
                    if (skillCatalog && skillCatalog.length === 0) {
                      return <p className="px-2 py-1.5 text-xs text-muted-foreground">Catalog is empty</p>;
                    }
                    if (!skillCatalog) {
                      return <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading catalog...</p>;
                    }
                    if (filtered.length === 0) {
                      return <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching skills</p>;
                    }

                    // Group by category
                    const grouped = new Map<string, SkillCatalogEntry[]>();
                    for (const entry of filtered) {
                      const cat = entry.category || "Other";
                      if (!grouped.has(cat)) grouped.set(cat, []);
                      grouped.get(cat)!.push(entry);
                    }

                    return (
                      <>
                        {!q && !selectedCategory && (
                          <p className="px-2 py-1 text-[10px] text-muted-foreground">
                            {filtered.length} skills available
                          </p>
                        )}
                        {Array.from(grouped.entries()).map(([category, entries]) => (
                          <div key={category}>
                            {!selectedCategory && (
                              <p className="px-2 pt-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium sticky top-0 bg-background">
                                {category}
                              </p>
                            )}
                            {entries.map((entry) => (
                              <button
                                key={entry.slug}
                                className="flex flex-col items-start w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                                onClick={() => assignSkill.mutate(entry)}
                              >
                                <span className="flex items-center gap-1 font-medium">
                                  <Plus className="h-3 w-3 shrink-0" />
                                  {entry.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-4 line-clamp-1">{entry.description}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
