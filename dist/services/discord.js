import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';
const discordClient = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});
// login to discord with your bot token
discordClient.login(process.env.DISCORD_BOT_TOKEN);
export { discordClient };
