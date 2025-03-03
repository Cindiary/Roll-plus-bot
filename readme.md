Hi! This is the source code for the Twitch bot for Roll +Bond's yearly anniversary stream and also has the css for the caption solution we're using (`captions.css`).

# Configuring the Bot
  
1. Download or checkout the repository
2. Copy `config example.json` file and rename it `config.json`
3. Go over to https://twitchtokengenerator.com/, get a Bot Chat token with the right Twitch account and copy over the `Access Token` into the `oAuth` field.
4. Go over to https://hammertime.cyou/ and input the start time for the stream and copy over the number (without any formatting) into the `streamStart` field
5. Update the `static commands.csv`, `games.csv` and `players.csv` files, you can open these in Excel or any other spreadsheet program, make sure not to add or remove any columns (unless you also update the corresponding code).
Make sure to use the right format (csv with `;` as a separator) when saving the file.
Also the csv parser is very basic so please do not put the `;` character in any field.

# Running the bot

1. Make sure you have node and npm installed (you can get them here: https://nodejs.org/)
2. Open the project folder in a command line
3. Run the command `npm install` (you only have to do this once after downloading the project)
4. Run the command `node .`, if everything went right the bot will print out a list of the games and commands and then you should get a message from Twitch that you are connected.
