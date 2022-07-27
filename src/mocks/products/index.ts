const BREADS = require("./breads.json");
const BAGUETTES = require("./baguettes.json");
const BUNS = require("./buns.json");
const SWEETS = require("./sweets.json");
const CAKES = require("./cakes.json");
const SPECIAL_CAKES = require("./special-cakes.json");
const SNACKS = require("./snacks.json");

export const PRODUCTS = [
  ...BREADS,
  ...BAGUETTES,
  ...BUNS,
  ...SNACKS,
  ...SWEETS,
  ...CAKES,
  ...SPECIAL_CAKES,
];
