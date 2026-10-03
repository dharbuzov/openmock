import Link from "next/link";
import { OpenMockLogo } from "@/components/openmock-logo";
import { GitHubIcon } from "@/components/github-icon";
import { buttonVariants } from "@/components/ui/button";
import { SettingsButton } from "@/components/settings-provider";

export function Header() {
  return (
    <header className="shrink-0 border-b">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-base font-semibold tracking-tight hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <OpenMockLogo />
          OpenMock
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-3 sm:gap-5"
        >
          <a
            href="https://github.com/dharbuzov/openmock"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 shrink-0 items-center gap-1.5 px-2.5 text-[0.8rem] font-medium hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <GitHubIcon />
            GitHub
          </a>
          <Link
            href="/practice"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Practice
          </Link>
          <SettingsButton />
        </nav>
      </div>
    </header>
  );
}
