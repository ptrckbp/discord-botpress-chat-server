# discord-botpress-chat-server (WIP)

## Deploying the App

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/ptrckbp/discord-botpress-chat-server/tree/main)

You need 6 environment variables in DO: 
the Discord variables can be obtained following the get started : https://discord.com/developers/docs/getting-started
BOTPRESS_CHAT_WEBHOOK_ID -> get this from the dashboard in app.botpress.cloud
BOTPRESS_CHAT_ENCRYPTION_KEY -> generate it somewhere, then put this from the dashboard in app.botpress.cloud, and save to this variable
DISCORD_GUILD_ID -> run your server and log the guild id then add it here. This ensures your server only runs on one guild.



## Bot configuration

Since by default there are no tags in the chat integration, if you want to send all info to botpress, and keep the same structure, add this to a before incomming message hook:

```javascript
  if (event.integration === 'chat') {
    event.preview = event.payload.payload.content
    event.payload.type = 'text'
  }
```

Then you can still access your data in event.payload.payload.