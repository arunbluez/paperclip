import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Paperclip, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IssueAttachment } from "@paperclipai/shared";

interface AssetsGridProps {
  attachments: IssueAttachment[];
  onUpload: () => void;
  onDelete: (id: string) => void;
  isUploading: boolean;
  error: string | null;
}

export function AssetsGrid({ attachments, onUpload, onDelete, isUploading, error }: AssetsGridProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const imageAttachments = attachments.filter((a) => a.contentType.startsWith("image/"));
  const nonImageAttachments = attachments.filter((a) => !a.contentType.startsWith("image/"));

  const navigateLightbox = useCallback(
    (direction: 1 | -1) => {
      if (lightboxIdx === null || imageAttachments.length === 0) return;
      setLightboxIdx((lightboxIdx + direction + imageAttachments.length) % imageAttachments.length);
    },
    [lightboxIdx, imageAttachments.length],
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateLightbox(-1);
      else if (e.key === "ArrowRight") navigateLightbox(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, navigateLightbox]);

  const currentImage = lightboxIdx !== null ? imageAttachments[lightboxIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {attachments.length === 0
            ? "No assets yet"
            : `${attachments.length} attachment${attachments.length !== 1 ? "s" : ""}`}
        </span>
        <Button variant="outline" size="sm" onClick={onUpload} disabled={isUploading}>
          <Paperclip className="h-3.5 w-3.5 mr-1.5" />
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {imageAttachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {imageAttachments.map((attachment, idx) => (
            <div
              key={attachment.id}
              className="group relative border border-border rounded-lg overflow-hidden cursor-pointer hover:border-foreground/20 transition-colors"
              onClick={() => setLightboxIdx(idx)}
            >
              <div className="aspect-square bg-accent/10">
                <img
                  src={attachment.contentPath}
                  alt={attachment.originalFilename ?? "attachment"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <p className="text-[11px] text-white truncate">
                  {attachment.originalFilename ?? attachment.id.slice(0, 12)}
                </p>
              </div>
              <button
                type="button"
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(attachment.id);
                }}
                title="Delete"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {nonImageAttachments.length > 0 && (
        <div className="space-y-1.5">
          {nonImageAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-2 border border-border rounded-md px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={attachment.contentPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs hover:underline truncate block"
                >
                  {attachment.originalFilename ?? attachment.id}
                </a>
                <p className="text-[11px] text-muted-foreground">
                  {attachment.contentType} · {(attachment.byteSize / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onDelete(attachment.id)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxIdx !== null} onOpenChange={(open) => !open && setLightboxIdx(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 gap-0 overflow-hidden bg-black/95 border-none [&>button]:text-white">
          {currentImage && (
            <div className="flex flex-col items-center justify-center min-h-0">
              <div className="relative flex items-center justify-center w-full flex-1 min-h-0 p-4">
                {imageAttachments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 z-10 text-white hover:bg-white/10"
                    onClick={() => navigateLightbox(-1)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                <img
                  src={currentImage.contentPath}
                  alt={currentImage.originalFilename ?? "attachment"}
                  className="max-h-[85vh] max-w-[90vw] object-contain"
                />
                {imageAttachments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 z-10 text-white hover:bg-white/10"
                    onClick={() => navigateLightbox(1)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
              <div className="px-4 py-2 text-center w-full border-t border-white/10">
                <p className="text-sm text-white/80 truncate">
                  {currentImage.originalFilename ?? currentImage.id.slice(0, 12)}
                </p>
                <p className="text-xs text-white/50">
                  {currentImage.contentType} · {(currentImage.byteSize / 1024).toFixed(1)} KB
                  {imageAttachments.length > 1 && ` · ${lightboxIdx! + 1} of ${imageAttachments.length}`}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
