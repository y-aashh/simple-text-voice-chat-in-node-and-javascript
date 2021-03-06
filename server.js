const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const moment = require('moment');
const wav = require('wav');
const path = require('path');
// Next line should be commented off if you are using Lame to convert wav files to mp3.
// const Lame = require("node-lame").Lame;


// Look in your server's httpd.conf file to find the correct settings for the server certificate and key 
const server = new https.createServer({
  cert: fs.readFileSync('/var/cpanel/ssl/apache_tls/example.com/combined'),
  key: fs.readFileSync('/var/cpanel/ssl/apache_tls/example.com/combined')
});
const wss = new WebSocket.Server({ server });
const port = '8089';
const audioNumPath = path.relative(__dirname, 'audionum.txt');
var fileWriter = null;
var fileWriterOn = 0;
var audioNum = 1; 

if (fs.existsSync(audioNumPath))
{	
	audioNum = fs.readFileSync(audioNumPath,'utf-8');
}

wss.on('connection', function connection(ws) 
{
	ws.on('message', function incoming(message) 
	{
		if (Buffer.isBuffer(message))
		{
			var msg = new Uint8Array(message);
			wss.clients.forEach(function (client) 
			{
				if (client !==ws && client.readyState == WebSocket.OPEN) 
				{
					// Send wav blob, except to person who is talking
					client.send( msg );
				}
			});
			fileWriter.write(Buffer.from(msg.subarray(44)));
		}
		else
		{
			if (message.length > 0)
			{
				var position = message.indexOf("|");
				if (position == -1)
				{
					msg = message;
				}
				else
				{
					var name = message.substr(0, position);
					var text = message.substr(position + 1);
					var date = new Date();
					var wrapped = moment(date);
					var datetime = wrapped.format('M/D/YYYY, h:mm:ss a');
					var audioMsg;
					if (text == '<++>')
					{
						// This occurs if a client turned microphone on
						if (fileWriterOn == 1)
						{
							// Here someone turned microphone on while someone else had microphone on.
							msg = "<p>" + name + " is responding...</p>";
						}
						else
						{
							// Somebody has turned on microphone so start wav file.
							msg = "<p>" + name + " is talking...</p>";
							fileWriter = new wav.FileWriter(audioNum + '.wav' , 
							{
								channels: 1,
								sampleRate: 44100,
								bitDepth: 16						
							});
							fileWriterOn = 1;
							// Save the audioNum to disk to that wav files from previous chats won't interfere.
							fs.writeFile(audioNumPath, audioNum, 'utf-8', function(err) 
							{
								if(err) 
								{
									return console.log(err);
								}
							});
						}
					}
					else 
					{
						if (text == '<-->')
						{
							// Someone has turned microphone off.
							fileWriter.end();
							// If you are using Lame to convert file to mp3, then repl "wav" in next line with "mp3".
							msg = "<p><audio controls preload='none'><source src='" + audioNum + ".wav'  type= 'audio/wav'></audio></p>\n";
							fileWriterOn = 0;
							//  Next lines should *not* be commented off if you are using Lame to convert wav to mp3:
							/*
							var wavPath = path.relative(__dirname, audioNum + '.wav');
							var mp3Path = path.relative(__dirname, audioNum + '.mp3');
							encoder = new Lame(
							{
							  	output: mp3Path,
							  	bitrate: 192
							}).setFile( wavPath );
							encoder.encode().then(() => 
							{
							  	fs.unlink(wavPath, function(err) 
							  	{
							  		if(err) 
							  		{
							  			return console.log(err);
							  		}
							  	});
							}).catch(error => 
							{
							  	return console.log(error);
							});
							*/
							audioNum++;
							fs.writeFile(audioNumPath, audioNum, 'utf-8', function(err) 
							{
								if(err) 
								{
									return console.log(err);
								}
							});
						}
						else
						{
							text = text.replace(/&quot;/g, "\"");
							msg = "<p>" + name + ", " + datetime + "<blockquote>" + text + "</blockquote>";
						}
					}
				}
				wss.clients.forEach(function (client) 
				{
					if (client.readyState == WebSocket.OPEN) 
					{
						// Send text message to all clients
						client.send( msg );
					}
				});
			}
		}
	});
});

// Commands such as this can be used in debugging: 
console.log ( 'audioNum: |%s|', audioNum );

server.listen( port );

