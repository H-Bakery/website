/**
 * Setup file of the jest project `contract-later` (B12): shifts the wall
 * clock by `CONTRACT_CLOCK_SHIFT_TO` (default 2028-01-01, a Saturday-free
 * New Year well after every recorded scenario date) and keeps it ticking.
 *
 * The contract suites replay mock answers recorded on one day; there is no
 * mock left to re-record from. A suite whose real side reads the wall clock
 * (ETAs, deadlines, "today") would turn red on its own some day - this
 * project runs every contract suite a second time in that future, so such a
 * dependency fails now, not in a year. Pin the clock through the service's
 * `now` option instead (see deliveries/preorders contract tests).
 */
const RealDate = Date
const target = RealDate.parse(
  process.env.CONTRACT_CLOCK_SHIFT_TO || '2028-01-01T10:00:00Z'
)
const offset = target - RealDate.now()

class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset)
    else super(...args)
  }

  static now() {
    return RealDate.now() + offset
  }
}

global.Date = ShiftedDate
