import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
      <Link href="/" className="font-semibold tracking-tight">OpenMock</Link>
      <nav aria-label="Main navigation">
        <Link href="/practice" className={buttonVariants({ variant: "ghost", size: "sm" })}>Practice</Link>
      </nav>
    </header>
  );
}
