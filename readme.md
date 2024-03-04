# Configuring the Bot
  
1. Download or checkout the repository
2. Copy `config example.json` file and rename it `config.json`
3. Go over to https://twitchapps.com/tmi/, authorize it with the right Twitch account and copy over the api key into the `oAuth` field removing the `oath:` at the start
4. Go over to https://hammertime.cyou/ and input the start time for the stream and copy over the number (without any formatting) into the `streamStart` field
5. Update the `static commands.csv`, `games.csv` and `players.csv` files, you can open these in Excel or any other spreadsheet program, make sure not to add or remove any columns (unless you also update the corresponding code)

# Running the bot

1. Make sure you have node and npm installed (you can get them here: https://nodejs.org/)
2. Open the project folder in a command line
3. Run the command `npm install` (you only have to do this once after downloading the project)
4. Run the command `node .`, if everything went right the bot will print out a list of the games and commands and then you should get a message from Twitch that you are connected.
