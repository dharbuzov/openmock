import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Header() {
  return (
    <header className="shrink-0 border-b">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="text-base font-semibold tracking-tight hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4">OpenMock</Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5">
          <a href="https://github.com/dharbuzov/openmock" className={buttonVariants({ variant: "ghost", size: "sm" })}>GitHub</a>
          <Link href="/practice" className={buttonVariants({ variant: "outline", size: "sm" })}>Practice</Link>
        </nav>
      </div>
    </header>
  );
}
