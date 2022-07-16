import Link from 'next/link';

import { Background } from './Background';
import { Button } from './Button';
import { HeroOneButton } from './HeroOneButton';
import { Section } from './Section';
import { NavbarTwoColumns } from './NavbarTwoColumns';
import { Logo } from './Logo';

const Hero = () => (
  <Background color="bg-gray-100">
    <Section yPadding="py-6">
      <NavbarTwoColumns logo={<Logo xl />}>
        <li>
          <Link href="/">
            <a>Home</a>
          </Link>
        </li>
        <li>
          <Link href="/about-us">
            <a>About us</a>
          </Link>
        </li>
        <li>
          <Link href="/reservation">
            <a>Reservation</a>
          </Link>
        </li>
      </NavbarTwoColumns>
    </Section>

    <Section yPadding="pt-20 pb-32">
      <HeroOneButton
        title={
          <>
            {"Let's taste "}
            <span className="text-primary-500">Perfection</span>
          </>
        }
        description="The easiest way to build a React landing page in seconds."
        button={
          <Link href="https://creativedesignsguru.com/category/nextjs/">
            <a>
              <Button xl>Download Your Free Theme</Button>
            </a>
          </Link>
        }
      />
    </Section>
  </Background>
);

export { Hero };