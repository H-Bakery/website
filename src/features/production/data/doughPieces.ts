export interface DoughPiece {
  name: string;
  weight: number;
  count: number;
  description?: string;
}

/**
 * Data derived from "Teigstückübersicht für Kuchen" documentation
 * Defines the standard dough pieces used in bakery production
 */
export const DOUGH_PIECES: DoughPiece[] = [
  {
    name: "Kranz",
    weight: 600,
    count: 3,
    description: "Standard Kranz ohne Füllung"
  },
  {
    name: "Gefüllter Kranz",
    weight: 1200,
    count: 1,
    description: "Kranz mit verschiedenen Füllungen"
  },
  {
    name: "Gefüllter Zopf",
    weight: 500,
    count: 1,
    description: "Zopf mit Füllung"
  },
  {
    name: "Kleiner Zopf",
    weight: 300,
    count: 2,
    description: "Kleine Zopfvariante"
  },
  {
    name: "Großer Zopf",
    weight: 300,
    count: 3,
    description: "Große Zopfvariante (aus mehreren Teigstücken)"
  },
  {
    name: "Rosinenbrot",
    weight: 600,
    count: 1,
    description: "Hefebrot mit Rosinen"
  },
  {
    name: "Kleiner Streusel",
    weight: 500,
    count: 1,
    description: "Streuselkuchen (klein)"
  },
  {
    name: "Großer Streusel",
    weight: 900,
    count: 1,
    description: "Streuselkuchen (groß)"
  },
  {
    name: "Teig, ausgerollt",
    weight: 500,
    count: 1,
    description: "Ausgerollter Teig für diverse Gebäcke"
  }
];