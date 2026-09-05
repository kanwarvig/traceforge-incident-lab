import Link from "next/link";

export default function NotFound() {
  return <main className="fatal-error"><p className="kicker">404</p><h1>This trace does not exist.</h1><Link href="/">Return to the overview</Link></main>;
}
