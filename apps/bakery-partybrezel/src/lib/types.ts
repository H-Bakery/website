import type { SizeId, ToppingMode } from '../config/partybrezel.config'

/** Eine Brezel im Entwurf: Größe und je Teil die Belag-ID (`null` = noch offen). */
export interface PretzelDraft {
  id: string
  size: SizeId
  toppings: (string | null)[]
}

/** Alles, was die Kundschaft im Prototyp eingibt. */
export interface OrderDraft {
  pretzels: PretzelDraft[]
  toppingMode: ToppingMode
  /** YYYY-MM-DD oder `null`, solange kein Tag gewählt ist. */
  pickupDate: string | null
  /** HH:MM oder leer. */
  pickupTime: string
  name: string
  phone: string
  note: string
}
