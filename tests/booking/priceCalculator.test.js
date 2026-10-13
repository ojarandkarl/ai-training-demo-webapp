const { calculatePrice } = require('../../src/booking/priceCalculator');

// Expected results come from demo-scenarios/session-4-restful-booker/1_Broneeringu_nouded_mustand.md,
// not from the code. 2027-03-01 is a Monday, so 2027-03-05 is a Friday and 2027-03-06 a Saturday.
describe('priceCalculator', () => {
  const nightlyRateCents = 10000;

  function stay(checkin, nights, extra = {}) {
    const checkout = new Date(Date.parse(`${checkin}T00:00:00Z`) + nights * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { nightlyRateCents, checkin, checkout, ...extra };
  }

  test('2.1 calculatePrice rejects a checkout before the checkin', () => {
    expect(() => calculatePrice({ nightlyRateCents, checkin: '2027-03-03', checkout: '2027-03-01' })).toThrow();
  });

  test('2.2 calculatePrice rejects a stay of 0 nights (below the 1-night minimum)', () => {
    expect(() => calculatePrice(stay('2027-03-01', 0))).toThrow();
  });

  test('2.2 calculatePrice accepts a stay of exactly 1 night (minimum)', () => {
    expect(calculatePrice(stay('2027-03-01', 1)).nights).toBe(1);
  });

  test('2.2 calculatePrice accepts a stay of 2 nights (above the minimum)', () => {
    expect(calculatePrice(stay('2027-03-01', 2)).nights).toBe(2);
  });

  test('2.2 calculatePrice accepts a stay of 13 nights (below the 14-night maximum)', () => {
    expect(calculatePrice(stay('2027-03-01', 13)).nights).toBe(13);
  });

  test('2.2 calculatePrice accepts a stay of exactly 14 nights (maximum)', () => {
    expect(calculatePrice(stay('2027-03-01', 14)).nights).toBe(14);
  });

  test('2.2 calculatePrice rejects a stay of 15 nights (above the maximum)', () => {
    expect(() => calculatePrice(stay('2027-03-01', 15))).toThrow();
  });

  test('3.1 calculatePrice total is nightly rate times nights on weekdays', () => {
    // Monday and Tuesday nights, no weekend surcharge.
    expect(calculatePrice(stay('2027-03-01', 2)).totalCents).toBe(20000);
  });

  // KÜSIMUS: "reede ja laupäev" tähendab siin ööd, mis algavad reedel ja laupäeval (reede->laupäev,
  // laupäev->pühapäev). Kui mõeldakse ööd, mis lõpevad reedel/laupäeval, on oodatav tulemus teine.
  test('3.2 calculatePrice makes Friday and Saturday nights 20% more expensive', () => {
    // Thursday 10000 + Friday 12000 + Saturday 12000 + Sunday 10000.
    expect(calculatePrice(stay('2027-03-04', 4)).totalCents).toBe(44000);
  });

  test('3.2 calculatePrice counts two weekend nights for a Friday to Sunday stay', () => {
    expect(calculatePrice(stay('2027-03-05', 2))).toEqual({
      nights: 2,
      weekendNights: 2,
      subtotalCents: 24000,
      totalCents: 24000,
      depositRequired: false
    });
  });

  test('3.4 calculatePrice gives a total of 0 with a 100% discount', () => {
    expect(calculatePrice(stay('2027-03-01', 2, { discountPercent: 100 })).totalCents).toBe(0);
  });

  // KÜSIMUS: kas üle 100% allahindlus tuleb tagasi lükata või piirata 100%-ga? Nõue ütleb ainult
  // "kuni 100%", seega kontrollime ainult, et hind ei läheks negatiivseks.
  test('3.4 calculatePrice never returns a negative total for a discount above 100%', () => {
    expect(calculatePrice(stay('2027-03-01', 2, { discountPercent: 150 })).totalCents).toBeGreaterThanOrEqual(0);
  });

  // KÜSIMUS: kas negatiivse hinna sisend tuleb tagasi lükata (viga) või hind nulliks piirata?
  // Nõue ütleb "hind ei saa olla negatiivne"; eeldame tagasilükkamist.
  test('3.4 calculatePrice rejects a negative nightly rate', () => {
    expect(() => calculatePrice(stay('2027-03-01', 2, { nightlyRateCents: -10000 }))).toThrow();
  });

  // KÜSIMUS: "üle nädala" = rohkem kui 7 ööd (7 ööd on täpselt nädal, mitte üle). Kui mõeldi
  // "nädal või rohkem", muutub piiril oleva testi oodatav tulemus.
  test('4.1 calculatePrice does not require a deposit for 6 nights (below a week)', () => {
    expect(calculatePrice(stay('2027-03-01', 6)).depositRequired).toBe(false);
  });

  test('4.1 calculatePrice does not require a deposit for exactly 7 nights (a week, not over)', () => {
    expect(calculatePrice(stay('2027-03-01', 7)).depositRequired).toBe(false);
  });

  test('4.1 calculatePrice requires a deposit for 8 nights (over a week)', () => {
    expect(calculatePrice(stay('2027-03-01', 8)).depositRequired).toBe(true);
  });

  test('4.2 calculatePrice does not require a deposit from a regular customer', () => {
    expect(calculatePrice(stay('2027-03-01', 8, { isRegular: true })).depositRequired).toBe(false);
  });

  test('7.1 calculatePrice accepts 29 nights for a regular customer (below the 30-night maximum)', () => {
    expect(calculatePrice(stay('2027-03-01', 29, { isRegular: true })).nights).toBe(29);
  });

  test('7.1 calculatePrice accepts exactly 30 nights for a regular customer (maximum)', () => {
    expect(calculatePrice(stay('2027-03-01', 30, { isRegular: true })).nights).toBe(30);
  });

  test('7.1 calculatePrice rejects 31 nights for a regular customer (above the maximum)', () => {
    expect(() => calculatePrice(stay('2027-03-01', 31, { isRegular: true }))).toThrow();
  });
});
