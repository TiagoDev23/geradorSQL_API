import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config";

/** Moldura das telas públicas: um cartão centralizado, sem navegação. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[15px] font-semibold tracking-tight text-ink">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">{PRODUCT_TAGLINE}</p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
