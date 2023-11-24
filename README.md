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

<<<<<<< Updated upstream
Since this leverages the chat integration, and by default there are no tags in the chat integration, if you want to send all info to botpress, and keep the same structure, add this to a before incomming message hook:
=======
In order to run this project locally you need to set up a few variables. Rename the `.env.sample` file to `.env` and add the actual values:

-   APP_ID - The application ID is available in the **General Information** section of your app settings
-   APP_PUBLIC_KEY - The public key is available in the **General Information** section of your app settings
-   DISCORD_BOT_TOKEN - The bot token is available in the **Bot** section of your app. Reset the token to be able to see and copy it
-   BOTPRESS_CHAT_WEBHOOK_ID - The webhook ID is the code after `https://webhook.botpress.cloud/` in the settings of the **Chat** integration in Botpress.
-   BOTPRESS_CHAT_ENCRYPTION_KEY - This is a random text that you can create yourself or generate somewhere (like in [Random.org](https://www.random.org/)). Save the text in the "Encryption Key" input of the **Chat** integration settings.
-   DISCORD_SERVER_ID - The server ID available in the **Widget** section of your server settings

Learn more about setting up a Discord in the [Get Started guide](https://discord.com/developers/docs/getting-started)

## 2. Adding the App to your Server

1. Go to the **Bot** section of your developer app and make sure these settings are as follows:

-   Requires OAuth2 Code Grant - disabled
-   Server Members Intent - enabled
-   Message Content Intent - enabled

2. Go to the **OAuth2 > URL Generator** section and check the "Bot" scope
3. Under **Bot permissions**, check the "Read Messages/View Channels" and "Send Messages" permissions
4. Copy the Generated URL and open it
5. Select the desired server and click "Continue" then "Authorize"

## 3. Running the App

1. Open the folder in a Terminal and run these commands:

-   `npm install` - to install all dependencies
-   `npm run dev` - to start the server in development mode

2. You should see a `Server is listening!` log
3. Try sending a message in a thread in your Discord server and you should see a `There's a new user message!` log
4. You should also get a response from your Botpress bot since a new conversation has just started from the "Start" node

## 3. Accessing Discord message data in Botpress

Since this project uses the Chat integration, and by default there are no tags in the Chat integration, you might want to send all info received from Discord to your Botpress bot, keeping the same structure. To do that, create a Before Incoming Message [hook](https://botpress.com/docs/cloud/studio/hooks/) and add the code below:
>>>>>>> Stashed changes

```javascript
  if (event.integration === 'chat') {
    event.preview = event.payload.payload.content
    event.payload.type = 'text'
    event.payload.text = event.payload.payload.content
  }
```

This way, you can still access your data in event.payload.payload, and event.preview will be pure text as expected.

<<<<<<< Updated upstream
=======
## 4. Deploying this Project
>>>>>>> Stashed changes

## 2. Deploying the App

Use the below button.

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/ptrckbp/discord-botpress-chat-server/tree/main)

While configuring the app in Digital Ocean, add the 6 environment variables found above.

<<<<<<< Updated upstream
The messages will start streaming to / from your server.
=======
## You're ready

The messages will now start streaming from Discord to this server then to your Botpress bot and back!
>>>>>>> Stashed changes
