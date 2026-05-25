import Link from 'next/link';
import { CreditsBadge } from './CreditsBadge';

export function SiteHeader() {
  return (
    <header className="shrink-0 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            RunningHub Shots
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-400">
            <Link href="/" className="hover:text-neutral-100">Shots</Link>
            <Link href="/upload" className="hover:text-neutral-100">Upload</Link>
            <Link href="/sources" className="hover:text-neutral-100">Sources</Link>
            <Link href="/saved" className="hover:text-neutral-100">Saved</Link>
            <Link href="/settings" className="hover:text-neutral-100">Settings</Link>
          </nav>
        </div>
        <CreditsBadge />
      </div>
    </header>
  );
}
