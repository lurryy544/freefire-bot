const dotenv = require("dotenv");

dotenv.config();

function splitOwners(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^\d+$/.test(v) || /^@.+/.test(v))
    .map((v) => (/^\d+$/.test(v) ? Number(v) : v));
}

const config = {
  botToken: process.env.BOT_TOKEN || "",
  ownerIds: splitOwners(process.env.BOT_OWNER_ID),
  paymentCard: process.env.PAYMENT_CARD || "",
  cardHolder: process.env.CARD_HOLDER || "",
  adminComment: process.env.ADMIN_COMMENT || "",
  httpProxy: process.env.PROXY_URL || "",
};

module.exports = config;