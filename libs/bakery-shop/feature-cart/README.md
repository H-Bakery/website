# @bakery/shop/feature-cart

Warenkorb, Kasse und Bestellbestätigung des Online-Shops (`apps/bakery-shop`).

## Public API

| Export              | Props                 | Route              |
| ------------------- | --------------------- | ------------------ |
| `CartPage`          | –                     | `/cart`            |
| `CheckoutPage`      | –                     | `/kasse`           |
| `OrderConfirmation` | `{ orderId: string }` | `/bestellung/[id]` |

None of them renders `Header`/`Footer` — the app layout owns the shop chrome.

## Wie bestellt wird

Der Shop nimmt **echte Bestellungen** entgegen: `CheckoutPage` validiert das
Formular clientseitig, ruft `submitOrder()` aus `@bakery/shared/data-access`
(`POST /api/orders`) auf und leitet auf `/bestellung/<id>` weiter. Es gibt hier
bewusst **keinen WhatsApp- oder Telefon-Bestellweg** — der lebt ausschließlich
auf der Landingpage.

Zwei Invarianten, die beim Ändern erhalten bleiben müssen:

- **Der Warenkorb wird erst nach einer erfolgreichen Antwort geleert.** Bei einem
  Fehler bleiben Korb und Formulareingaben stehen, und `checkout-error` zeigt die
  deutsche Fehlermeldung.
- **Preise sind Bruttopreise** (deutscher Einzelhandel, inkl. MwSt.). Die App
  mountet `CartProvider` mit `taxRate={0}`; `grossTotal()` in `order-totals.ts`
  rechnet zusätzlich `subtotal - discount`, damit niemals 19 % auf einen Preis
  addiert werden, der sie schon enthält. Es gibt deshalb keine separate
  Steuerzeile, nur den Hinweis „inkl. MwSt.".

## Öffnungszeiten / Abholzeiten

`pickup.ts` spiegelt `apps/bakery-landing/src/config/openingHours.ts` — eine Lib
darf nicht aus einer App importieren (Nx-Modulgrenzen). Ändern sich die Zeiten,
muss **beides** angepasst werden. Montag ist Ruhetag; das Abholdatum wird
entsprechend abgelehnt, ebenso Daten in der Vergangenheit. Abholzeiten sind
Halbstunden-Slots innerhalb der Öffnungszeiten des gewählten Tages, für den
heutigen Tag zusätzlich um eine Stunde Vorlaufzeit gekürzt.

## Tests

`nx test feature-cart` — Unit-Tests der reinen Module (`pickup.ts`,
`checkout-validation.ts`). Der Klick-Pfad Katalog → Warenkorb → Kasse →
Bestätigung liegt in der Playwright-Suite von `apps/bakery-shop-e2e` und stützt
sich auf die `data-testid`s dieser Komponenten (`cart-page`, `cart-item`,
`cart-total`, `cart-checkout`, `checkout-page`, `customer-name`,
`customer-phone`, `customer-email`, `pickup-date`, `pickup-time`, `order-notes`,
`submit-order`, `checkout-error`, `order-confirmation`, `order-number`).
