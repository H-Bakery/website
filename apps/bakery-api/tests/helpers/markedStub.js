/**
 * Jest stand-in for `marked` (v16 ships ESM only, which the plain-JS jest
 * project cannot parse). Only the legacy root layer requires it, via
 * utils/recipeParser.js - and the suites that load `index.js`
 * (healthAPI, securityIntegration) never render a recipe. B12 deletes that
 * layer together with this stub.
 */
function marked(markdown) {
  return String(markdown == null ? '' : markdown)
}
marked.marked = marked
marked.parse = marked
marked.setOptions = () => marked
marked.use = () => marked
module.exports = marked
