const WebSocket = require("ws");
const fs = require("fs");

const config = require("./config.json");

const second = 1000;
const minute  = 60 * second;
const hour = 60 * minute;

const minMessageLength = 100;
const maxMessageLength = 500;

const repeatingCommands = [ "!donate", "!game" ];

// Add/Remove the first slash on the next line to switch between stream time (//*/) and test settings (/*/)
//*/

const channel = config.channel; //The channel that the bot should operate in
const streamStartTime = config.streamStart * second; //Epoch time that the stream starts, taken from https://hammertime.cyou/
const gameDuration = config.gameDuration * second;
const commandPeriod = config.commandPeriod * second;

/*/

// Alternate settings for testing
const channel = "rollPlusBondBot";
const gameDuration = 30 * second;
const streamStartTime = Date.now() + gameDuration;
const commandPeriod = 30 * second;

//*/

function loadCsv(path, columns) {
  return fs.readFileSync(path).toString()
        .split("\n")
        .splice(1)
        .map(line => line.split(";").map(str => str.trim()))
        .filter(items => items.length >= columns);
}

const players =
  loadCsv(config.playersLocation, 4)
  .map(items => ({ gameNr: parseInt(items[0]), facilitator: items[1].toLowerCase() == "true", name: items[2], pronouns: items[3] }));

const games = 
  loadCsv(config.gamesLocation, 4)
  .map(items => ({ name: items[1], link: items[2], contentWarnings: items[3], facilitator: { name: "Facilitator", pronouns: "" }, players: [] }));

for(player of players) {
  if(player.gameNr < 1 || player.gameNr > games.length) {
    console.log(`Player ${player} has invalid game nr: ${player.gameNr}`);
    continue;
  }
  const game = games[player.gameNr - 1];

  if(player.facilitator) {
    game.facilitator = player;
  } else {
    game.players.push(player);
  }
}

const staticCommands =
  loadCsv(config.staticCommandsLocation, 3)
  .map(items => ({ command: items[0], altCommands: items[1].split(",").filter(str => str), response: items[2] }));

const staticCommandLookup =
  Object.fromEntries(staticCommands.flatMap(command => command.altCommands.concat([ command.command ]).map(str => [ str.toLowerCase(), command.response ])));

const vodResponse = staticCommandLookup["!vod"];

const commandNames = [ "!game", "!next", "!previous", "!content warnings" ].concat(staticCommands.map(item => item.command));
const commandsList = `${commandNames.slice(0, -1).join(", ")} or ${commandNames.at(-1)}`;
const exclamationMarksRegex = /^[\s\!1]+$/;

console.log("Games", games);
console.log("Static commands", staticCommands);

for (let index = 0; index < repeatingCommands.length; index++) {
  repeat(repeatingCommands[index], commandPeriod, 10 * second + index * commandPeriod / repeatingCommands.length);
}

var socket = null;
connect();

function connect() {
  socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  
  socket.addEventListener("open", function() {
    //Authenticate and join the channel
    socket.send(`PASS oauth:${config.oAuth}`);
    socket.send(`NICK ${config.nick}`);
    socket.send(`JOIN #${channel}`);
  
    // sendMessage("Bot started!");
  });
  
  
  socket.addEventListener("message", onMessage);
  
  socket.addEventListener("error", function(event) {
    console.warn("Error", event);
  });
  
  socket.addEventListener("close", function(event) {
    console.warn("Connection closed", event);
    
    setTimeout(function() {
      console.log("Reconnecting");
      connect();
    }, 10 * second);
  });
}

function sendMessage(message) {
  console.log(`Sending the message "${message} (length: ${message.length})"`);

  if(message.length > maxMessageLength) {
    var splitIndex = maxMessageLength;

    for(char of [ " ", ".", "\n" ]) {
      var index = message.lastIndexOf(char, maxMessageLength - 1);
      if(index>=minMessageLength) splitIndex = index + 1;
    }

    sendMessage(message.substring(0, splitIndex).trim());
    sendMessage(message.substring(splitIndex).trim());
  } else {
    socket.send(`PRIVMSG #${channel} :${message}`);
  }
}


function onMessage(event) {
  const data = event.data;
  console.log(data.trim());

  if(data.includes("PING")) socket.send("PONG");

  if(data.includes("PRIVMSG")) {
    const contents = data.substring(data.indexOf(":", data.indexOf("PRIVMSG")) + 1).trim();

    if(contents.startsWith("!")) {
      const response = handleCommand(contents);
      if(response) sendMessage(response);
    }
  }
}


