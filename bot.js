require("dotenv").config();
const token = process.env.TELEGRAM_TOKEN;
const figma = require('./figma');
const Bot = require('node-telegram-bot-api');
let bot;

if(process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
}
else {
  bot = new Bot(token, { polling: true });
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

let cache = {};

figma.loadDocuments().then(res => {
  console.log('Documents loaded to RAM');
  cache = res;
});

bot.on('message', async (msg) => {
  const { chat, from, text } = msg;

  if (!Object.keys(cache).length) {
    bot.sendMessage(chat.id, `Sorry, bro, I just started to load projects, wait 2-3 mins, please`);
    return false;
  }

  bot.sendMessage(chat.id, `Ok, looking for "${text}"...`);
  const nodes = figma.searchNodes(cache, text);
  const response = figma.mapSearchResponse(nodes);
  bot.sendMessage(chat.id, response);
});

module.exports = bot;
