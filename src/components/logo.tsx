import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Glory Training Hub Home">
      <span className="text-2xl" role="img" aria-label="graduation cap">🎓</span>
      <span className="text-lg md:text-xl font-bold font-headline text-foreground whitespace-nowrap">
        Glory Training Hub
      </span>
    </Link>
  );
}
