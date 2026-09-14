const { Bot } = require("grammy");

const token = process.env.BOT_TOKEN || "";
if (!token) {
  console.log("NO_TOKEN_IN_SECRET");
  process.exit(1);
}

const bot = new Bot(token);

(async () => {
  try {
    const me = await bot.api.getMe();
    console.log(`TOKEN_OK bot=@${me.username} id=${me.id}`);
    const info = await bot.api.getWebhookInfo();
    console.log("webhook_info:", JSON.stringify(info));
    const me2 = await bot.api.getMe();
    console.log("getMe_again: ok");
  } catch (e) {
    const err = e && e.error_code
      ? `HTTP_${e.error_code} ${e.description}`
      : String((e && e.message) || e);
    console.log("TOKEN_FAIL:", err);
    process.exit(1);
  }
})();