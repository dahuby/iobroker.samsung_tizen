// upgraded version made by ioBroker Forum User HighPressure
// Feel free to adopt, modify and distribute my changes

/**
 *
 * samsung2016 adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "template",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js template Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@template.com>"
 *          ]
 *          "desc":         "template adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.adapter('samsung2016');

const webSocket = require('ws');
const wol = require('wake_on_lan');
const req = require('request-promise');

// config params

var sendKey = function(key, done) {
      const protocol = adapter.config.protocol;
      const ipAddress = adapter.config.ipAddress;
      const app_name_base64 = (new Buffer("ioBroker")).toString('base64');
      const port = parseFloat(adapter.config.port);
      const token = parseFloat(adapter.config.token);
      let wsUrl;
      if (token === 0) {
      wsUrl = protocol + '://' + ipAddress + ':' + port + '/api/v2/channels/samsung.remote.control?name=' + app_name_base64;  
      }
      if (token > 0) {
      wsUrl = protocol + '://' + ipAddress + ':' + port + '/api/v2/channels/samsung.remote.control?name=' + app_name_base64 + '&token=' + token;
      }
      adapter.log.info("Try to open a websocket connection to " + wsUrl);
      var ws = new webSocket(wsUrl, function(error) {
        done(new Error(error));
      });
      ws.on('error', function (e) {
        adapter.log.info('Error in sendKey WebSocket communication');
        done(e);
      });
      ws.on('message', function(data, flags) {
        var cmd =  {"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":key,"Option":"false","TypeOfRemote":"SendRemoteKey"}};
        data = JSON.parse(data);
        if(data.event == "ms.channel.connect") {
          adapter.log.info('websocket connect');
          ws.send(JSON.stringify(cmd));
          setTimeout(function() {
            ws.close(); 
            adapter.log.info('websocket closed');
          }, 1000);
          done(0);
        }
      });
};

var wake = function(done) {
      var macAddress = adapter.config.macAddress;
      adapter.log.info("Sending wol command");
      wol.wake(macAddress, function(error) {
        if (error) { done(1); }
        else{ 
			done(0); 
		}
      });
};

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});




// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
    
    // Switch TV on or off
    if ( id == 'samsung2016.0.Power') {
        if(state.val && !state.ack || state.val == "on" && !state.ack) {
			//first try traditional power on key, in case of short standby
			sendKey('KEY_POWER', function(err) {
                  if (err) {
                      adapter.log.info("Got error:" + err);
                  }
              });  
            adapter.log.info("Will now try to switch TV on.");
            wake(function(err) {
                console.log ("Switch SamsungTV on returned with " + err);     
            });
			
        }
		if(!state.val && !state.ack || state.val == "off" && !state.ack) {
            adapter.log.info("Will now try to switch TV off");
              
            sendKey('KEY_POWER', function(err) {
                 adapter.log.info("Sending Power Key");
                  if (err) {
                      adapter.log.info("Got error:" + err);
                  } else {
                      // command has been successfully transmitted to your tv
                      adapter.log.info('successfully powered off tv');
					  //adapter.setState("Power", "off", false);
                  }
              });  
        }
    }
    
    //Send a key to TV
    
    if ( id == 'samsung2016.0.sendKey') {       
        adapter.log.info("Will now send key " + state.val + " to TV");
          
        sendKey(state.val, function(err) {
                 adapter.log.info("Sending Key");
                  if (err) {
                      adapter.log.info("Got error:" + err);
                  } else {
                      // command has been successfully transmitted to your tv
                      adapter.log.info('successfully sent key');
                  }
         });    
          
     }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});





function main() {

    adapter.setObject('Power', {
        type: 'state',
        common: {
            name: 'Power',
            type: 'boolean',
            role: 'button'
        },
        native: {}
    });
    
    adapter.setObject('sendKey', {
        type: 'state',
        common: {
            name: 'sendKey',
            type: 'string',
            role: 'state'
        },
        native: {}
    });
	
    adapter.setObject('PowerOn', {
        type: 'state',
        common: {
            name: 'sendKey',
            type: 'boolean',
            role: 'state'
        },
        native: {}
    });    
    
    adapter.subscribeStates('*');

    
    adapter.on('Power', function() {
        adapter.log.info("on TvOn");
    });
    adapter.log.info('config protocol : ' + adapter.config.protocol);
    adapter.log.info('config ip address  : ' + adapter.config.ipAddress);
    adapter.log.info('config port  : ' + adapter.config.port);
    adapter.log.info('config token  : ' + adapter.config.token);
    adapter.log.info('config mac address : ' + adapter.config.macAddress);
    adapter.log.info('config pollingPort : ' + adapter.config.pollingPort);
    adapter.log.info('config pollingInterval : ' + adapter.config.pollingInterval);
	
    const pollingPort = parseFloat(adapter.config.pollingPort);
    const pollingInterval = parseFloat(adapter.config.pollingInterval);
    const ipAddress = adapter.config.ipAddress;
    if (pollingPort > 0) 
    {
	    setInterval(function(){ 
		    rp({uri:'http://' + ipAddress + ':' + pollingPort, timeout:10000})
    			.then(
				adapter.log.info('TV state OK');
              			adapter.setState('PowerOn', true, true, function (err) {
              				// analyse if the state could be set (because of permissions)
               				if (err) adapter.log.error(err);
              			});
		    	)
    			.catch(function (error) {       	      
				adapter.log.info(error);
				adapter.log.info('TV state NOK');
              			adapter.setState('PowerOn', false, true, function (err) {
              				// analyse if the state could be set (because of permissions)
               				if (err) adapter.log.error(err);
              			});
	    }, pollingInterval * 1000)
    
    }
}
