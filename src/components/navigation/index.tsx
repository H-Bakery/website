import { Navbar } from "./Navbar";
import { Logo } from "../Logo";
import { Section } from "../Section";
import Link from "next/link"

const Navigation = () => (
  <Section yPadding="py-6">
    <Navbar logo={<Logo xl />}>
      <li>
        <Link href="/">
          <a>Home</a>
        </Link>
      </li>
      <li>
        <Link href="/sortiment">
          <a>Sortiment</a>
        </Link>
      </li>
      <li>
        <Link href="/news">
          <a>Neuigkeiten</a>
        </Link>
      </li>
      <li>
        <Link href="/about">
          <a>Über Uns</a>
        </Link>
      </li>
      <li>
        <Link href="/bestellen">
          <a>Bestellen</a>
        </Link>
      </li>
    </Navbar>
  </Section>
);

export { Navigation };
