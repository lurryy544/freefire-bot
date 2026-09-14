const packages = [
  { id: "p100", gems: 100, price: 99 },
  { id: "p310", gems: 310, price: 299 },
  { id: "p520", gems: 520, price: 499 },
  { id: "p1060", gems: 1060, price: 990 },
  { id: "p2180", gems: 2180, price: 1990 },
  { id: "p5600", gems: 5600, price: 4900 },
  { id: "p11500", gems: 11500, price: 9900 },
];

function getPackage(id) {
  return packages.find((p) => p.id === id) || null;
}

function formatPrice(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatGems(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

module.exports = { packages, getPackage, formatPrice, formatGems };