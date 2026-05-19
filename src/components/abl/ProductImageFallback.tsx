import { Package, Utensils, Soup, Box, Coffee, ShoppingBag, Square, Sparkles } from "lucide-react";

const ICONS: Record<string, typeof Package> = {
  Containers: Box,
  Cutlery: Utensils,
  Bowls: Soup,
  Clamshells: Package,
  "Cups & Lids": Coffee,
  Bags: ShoppingBag,
  Napkins: Square,
  Cleaning: Sparkles,
};

export function ProductImageFallback({ sku, category, className = "" }: { sku: string; category: string; className?: string }) {
  const Icon = ICONS[category] ?? Package;
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-secondary to-background ${className}`}>
      <Icon className="h-12 w-12 text-primary/40" strokeWidth={1.5} />
      <span className="font-mono text-[11px] tracking-wider text-muted-foreground">{sku}</span>
    </div>
  );
}
