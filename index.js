const WebSocket = require("ws");
const fs = require("fs");

const config = require("./config.json");

const second = 1000;
const minute  = 60 * second;
const hour = 60 * minute;

const streamStartTime = config.streamStart * second; //Epoch time that the stream starts, taken from https://hammertime.cyou/
const gameDuration = config.gameDuration * second;

// const streamStartTime = Date.now() + 2 * minute;
// const gameDuration = 2 * hour;

function loadCsv(path, columns) {
  return fs.readFileSync(path).toString()
        .split("\n")
        .splice(1, config.numberOfGames)
        .map(line => line.split(";").map(str => str.trim()))
        .filter(items => items.length >= columns);
}

const games = 
  loadCsv(config.gamesLocation, 3)
  .map(items => ({ name: items[0], link: items[1], players: items[2] }));

const staticCommands =
  loadCsv(config.staticCommandsLocation, 3)
  .map(items => ({ command: items[0], altCommands: items[1].split(",").filter(str => str), response: items[2] }));

const staticCommandLookup =
  Object.fromEntries(staticCommands.flatMap(command => command.altCommands.concat([ command.command ]).map(str => [ str.toLowerCase(), command.response ])));

const vodResponse = staticCommandLookup["vod"];

const commandNames = [ "!game", "!next" ].concat(staticCommands.map(item => item.command));
const commandsList = `${commandNames.slice(0, -1).join(", ")} or ${commandNames.at(-1)}`;

console.log("Games", games);
console.log("Static commands", staticCommands);

const socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

socket.addEventListener("open", function() {
  //Authenticate and join the channel
  socket.send(`PASS oauth:${config.oAuth}`);
  socket.send(`NICK ${config.nick}`);
  socket.send(`JOIN #${config.channel}`);

  // sendMessage("Bot started!");
});


socket.addEventListener("message", function(event) {
  const data = event.data;
  console.log(data);

  if(data.includes("PING")) socket.send("PONG");

  if(data.includes("PRIVMSG")) {
    const contents = data.substring(data.indexOf(":", data.indexOf("PRIVMSG")) + 1).trim();

    if(contents.startsWith("!")) {
      const response = handleCommand( contents);
      sendMessage(response);
    }
  }
});


function sendMessage(message) {
  socket.send(`PRIVMSG #${config.channel} :${message}`);
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
        return `The current game is ${describeGame(games[currentGameIndex])}`;
      } else {
        return `The stream is over. ${vodResponse}`;
      }
    
    case "next":
    case "nextgame":
    case "next game":
      if(currentGameIndex < games.length - 1) {
        const nextGameIndex = Math.max(currentGameIndex + 1, 0);
        const nextGameStartTime = streamStartTime + nextGameIndex * gameDuration; 

        return `The next game will be ${describeGame(games[nextGameIndex])}. It will start in ${formatTimeSpan(nextGameStartTime - Date.now())}`;
      } else if (currentGameIndex == games.length - 1) {
        return `This is the last game of the stream. ${vodResponse}`;
      } else {
        return `The stream is over. ${vodResponse}`;
      }
    
    case "help":
      return `You can use one of the following commands: ${commandsList}`;
    
    default:
      const response = staticCommandLookup[command];
      if(response) {
        return response;
      } else {
        return `I did not recognize the following command: "${command}", try one of these: ${commandsList}`;
      }
  }
}


function describeGame(game) {
  if(game.link) {
    return `${game.name} which you can find over at ${game.link} and is being played by ${game.players}`;
  } else {
    return `${game.name} and is being played by ${game.players}`;
  }
}


function formatTimeSpan(span) {
  const days = Math.floor(span / ( hour * 24));
  const hours = Math.floor((span / hour) % 24);
  const minutes = Math.ceil(( span / minute ) % 60);

  if(days > 1) {
    return `${days} days, ${hours} hours and ${minutes} minutes`;
  } else if(days == 1) {
    return `1 day, ${hours} hours and ${minutes} minutes`;
  } else if(hours > 1) {
    return `${hours} hours and ${minutes} minutes`
  } else if(hours == 1) {
    return `1 hour and ${minutes} minutes`
  }  else {
    return `${minutes} minutes`
  }
}
