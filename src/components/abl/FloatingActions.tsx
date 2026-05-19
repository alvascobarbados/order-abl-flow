import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";

export function FloatingActions() {
  const { count, toggle } = useCart();
  return (
    <div className="fixed bottom-5 right-4 z-30 flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label="Open cart"
        className="relative grid h-[52px] w-[52px] place-items-center rounded-full border border-[#E5E9EF] bg-white text-[#0F2540] shadow-[0_6px_20px_-6px_rgba(15,37,64,0.25)] transition hover:-translate-y-0.5"
      >
        <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[20px] min-w-[20px] place-items-center rounded-full bg-[#FF6A1A] px-1 text-[11px] font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      <a
        href="https://wa.me/12460000000"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_-6px_rgba(37,211,102,0.5)] transition hover:-translate-y-0.5"
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="currentColor" aria-hidden>
          <path d="M19.11 17.21c-.27-.14-1.61-.79-1.86-.88-.25-.09-.43-.14-.62.14-.18.27-.71.88-.87 1.06-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.19-1.35-.81-.72-1.36-1.62-1.52-1.89-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.54-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.35.98 2.65 1.12 2.83.14.18 1.93 2.95 4.68 4.13.65.28 1.16.45 1.56.58.66.21 1.25.18 1.72.11.52-.08 1.61-.66 1.84-1.29.23-.64.23-1.18.16-1.29-.06-.11-.25-.18-.52-.32zM16.02 5.33C10.13 5.33 5.34 10.12 5.34 16c0 1.88.49 3.71 1.42 5.32L5.33 26.67l5.49-1.44a10.65 10.65 0 0 0 5.2 1.32h.01c5.89 0 10.68-4.79 10.68-10.67 0-2.85-1.11-5.53-3.13-7.54a10.6 10.6 0 0 0-7.56-3.01zm0 19.43h-.01a8.8 8.8 0 0 1-4.49-1.23l-.32-.19-3.26.85.87-3.18-.21-.33a8.78 8.78 0 0 1-1.35-4.68c0-4.85 3.95-8.8 8.81-8.8 2.35 0 4.56.92 6.22 2.58a8.74 8.74 0 0 1 2.58 6.23c0 4.85-3.95 8.8-8.85 8.8z" />
        </svg>
      </a>
    </div>
  );
}
