import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { mcpServersApi, type McpServerWithCount } from "../api/mcp-servers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plug2, Plus, Pencil, Trash2, Terminal, Globe, Users, Chrome, Square } from "lucide-react";
import { cn } from "../lib/utils";

const transportLabels: Record<string, string> = {
  stdio: "Command (stdio)",
  http: "HTTP",
  sse: "SSE",
  "managed-sse": "Managed SSE",
};

const transportIcons: Record<string, typeof Terminal> = {
  stdio: Terminal,
  http: Globe,
  sse: Globe,
  "managed-sse": Terminal,
};

function McpServerForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: McpServerWithCount | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [transport, setTransport] = useState<"stdio" | "http" | "sse" | "managed-sse">(initial?.transport as "stdio" | "http" | "sse" | "managed-sse" ?? "stdio");
  const [command, setCommand] = useState(initial?.command ?? "");
  const [argsStr, setArgsStr] = useState((initial?.args ?? []).join(" "));
  const [url, setUrl] = useState(initial?.url ?? "");
  const [envStr, setEnvStr] = useState(
    initial?.env ? Object.entries(initial.env).map(([k, v]) => `${k}=${v}`).join("\n") : "",
  );

  const autoSlug = !initial;

  function handleNameChange(v: string) {
    setName(v);
    if (autoSlug) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const args = argsStr.trim() ? argsStr.trim().split(/\s+/) : null;
    const env: Record<string, string> = {};
    for (const line of envStr.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    onSubmit({
      name,
      slug,
      description: description || null,
      transport,
      command: transport === "stdio" || transport === "managed-sse" ? command : null,
      args: transport === "stdio" || transport === "managed-sse" ? args : null,
      url: transport === "http" || transport === "sse" ? url : null,
      env: Object.keys(env).length > 0 ? env : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Slug</label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="^[a-z0-9]([a-z0-9-]*[a-z0-9])?$"
            required
            disabled={!!initial}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Transport</label>
        <Select value={transport} onValueChange={(v) => setTransport(v as "stdio" | "http" | "sse" | "managed-sse")} disabled={!!initial}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">Command (stdio)</SelectItem>
            <SelectItem value="http">HTTP</SelectItem>
            <SelectItem value="sse">SSE</SelectItem>
            <SelectItem value="managed-sse">Managed SSE</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {transport === "stdio" || transport === "managed-sse" ? (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Command</label>
            <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Arguments (space-separated)</label>
            <Input value={argsStr} onChange={(e) => setArgsStr(e.target.value)} placeholder="-y @playwright/mcp@latest" />
          </div>
          {transport === "managed-sse" && (
            <p className="text-xs text-muted-foreground">
              The server will start this command as an SSE server on a dynamic port and connect via HTTP. Use this when stdio transport fails (e.g. Playwright MCP).
            </p>
          )}
        </>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted-foreground">URL</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required />
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Environment Variables (KEY=value, one per line)</label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
          value={envStr}
          onChange={(e) => setEnvStr(e.target.value)}
          placeholder={"API_KEY=abc123\nANOTHER_VAR=value"}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending || !name || !slug}>
          {initial ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}

export function McpServers() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McpServerWithCount | null>(null);

  const { data: servers, isLoading } = useQuery({
    queryKey: queryKeys.mcpServers.list(selectedCompanyId!),
    queryFn: () => mcpServersApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: cdpStatus } = useQuery({
    queryKey: queryKeys.mcpServers.cdpChromeStatus,
    queryFn: () => mcpServersApi.cdpChromeStatus(),
    refetchInterval: 5000,
  });

  const launchCdpMutation = useMutation({
    mutationFn: () => mcpServersApi.launchCdpChrome(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.cdpChromeStatus }),
  });

  const stopCdpMutation = useMutation({
    mutationFn: () => mcpServersApi.stopCdpChrome(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.cdpChromeStatus }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mcpServersApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      mcpServersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) });
      setEditing(null);
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mcpServersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) });
    },
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(server: McpServerWithCount) {
    setEditing(server);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Servers</h2>
          <p className="text-sm text-muted-foreground">
            Configure external tool servers that agents can connect to
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add MCP Server
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !servers?.length ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Plug2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No MCP servers configured yet</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            Add your first MCP server
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const Icon = transportIcons[server.transport] ?? Plug2;
            return (
              <div
                key={server.id}
                className={cn(
                  "rounded-lg border border-border bg-card p-4 space-y-2",
                  server.status === "disabled" && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 h-8 w-8 rounded-md bg-accent flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{server.name}</span>
                        {server.builtin && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                            Built-in
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{transportLabels[server.transport]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon-xs" onClick={() => openEdit(server)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {!server.builtin && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          if (confirm(`Delete "${server.name}"? This will remove it from all agents.`))
                            deleteMutation.mutate(server.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {server.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{server.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{server.assignedAgentCount} agent{server.assignedAgentCount !== 1 ? "s" : ""}</span>
                  {server.status === "disabled" && (
                    <span className="ml-auto text-yellow-600 dark:text-yellow-400 text-[10px] font-medium">Disabled</span>
                  )}
                </div>
                {server.slug === "playwright-browser-cdp" && (
                  <div className="pt-1 border-t border-border/60">
                    {cdpStatus?.running ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Chrome running on port {cdpStatus.port}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => stopCdpMutation.mutate()}
                          disabled={stopCdpMutation.isPending}
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        onClick={() => launchCdpMutation.mutate()}
                        disabled={launchCdpMutation.isPending}
                      >
                        <Chrome className="h-3 w-3 mr-1" />
                        {launchCdpMutation.isPending ? "Launching..." : "Launch Chrome for login"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit MCP Server" : "Add MCP Server"}</DialogTitle>
          </DialogHeader>
          <McpServerForm
            initial={editing}
            onSubmit={(data) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
