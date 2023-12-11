# Discord Botpress Chat Connector

This project allows you to connect your Botpress bot with your Discord server using the Chat integration. For small servers, this will cost 5$ /month on Digital Ocean.

## Requirements

-   A published Botpress bot with the "Chat" integration enabled
-   A developer Discord app
-   Admin rights in a Discord server
-   An account on a cloud platform like Heroku or Digital Ocean (for optionally deploying the project)

## 1. Setting up Environment variables

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

## 4. Accessing Discord message data in Botpress

Since this project uses the Chat integration, and by default there are no tags in the Chat integration, you might want to send all info received from Discord to your Botpress bot, keeping the same structure. To do that, create a Before Incoming Message [hook](https://botpress.com/docs/cloud/studio/hooks/) and add the code below:

```javascript
if (event.integration === 'chat') {
	event.preview = event.payload.payload.content; // assigns the user message on Discord to the main message container in Botpress
	event.payload.type = 'text'; // sets the type
	event.payload.text = event.payload.payload.content; // also assigns the user message on Discord to the secondary message container in Botpress
}
```

This way, you can still access the raw message data in event.payload.payload, and event.preview will be pure text as expected by the bot.

## 5. Deploying this Project

To deploy this project as a server you could clone this repository in GitHub and select the cloned version in Heroku or other platform.

You could also easily deploy it to Digital Ocean by clicking this button:

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/ptrckbp/discord-botpress-chat-server/tree/main)

In both cases you need to set up the environment variables mentioned above in the project settings.

## You're ready

The messages will now start streaming from Discord to this server then to your Botpress bot and back!