function handleCommand(command) {
  const currentGameIndex = Math.floor(( Date.now() - streamStartTime ) / gameDuration);

  switch(command.substring(1).toLowerCase().trim()) {
    case "game":
    case "current":
    case "currentgame":
    case "current game":
      if(currentGameIndex < 0) {
        return `The stream will start in ${formatTimeSpan(streamStartTime - Date.now())}`;
      } else if (currentGameIndex < games.length) {
        return `The current game is ${describeGame(games[currentGameIndex], "is")}`;
      } else {
        return `The stream is over. ${vodResponse}`;
      }
    
    case "next":
    case "nextgame":
    case "next game":
      if(currentGameIndex < games.length - 1) {
        const nextGameIndex = Math.max(currentGameIndex + 1, 0);
        const nextGameStartTime = streamStartTime + nextGameIndex * gameDuration; 

        return `The next game will be ${describeGame(games[nextGameIndex], "will be")}. It will start in ${formatTimeSpan(nextGameStartTime - Date.now())}`;
      } else if (currentGameIndex == games.length - 1) {
        return `This is the last game of the stream. ${vodResponse}`;
      } else {
        return `The stream is over. ${vodResponse}`;
      }
    
    case "last":
    case "lastgame":
    case "last game":
    case "previous":
    case "previousgame":
    case "previous game":
      if(currentGameIndex > 0) {
        const lastGameIndex = Math.min(currentGameIndex - 1, games.length - 1);
        
        return `The previous game was ${describeGame(games[lastGameIndex], "was")}.`;
      } else if (currentGameIndex == 0) {
        return `This is the first game of the stream`;
      } else {
        return `The stream will start in ${formatTimeSpan(streamStartTime - Date.now())}`;
      }
    
    case "cw":
    case "cws":
    case "content warning":
    case "content warnings":
    case "contentwarning":
    case "contentwarnings":
    case "tw":
    case "tws":
    case "trigger warning":
    case "trigger warnings":
    case "triggerwarning":
    case "triggerwarnings":
      if(currentGameIndex < 0) {
        return `The stream will start in ${formatTimeSpan(streamStartTime - Date.now())}`;
      } else if (currentGameIndex >= games.length) {
        return `The stream is over. ${vodResponse}`;
      } else {
        const game = games[currentGameIndex];
        const contentWarnings = game.contentWarnings;

        if(contentWarnings) {
          return `This game of ${game.name} has the following content warnings: ${contentWarnings}`;
        } else {
          return `There were no content warnings specified for this game of ${game.name}`;
        }
      }
    
    case "help":
    case "command":
    case "commands":
      return `You can use one of the following commands: ${commandsList}`;
    
    default:
      const response = staticCommandLookup[command.toLowerCase()];
      if(response) {
        return response;
      } else if(exclamationMarksRegex.test(command)) {
        return "!".repeat(Math.min(command.length * 2, 32));
      } else {
        return `I did not recognize the following command: "${command}", try one of these: ${commandsList}`;
      }
  }
}


function describeGame(game, willTense) {
  const gameAndLink = game.link ? `${game.name} which you can find over at ${game.link}` : game.name;
  const playersDescription = `${game.players.slice(0, -1).map(describePlayer).join(", ")} and ${describePlayer(game.players.at(-1))}`;
  const contentWarnings = game.contentWarnings ? `. This game has the following content warnings: ${game.contentWarnings}` : "";

  return `${gameAndLink} and ${willTense} facilitated by ${describePlayer(game.facilitator)} who is joined by ${playersDescription}${contentWarnings}`;
}


function describePlayer(player) {
  return player.pronouns ? `${player.name} (${player.pronouns})` : player.name;
}


function formatTimeSpan(span) {
  const days = Math.floor(span / ( hour * 24));
  const hours = Math.floor((span / hour) % 24);
  const minutes = Math.ceil(( span / minute ) % 60);

  const minutesText = minutes == 1 ? `1 minute` : `${minutes} minutes`;

  if(days > 1) {
    return `${days} days, ${hours} hours and ${minutesText}`;
  } else if(days == 1) {
    return `1 day, ${hours} hours and ${minutesText}`;
  } else if(hours > 1) {
    return `${hours} hours and ${minutesText}`;
  } else if(hours == 1) {
    return `1 hour and ${minutesText}`;
  } else {
    return minutesText;
  }
}


function repeat(command, period, offset) {
  // console.log(`Repeating the ${command} command every ${formatTimeSpan(period)}`);

  setTimeout(function() {
    // console.log(`Triggering ${command} command`);
    sendMessage(handleCommand(command));
    repeat(command, period, period);
  }, offset);
}

