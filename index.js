import "dotenv/config";
import Eris from "eris";
import { Client } from "@botpress/chat";
import { startHealthCheckBeacon } from "./src/healthcheck.js";
const myWebhookId = process.env.BOTPRESS_WEBHOOK_ID;

const client = new Client({
  apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});

const bot = new Eris(process.env.DISCORD_TOKEN, {
  intents: ["guildMessages"],
});

bot.on("ready", () => {
  // When the bot is ready
  console.log("Ready!"); // Log "Ready!"
  startHealthCheckBeacon()
});

bot.on("error", (err) => {
  console.error(err); // or your preferred logger
});

bot.on("messageCreate", async (msg) => {
  // When a message is created
  if (msg.author.bot) {
    return;
  }

  // send to botpress, wait for response, send response.
  const { user, key: xChatKey } = await client.createUser({});

  // 1. create a conversation
  const { conversation } = await client.createConversation({
    xChatKey,
    participants: [user.id],
  });

  // 2. send the message to botpress
  const { message } = await client.createMessage({
    xChatKey,
    conversationId: conversation.id,
    payload: {
      type: "text",
      text: msg.content,
    },
  });

  const listener = await client.listenConversation({
    id: conversation.id,
    xChatKey,
  });

  listener.on("message_created", async (ev) => {
    if (ev.userId === user.id) {
      // message created by my current user, ignoring...
      return;
    }
    await bot.createMessage(msg.channel.id, ev.payload.text);
  });
});

bot.connect(); // Get the bot to connect to Discord
