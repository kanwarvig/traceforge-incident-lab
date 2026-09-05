import Link from "next/link";

export default function NotFound() {
  return <main className="fatal-error"><p className="eyebrow">404</p><h1>This trace does not exist.</h1><Link href="/">Return to the lab</Link></main>;
}
