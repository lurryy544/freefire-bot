const http = require("http");
const { Bot, InlineKeyboard } = require("grammy");
const config = require("./config");
const { packages, getPackage, formatPrice, formatGems } = require("./catalog");
const db = require("./db");

const botOptions = {};
if (config.httpProxy) {
  const { ProxyAgent } = require("proxy-agent");
  botOptions.client = { baseFetchConfig: { dispatcher: new ProxyAgent(config.httpProxy) } };
  console.log(`Telegram через прокси: ${config.httpProxy}`);
}

const bot = new Bot(config.botToken, botOptions);

function buildCatalogKeyboard() {
  const kb = new InlineKeyboard();
  const rows = [];
  let row = [];
  for (const p of packages) {
    row.push(InlineKeyboard.text(`${formatGems(p.gems)} 💎 — ${formatPrice(p.price)} ₽`, `pkg:${p.id}`));
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  for (const r of rows) kb.row(...r);
  return kb;
}

function packageLine(pkg) {
  return `${formatGems(pkg.gems)} 💎 — ${formatPrice(pkg.price)} ₽`;
}

function fmtUser(ctx) {
  const from = ctx.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const tag = from.username ? `@${from.username}` : "без username";
  return `${tag} (${name})`;
}

async function sendCatalog(ctx) {
  await ctx.reply(
    "Добро пожаловать в магазин алмазов Free Fire!\n\n" +
      "Выберите пакет и нажмите на него.",
    { reply_markup: buildCatalogKeyboard() },
  );
}

async function sendPaymentDetails(ctx, pkg, ffId) {
  const lines = [
    "Заказ сформирован!",
    "",
    `Пакет: ${packageLine(pkg)}`,
    `Сумма: ${formatPrice(pkg.price)} ₽`,
    `Ваш игровой ID: ${ffId}`,
    "",
    "Для оплаты переведите сумму на карту:",
    config.paymentCard ? `Карта: ${config.paymentCard}` : "Карта уточняется у поддержки",
    config.cardHolder ? `Получатель: ${config.cardHolder}` : "",
    config.adminComment || "",
    "",
    "После перевода нажмите кнопку ниже.",
  ].filter(Boolean);
  const kb = new InlineKeyboard()
    .text("Я оплатил(а)", "paid")
    .text("Отмена", "cancel");

  await ctx.reply(lines.join("\n"), { reply_markup: kb });
}

bot.command("start", async (ctx) => {
  db.clearState(ctx.from.id);
  await sendCatalog(ctx);
});

bot.command("cancel", async (ctx) => {
  db.clearState(ctx.from.id);
  await ctx.reply("Заказ отменён. Если захотите продолжить — нажмите /start");
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`);
});

bot.callbackQuery(/^pkg:/, async (ctx) => {
  const id = ctx.callbackQuery.data.slice(4);
  const pkg = getPackage(id);
  if (!pkg) {
    await ctx.answerCallbackQuery("Пакет не найден");
    return;
  }
  db.setState(ctx.from.id, { step: "awaiting_id", pkgId: pkg.id });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `Вы выбрали: ${packageLine(pkg)}\n\nВведите ваш игровой ID из Free Fire (только цифры):`,
  );
});

bot.callbackQuery("paid", async (ctx) => {
  const state = db.getState(ctx.from.id);
  if (!state || state.step !== "awaiting_payment") {
    await ctx.answerCallbackQuery("Сначала выберите пакет: /start");
    return;
  }
  db.setState(ctx.from.id, { ...state, step: "awaiting_photo" });
  await ctx.answerCallbackQuery();
  const kb = new InlineKeyboard().text("Отмена", "cancel");
  await ctx.reply("Отлично! Теперь отправьте сюда скриншот подтверждения оплаты.", {
    reply_markup: kb,
  });
});

bot.callbackQuery("cancel", async (ctx) => {
  db.clearState(ctx.from.id);
  await ctx.answerCallbackQuery();
  await ctx.reply("Заказ отменён. Если захотите продолжить — нажмите /start");
});

async function notifyAdmins(ctx, pkg, ffId) {
  const text = [
    "Новый заказ!",
    "",
    `Пакет: ${packageLine(pkg)}`,
    `Игровой ID: ${ffId}`,
    `Покупатель: ${fmtUser(ctx)}`,
    `Telegram ID: ${ctx.from.id}`,
    "Скриншот — выше.",
  ].join("\n");

  for (const ownerId of config.ownerIds) {
    try {
      await ctx.api.forwardMessage(ownerId, ctx.chat.id, ctx.message.message_id);
      await ctx.api.sendMessage(ownerId, text);
    } catch (err) {
      console.error(`Не удалось отправить заказ админу ${ownerId}:`, err.message);
    }
  }
}

bot.on("message:text", async (ctx) => {
  const state = db.getState(ctx.from.id);
  if (!state || state.step !== "awaiting_id") return;

  const ffId = ctx.message.text.trim();
  const pkg = getPackage(state.pkgId);
  if (!pkg) {
    await ctx.reply("Пакет не найден. Нажмите /start и выберите пакет заново.");
    return;
  }
  if (!/^\d+$/.test(ffId) || ffId.length < 4) {
    await ctx.reply("Игровой ID состоит из цифр (от 4 символов). Введите его ещё раз:");
    return;
  }

  db.setState(ctx.from.id, { ...state, step: "awaiting_payment", ffId });
  await sendPaymentDetails(ctx, pkg, ffId);
});

bot.on("message:photo", async (ctx) => {
  const state = db.getState(ctx.from.id);
  if (!state || state.step !== "awaiting_photo") {
    await ctx.reply("Сначала выберите пакет — нажмите /start");
    return;
  }

  const pkg = getPackage(state.pkgId);
  const ffId = state.ffId;

  db.addOrder(ctx.from.id, {
    pkgId: pkg ? pkg.id : state.pkgId,
    gems: pkg ? pkg.gems : null,
    price: pkg ? pkg.price : null,
    ffId,
    buyer: fmtUser(ctx),
    telegramId: ctx.from.id,
  });
  db.clearState(ctx.from.id);

  await ctx.reply(
    "Спасибо! Заказ принят.\n\n" +
      "Скоро алмазы появятся на вашем аккаунте. Обычно пополнение занимает несколько минут. " +
      "Если что-то пойдёт не так — напишите нам, проверим ваш заказ.",
  );

  if (config.ownerIds.length && pkg) {
    await notifyAdmins(ctx, pkg, ffId);
  }
});

bot.catch((err) => {
  console.error("Ошибка бота:", err.error);
});

async function main() {
  if (!config.botToken) {
    console.error("Нет BOT_TOKEN — заполните .env");
    process.exit(1);
  }
  if (!config.ownerIds.length) {
    console.warn("Предупреждение: BOT_OWNER_ID не указан — заказы не будут пересылаться админу");
  }

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  const port = Number(process.env.PORT || 8080);
  server.listen(port, () => console.log(`Health-сервер слушает порт ${port}`));

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`Получен ${signal}, останавливаюсь...`);
    try {
      await bot.stop();
    } catch (err) {
      console.error("Ошибка при остановке:", err.message);
    }
    server.close();
    process.exit(0);
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));

  await bot.start({
    drop_pending_updates: false,
    onStart: (me) => console.log(`Бот запущен: @${me.username}`),
  });
}

main();