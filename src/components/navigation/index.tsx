import { Logo } from "../Logo";
import { Section } from "../Section";
import Item from "./Item";

const Navigation = () => {
  const items = [
    { label: 'Sortiment', path: '/sortiment' },
    { label: 'Neuigkeiten', path: '/news' },
    { label: 'Über uns', path: '/about' },
  ]
  const ctaItems = [
    { label: 'Bestellen', path: '/bestellen' },
  ]
  return (
    <Section yPadding="py-6">
      <div>
        <Logo xl />
        <div>
          {items.map((item) => (
            <Item key={item.label} {...item} />
          ))}
        </div>
        <div>
          {ctaItems.map((item) => (
            <Item key={item.label} {...item} />
          ))}
        </div>
      </div>
    </Section>
  )
};

export { Navigation };
