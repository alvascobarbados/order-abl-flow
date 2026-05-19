import { useRef, useState } from "react";
import { Upload, X, Star, Loader2 } from "lucide-react";
import { uploadProductImage } from "@/lib/products";
import { toast } from "sonner";

export function ProductImageManager({
  productIdHint,
  primary, secondary, onChange,
}: {
  productIdHint: string;
  primary: string | null;
  secondary: string[];
  onChange: (next: { primary: string | null; secondary: string[] }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          toast.error(`Skipped ${file.name}: must be JPG/PNG/WEBP`); continue;
        }
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`Skipped ${file.name}: max 2MB`); continue;
        }
        const url = await uploadProductImage(productIdHint, file);
        if (!primary) onChange({ primary: url, secondary });
        else onChange({ primary, secondary: [...secondary, url] });
      }
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const makePrimary = (url: string) => {
    const newSecondary = [...secondary.filter((u) => u !== url), ...(primary ? [primary] : [])];
    onChange({ primary: url, secondary: newSecondary });
  };

  const remove = (url: string) => {
    if (url === primary) {
      const next = secondary[0] ?? null;
      onChange({ primary: next, secondary: secondary.slice(1) });
    } else {
      onChange({ primary, secondary: secondary.filter((u) => u !== url) });
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-[#F8FAFC] transition hover:border-[#0B1A2E]/30"
      >
        {primary ? (
          <img src={primary} alt="Primary" className="h-full w-full object-contain p-3" />
        ) : (
          <div className="text-center">
            {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="mx-auto h-6 w-6 text-muted-foreground" />}
            <div className="mt-2 text-[12.5px] font-semibold text-ink">Drop image or click to upload</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Square · 600×600 min · JPG/PNG · 2MB max</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {(primary || secondary.length > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {[primary, ...secondary].filter((u): u is string => !!u).map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-white">
              <img src={url} alt="" className="h-full w-full object-contain p-1" />
              {url === primary && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-[#FF6A1A] px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <Star className="h-2.5 w-2.5 fill-white" /> Primary
                </span>
              )}
              <div className="absolute inset-0 hidden flex-col items-center justify-center gap-1 bg-black/50 group-hover:flex">
                {url !== primary && (
                  <button onClick={() => makePrimary(url)} className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-ink">
                    Make primary
                  </button>
                )}
                <button onClick={() => remove(url)} className="rounded bg-[#E11D48] px-2 py-0.5 text-[10px] font-semibold text-white">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
