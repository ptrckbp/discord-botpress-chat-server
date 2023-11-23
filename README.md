# Discord Botpress Connector

This allows you to connect your Botpress bot with your discord server. For small servers, this will cost 5$ /month on Digital Ocean.

## Requirements
- a botpress bot with the "Chat" integration enabled
- a Digital Ocean account (for deploying the bot)
- a developer Discord App installed to your discord server.

You need 6 environment variables in Digital Ocean: 
- APP_ID, DISCORD_TOKEN and PUBLIC_KEY can be obtained following the get started : https://discord.com/developers/docs/getting-started
- BOTPRESS_CHAT_WEBHOOK_ID -> get this from the dashboard in app.botpress.cloud
- BOTPRESS_CHAT_ENCRYPTION_KEY -> generate it somewhere, then put this from the dashboard in app.botpress.cloud, and save to this variable
- DISCORD_GUILD_ID -> run your server and log the guild id then add it here. This ensures your server only runs on one guild.

## 1. Making changes in your bot

Since this leverages the chat integration, and by default there are no tags in the chat integration, if you want to send all info to botpress, and keep the same structure, add this to a before incomming message hook:

```javascript
  if (event.integration === 'chat') {
    event.preview = event.payload.payload.content
    event.payload.type = 'text'
    event.payload.text = event.payload.payload.content
  }
```

This way, you can still access your data in event.payload.payload, and event.preview will be pure text as expected.


## 2. Deploying the App

Use the below button.

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/ptrckbp/discord-botpress-chat-server/tree/main)

While configuring the app in Digital Ocean, add the 6 environment variables found above.

The messages will start streaming to / from your server.