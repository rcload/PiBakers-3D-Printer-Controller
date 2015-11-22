var express = require('express'),
    fs = require('fs-extra'),
    bodyParser = require('body-parser'),
    exec = require('child_process').exec,
    execSync = require('child_process').execSync,
    spawn = require('child_process').spawn,
    ws = require('ws'),
    http = require('http'),
    request = require('request'),
    formidable = require('formidable'),
    url = require('url'),
    util = require('util');


// misc functions

// If there's no startsWith method on the string class, add it
if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.lastIndexOf(str, 0) === 0;
  };
}


// Populate with default settings
// If a config file exists, it will override these
var settings = {
    'is_server'         : false,
    'locked'            : false,
    'log'               : true,
    'slicing_server'    : undefined,
    'printer_name'      : undefined,
    'slicer_path'       : './bin/slic3r/bin/slic3r',
    'interpreter_path'  : './../interp.py',
    'config_path'       : 'data/pconfig.ini',
    'port'              : 8080
}

// Contains an in-memory list of the connected printers
// The data file should be written whenever this is updated
var connectedPrinters = [];

// Stores the number of downloads that have been completed this run. This
// is used to generate new filenames to download as.
var downloadNumber = 0;

// Is there a print job goin on right now? If there is, make sure no new jobs are accepted.
var currentlyPrinting = false;

// The directory where uploaded files will be downloaded to
var tmpdir = __dirname + '/tmp/';

// Save status of connected printers
var statusMap = {};

// Current status of the printer
// 0 -> OK / No status
// 1 -> Begin slicing
// 2 -> Sending gcode to the printer
// 3 -> Printing has started
// 4 -> Done Printing
// 101 -> Error slicing
// 102 -> Error forwarding gcode to printer
// 103 -> Error connecting to printer
var statusNum = 0,
    statusTime = new Date();

// Load the inital printer list
loadPrinterList();

// Read in the config file synchronously, so that it's guaranteed to finish
// before the server is created.
if (fs.existsSync('data/config')) {

    // If the file exists, read it's contents
    // If it doesn't exist, there's no need to do anything
    data = fs.readFileSync('data/config', 'utf8');

    var tok = data.split(/\n+/);

    // If there was trailing whitespace, remove the empty element
    if (tok.length > 0 && tok[tok.length-1] == '')
        tok.pop();

    // tok is split on lines right now, split into key/value tokens
    // Regex splits on first word (no special chars) - rest of line
    var tmptok = [],
        rgx = /([\w+\/]+)\s+([^\0]+)/;

    for (var i in tok) {
        var matches = rgx.exec(tok[i]);

        if (matches != undefined) {
            for (var j = 1; j < matches.length; ++j) {
                tmptok.push(matches[j]);
            }
        }
    }

    tok = tmptok;

    if (tok.length < 2) return;

    for (var i = 0; i < tok.length; i += 2) {

        var key = tok[i].trim().toLowerCase(),
            valueTxt = tok[i+1].trim().toLowerCase()
            value = undefined;

        switch (key) {
            case 'is_server':
            case 'locked':
            case 'log':
                value = toBool(valueTxt);
                break;

            case 'slicing_server':
                value = fixupURL(valueTxt);
                break;

            case 'slicer_path':
            case 'interpreter_path':
            case 'printer_name':
                value = valueTxt;
                break;

            case 'port':
                value = parseInt(valueTxt);

                if (value == NaN) {
                    console.log('Error parsing port value.');
                    value = undefined;
                }

                break;

            default:
                break;
        }

        if (value == undefined) {
            console.log('Unexpected config entry ' + key + ', ' + valueTxt);
            continue;
        }

        console.log('Setting ' + key + ' = ' + value + ' set');

        settings[key] = value;
    }
}


var app = express();
app.use(bodyParser.json());

// Serve different content based on whether this is acting as the printer interface
// or a managment server. Shared content can be accessed either way by placing it in
// the /share path
if (settings['is_server']) {
    app.use(express.static(__dirname + '/public/server/'));
}
else {
    app.use(express.static(__dirname + '/public/client/'));
}
app.use('/share', express.static(__dirname + '/public/share/'));

if (settings['log']) {
    console.log('Express server created.');
}


var validModelFormats = ['stl', 'obj', 'amf'];

function setStatus(num) {
    statusNum = num;
    statusTime = new Date();
}

// Update status of all connected printers
function updateAllStatus() {

    for (var i in connectedPrinters) {
        updateStatus(connectedPrinters[i].name);
    }

}

function updateStatus(printerName) {

    request({
        url: fixupURL(lookupIP(printerName) + '/api/getstatus'),
        json: true
    }, function (err, resp, body) {

        if (!err && resp.statusCode === 200) {
            statusMap[printerName] = {status: body.status, text : body.text, time : new Date(body.time)};
        }
        // Couldn't connect to the printer
        else {
            statusMap[printerName] = {status : 103, text : lookupStatus(103), time : new Date()}
        }

        // console.log(printer.name, statusMap[printer.name]);
    });

}

// Add http:// to the beginning of the url if needed
// If it begins with https:// return an undefined url, since secure connections are not supported
function fixupURL(o_url) {

    if (o_url == undefined) {
        return undefined;
    }

    var new_url = o_url;

    if (new_url.startsWith('https://')) {

        if (settings['log']) {
            console.log('https url\'s are not supported.');
        }

        return undefined;
    }

    if (!new_url.startsWith('http://')) {
        new_url = 'http://' + new_url;
    }

    // if (new_url.slice(0, 'https://'.length) == 'https://') {

    //     if (settings['log']) {
    //         console.log('https url\'s are not supported.');
    //     }

    //     return undefined;
    // }

    // if (new_url.slice(0, 'http://'.length) != 'http://') {
    //     new_url = 'http://' + new_url;
    // }

    return new_url;
}

// Converts any reasonable boolean value as a string to a boolean
function toBool(string) {

    if (string == undefined) {
        return undefined;
    }

    switch (string.toLowerCase()) {
        case 'true': case 'yes': case '1':
            return true;
        case 'false': case 'no': case '0':
            return false;
        default:
            return undefined;
    }

    return undefined;
}

function getFileExtension(filename) {

    if (filename == undefined) {
        return undefined;
    }

    if (filename.indexOf('.') == -1) {
        return undefined;
    }

    return filename.substring(filename.lastIndexOf(".")).toLowerCase();
}

// Populates the list of printers/ip addresses from the data/printers file
// if the file does not exist, the application does nothing.
function loadPrinterList() {
    fs.exists('data/printers', function(exists) {
        // If the file exists, read it's contents
        // If it doesn't exist, there's no need to do anything
        if (exists) {
            fs.readFile('data/printers', 'utf8', function(err, data) {
                var tok = data.split(/\s+/);

                // If there was trailing whitespace, remove the empty element
                if (tok.length > 0 && tok[tok.length-1] == '') {
                    tok.pop();
                }

                connectedPrinters = [];

                if (tok.length < 2) {
                    return;
                }

                for (var i = 0; i < tok.length; i += 2) {
                    connectedPrinters.push({name: tok[i], ip: tok[i+1]});
                }
            });
        }
    });
}

// Write the connectedPrinters array to disk
// TODO: Do I need to create a lock to ensure the file isn't written multiple times at the same time?
function writeConnectedPrinters() {

    var toWrite = '';

    for (var i in connectedPrinters) {
        toWrite += connectedPrinters[i].name + ' ' + connectedPrinters[i].ip + '\n';
    }

    fs.writeFile('data/printers', toWrite);
}

// Given a printer name, return the corresponding IP address, or undefined if it is not registered
function lookupIP(name) {

    for (var i in connectedPrinters) {
        if (name === connectedPrinters[i].name) {
            return connectedPrinters[i].ip;
        }
    }

    return undefined;
}

// Sends the model at filepath to the server at s_url
function forwardModel(filepath, s_url, retryAttempts, optionalFormData) {

    // Validate necessary parameters

    if (filepath != undefined) filepath = filepath.trim();

    if (filepath == undefined) {

        if (settings['log']) {
            console.log('No filepath specified, failed for forward model.');
        }

        return;
    }

    if (s_url != undefined) s_url = s_url.trim();

    if (s_url == undefined || s_url == '') {

        if (settings['log']) {
            console.log('No filepath specified, failed for forward model.');
        }

        return;
    }

    var formData = {
        model: fs.createReadStream(filepath)
    }

    // Set values based on optional parameters
    
    if (retryAttempts == undefined) {
        retryAttempts = 0;
    }

    if (optionalFormData != undefined) {

        for (i in optionalFormData) {
            formData[i] = optionalFormData[i];
        }

    }

    var new_url = s_url + '/api/modelupload';

    // TODO: Can I replace with fixupURL?
    if (!s_url.startsWith('http://')) {
        new_url = 'http://' + new_url;
    }

    setStatus(2);

    request.post({
        url: new_url,
        formData: formData
    }, function(err, resp, body) {

        if (err == null) {

            if (settings['log']) {
                console.log('Model sent to ' + s_url);
            }

            fs.unlinkSync(filepath);
        }
        else {

            if (settings['log']) {
                if (retryAttempts <= 0) {
                    console.log('Error sending model to ' + s_url);
                    console.log(err);

                    setStatus(102);
                    // fs.unlinkSync(filepath); // TODO: revert eventually
                }
                else {
                    forwardModel(filepath, s_url, retryAttempts - 1);
                }
            }
        }
    });
}

// It's okay for download names to conflict between runs, since the only reason to keep unique names
// is so that potentially simultanious actions don't stomp on each other.
function getDownloadName() {

    var ret = 'download_' + downloadNumber;
    downloadNumber += 1;

    return ret;
}

// Downloads the file from d_url and sends it to /api/modelupload of s_url
function downloadAndProcess(d_url, s_url) {
    var options = {
        host: url.parse(d_url).host,
        port: 80,
        path: url.parse(d_url).pathname
    }

    // Generate a new unique file name (unique for this run, not )
    var file_name = getDownloadName() + getFileExtension(url.parse(d_url).pathname.split('/').pop());
    var file = fs.createWriteStream(tmpdir + file_name);

    // Download the file and write it to disk in the temp directory
    http.get(options, function(res) {
        res.on('data', function(data) {

            file.write(data);

        }).on('end', function() {

            file.end();

            if (settings['log']) {
                console.log(tmpdir + file_name + ' downloaded, transfering to /api/modelupload');
            }

            // Send the model to s_url
            forwardModel(tmpdir + file_name, s_url, 3, {type: 0});
        
        });
    });
}

function getPortNumber(url) {
    var port = 80;

    if (url.lastIndexOf(":") != -1) {
        port = parseInt(url.substring(url.lastIndexOf(":") + 1));
    }

    return port;
}

function getHostName(url) {
    if ((url+'').startsWith('http://')) url = url.substring(7);

    var hostStr = url;

    if (url.lastIndexOf(":") != -1) {
        hostStr = url.substring(0, url.lastIndexOf(":"));
    }

    return hostStr;
}

// Queries the printer at printerIP for its configuration. Executes callback with the filename
// if it was able to retrieve the configuration.
function getPrinterConfig(printerIP, callback) {

    var port = getPortNumber(printerIP),
        hostStr = getHostName(printerIP);

    var options = {
        host: hostStr,
        port: port,
        path: '/api/getconfig'
    }

    // Generate a new unique file name (unique for this run, not )
    var file_name = getDownloadName() + '.ini';
    var file = fs.createWriteStream(tmpdir + file_name);

    // Download the file and write it to disk in the temp directory
    http.get(options, function(res) {
        res.on('data', function(data) {

            file.write(data);

        }).on('end', function() {

            file.end();

            if (settings['log']) {
                console.log('Config file ' + tmpdir + file_name + ' downloaded');
            }

            // If there's a callback, call it with the newly downloaded model
            if (callback != undefined) {
                callback(tmpdir + file_name);
            }
        
        });
    });
}

function kickoffPrint(filename) {

    if (currentlyPrinting) {

        if (settings['log']) {
            console.log('Another print process is currently executing. Please wait for it to complete before starting a new job.');
        }

        return;
    }

    currentlyPrinting = true;
    setStatus(3);

    exec('python ' + settings['interpreter_path'] + ' ' + filename, {maxBuffer: 1000*1024} , function(error, stdout, stderr) {
        
        if (error != '') {
            console.log(stdout);
        }
        else {
            console.log('Error invoking interpreter');
        }

        currentlyPrinting = false;
        setStatus(4);
    });
}

// Returns a sanitized version of the passed in name
// if it is invalid and unfixable, return false
function validateAndSanitizePrinterName(name) {

    if (name == undefined) {
        return undefined;
    }

    name = name.replace(/[^a-z0-9_\-. ]/gi, '');

    if (name == ''          ||
        name.length > 20) {

        return undefined
    }

    return name;
}

function lookupStatus(number) {
    switch(number) {
        case 0: return "Okay";
        case 1: return "Model is being sliced";
        case 2: return "Sending gcode to printer";
        case 3: return "Printing has started";
        case 4: return "Done printing";
        case 101: return "Error slicing uploaded model";
        case 102: return "Error forwarding gcode to printer";
        case 103: return "Error connecting to printer";
        default: 
            console.log('Unknown Status: ' + number)
            return "";
    }

}

app.route('/api/getconfig')
    .get(function(req, res, next) {

        // Only printers have an associated configuration
        if (settings['is_server']) {
            res.end();
            return;
        }

        if (!fs.existsSync('data/pconfig.ini')) {
            res.end();
            return;
        }
        
        data = fs.readFileSync('data/pconfig.ini', 'utf8');

        res.end(data);
    });

// Gets the current status if no printer name sent
// Otherwise gets the most recent status between this device and printer
app.route('/api/getstatus')
    .get(function(req, res, next) {

        // Current status on this device
        var statusTextSend = lookupStatus(statusNum),
            statusNumSend = statusNum,
            statusTimeSend = statusTime;

        // Status on device targeted
        if(req.query.printerName != undefined) {

            var queryStatus = statusMap[req.query.printerName];

            if (queryStatus != undefined) {

                // console.log('status compare ' + req.query.printerName);
                // console.log('on server: ', statusTime);
                // console.log('on printer: ', queryStatus.time);

                // TODO: Verify that this correctly ranks times
                // If the queried printer's status is newer than ours, use it instead
                if (queryStatus.time > statusTimeSend) {
                    statusTextSend = queryStatus.text;
                    statusNumSend = queryStatus.status;
                    statusTimeSend = queryStatus.time;
                }
                // Otherwise don't do anything
            }
            // Could not find known status for target printer
            // Tell it to refresh and just send back our status
            else {
                updateStatus(req.query.printerName);
            }
        }

        // res.end();
        res.json({status : statusNumSend, text : statusTextSend, time : statusTimeSend});
    });

// Returns an object with one param: ip, which contains the ip address the request was made from
app.route('/api/getip')
    .get(function(req, res, next) {

        res.json({ip: req.connection.remoteAddress});
        next();

    });

// Returns, as JSON, the list of possible print targets and whether editing is currently locked.
app.route('/api/getprinters')
    .get(function(req, res, next) {

        if (!settings['locked']) {
            res.json({printers : connectedPrinters, locked : settings['locked']});
        }

        // If our server is locked, remove ip addresses since they cannot be used by the client anyway
        // This does involve a lot more processing, but it is probably worth it for security
        else {

            var ret = [];

            for (var i in connectedPrinters) {
                ret.push({name: connectedPrinters[i].name, ip: ''})
            }

            res.json({printers : ret, locked : settings['locked']});
        }

        next();
    });

// Accepts a new printer name/IP pair as JSON and adds it to the internal list
app.route('/api/regprinter')
    .post(function(req, res, next) {

        var pName = validateAndSanitizePrinterName(req.body.printerName),
            pIP = req.body.printerIP.trim();

        if (settings['locked']) {

            res.status(400)
            res.end('Cannot add printer record. The server list is locked.');
            return;
        }

        if (pName == undefined) {

            res.status(400);
            res.end('Invalid name provided.');
            return;
        }

        if (pIP != undefined) pIP = pIP.trim();

        if (pIP == undefined || pIP == '') {

            res.status(400);
            res.end('No printer IP or URL provided.');
            return;
        }        

        if (settings['log']) {
            console.log('Registering printer {name: ' + pName + ', ip: ' + pIP + '}');
        }

        // Check to see if this printer conflicts with any printers already registered
        for (var i in connectedPrinters) {
            if (connectedPrinters[i].name == pName) {

                if (settings['log']) {
                    console.log('Printer name already in use {name: ' + pName + ', ip: ' + pIP + '}');
                }

                res.status(400);
                res.end('Printer name already in use.');
                return;
            }

            if (connectedPrinters[i].ip == pIP) {

                if (settings['log']) {
                    console.log('IP address already registered {name: ' + pName + ', ip: ' + pIP + '}');
                }

                res.status(400);
                res.end('Printer is already registered, but is named ' + connectedPrinters[i].name + '.');
                return;
            }
        }

        connectedPrinters.push({name: pName, ip: pIP});
        writeConnectedPrinters();

        if (settings['log']) {
            console.log('Successfully registered printer {name: ' + pName + ', ip: ' + pIP + '}');
        }

        res.end();
    });

app.route('/api/editprinter')
    .post(function(req, res, next) {

        var npName = validateAndSanitizePrinterName(req.body.newPrinterName),
            opName = validateAndSanitizePrinterName(req.body.oldPrinterName),
            pIP = req.body.printerIP;

        if (settings['locked']) {
            res.status(400);
            res.end('Cannot edit printer record. The server list is locked.');
            return;
        }

        // Validate inputs
        if (opName == undefined) {
            res.status(400);
            res.end('Printer "' + req.body.oldPrinterName + '" does not exist, cannot change it.');
            return;
        }

        if (npName == undefined) {
            res.status(400);
            res.end('Invalid name, cannot change printer to ' + req.body.newPrinterName);
            return;
        }


        if (pIP != undefined) pIP = pIP.trim();

        if (pIP == undefined || pIP == '') {
            res.status(400);
            res.end('Invalid IP address "' + req.body.printerIP + '" provided.');
            return;
        }

        // Find the printer whos record needs to be changed
        for (var i in connectedPrinters) {
            if (connectedPrinters[i].name == opName) {

                connectedPrinters[i].name = npName;
                connectedPrinters[i].ip = pIP;

                // Switch the entries in the status map
                statusMap[npName] = statusMap[opName];
                delete statusMap[opName];

                writeConnectedPrinters();

                if (settings['log']) {
                    console.log(opName + ' updated to (' + npName + ', ' + pIP + ')');
                }

                res.end(opName + ' updated.');
                return;
            }

        }

        // We should only get here if a printer that didn't exist was trying to be edited
        res.status(400);
        res.end("Can't edit a printer that doesn't exist!");
        return;

    });


// Removes a printer with the name sent
app.route('/api/delprinter')
    .post(function(req, res, next) {
        
        var pName = validateAndSanitizePrinterName(req.body.printerName);

        if (pName == undefined) {

            res.status(400);
            res.end('Invalid printer name provided.');
            return;

        }

        if (settings['locked']) {

            res.status(400);
            res.end('Cannot remove printer record. The server list is locked.');
            return;

        }

        // Find this printer name in the internal list. It is guaranteed to be unique, if it exists.
        for (var i in connectedPrinters) {
            if (connectedPrinters[i].name === pName) {

                // Remove this element from the list
                connectedPrinters.splice(i, 1);

                // Write the file to disk and close the connection
                writeConnectedPrinters();

                res.end('The printer has been removed.');
                return;
            }
        }

        // If we got here, there printer deleted does not exist
        res.status(400);
        res.end("Can't delete a printer that doesn't exist!");
        return;

    });

app.route('/api/configupload')
    .post(function(req, res, next) {
        var form = new formidable.IncomingForm();
        form.uploadDir = tmpdir;

        form.parse(req, function(err, fields, files) {

            if (files == undefined || files.configfile == undefined) {
                res.status(400);
                res.end('No file provided');
                return;
            }


            var filepath = files.configfile.path,
                filename = files.configfile.path;

            // Currently filename is a full path, remove the path (need to cover windows and unix style paths)
            if (filename.lastIndexOf('/') != -1) {
                filename = filename.substring(filename.lastIndexOf('/') + 1);
            }
            if (filename.lastIndexOf('\\') != -1) {
                filename = filename.substring(filename.lastIndexOf('\\') + 1);
            }

            var filext = getFileExtension(files.configfile.name);

            if (filext != '.ini') {
                res.status(400);
                res.end('Invalid filetype (must be ini)');
            }

            // Assume the configuration was valid (TODO: add verification)

            // Move to the final config path (there can only be one config at a time)
            fs.renameSync(files.configfile.path, settings['config_path']);

            res.end('Successfully uploaded configuration');
        });
    });

// Handle uploading posted models, or routing g-code
// Behavior:
// target-type: 0 (file upload)
//      target defined: look-up target, print to that IP
//      target undefined: attempt to print (file must be g-code)
// target-type: 1 (url upload)
//      url: must be the url to download from
//      target defined: download the model and send it to the ip-address associated with target
//      target undefined: download the model and attempt to print it (must be g-code)
app.route('/api/modelupload')
    .post(function(req, res, next) {

        if (settings['log']) {
            console.log('/api/modelupload is being posted to.');
        }

        var form = new formidable.IncomingForm();
        form.uploadDir = tmpdir;

        form.parse(req, function(err, fields, files) {

            var pIP = lookupIP(validateAndSanitizePrinterName(fields.target));

            // If this is a URL-based upload, download the file and re-call /api/modelupload with the file
            if (fields != undefined && fields.type == 1) {

                if (fields.url == undefined || fields.url.trim() == '') {
                    res.status(400);
                    res.end('No URL provided.');
                    return;
                }

                if (pIP != undefined) {
                    downloadAndProcess(fields.url, pIP);
                }
                else {
                    downloadAndProcess(fields.url, 'localhost:' + settings['port']);
                }

                res.end('The download has started.');
                return;
            }

            // Verify a file was actually uploaded
            if (files == undefined || files.model == undefined || files.model.path == undefined) {

                if (settings['log']) {
                    console.log('No file uploaded.');
                }

                res.status(400);
                res.end('No file provided.');
                return;

            }

            var filepath = files.model.path,
                filename = files.model.path;

            if (settings['is_server'] && pIP == undefined) {

                if (settings['log']) {
                    console.log('IP address is undefined {target: ' + fields.target + ', file: ' + filepath + '}');
                }

                fs.unlinkSync(filepath);

                res.status(400);
                res.end('Printer is not registered with the server');
                return;

            }

            // Currently filename is a full path, remove the path (need to cover windows and unix style paths)
            if (filename.lastIndexOf('/') != -1) {
                filename = filename.substring(filename.lastIndexOf('/') + 1);
            }
            if (filename.lastIndexOf('\\') != -1) {
                filename = filename.substring(filename.lastIndexOf('\\') + 1);
            }

            var filext = getFileExtension(files.model.name),
                typeCheck = 0;

            if (filext == undefined) {

                if (settings['log']) {
                    console.log('No file extension found {target: ' + fields.target + ', ip: ' + pIP + ', filename: ' + files.model.name + '}');
                }

                fs.unlinkSync(filepath);

                res.status(400);
                res.end('Invalid filename. Either too short or no extension');
                return;
            }

            // Is this an unsliced 3D model that we can convert?
            for (var i in validModelFormats) {
                if (('.' + validModelFormats[i]) === filext) {
                    typeCheck = 1;
                }
            }

            if ('.gcode' === filext || '.g' == filext) {
                typeCheck = 2;
            }

            // If it's not a valid model format or a gcode file, ignore it
            if (typeCheck == 0) {

                fs.unlinkSync(filepath);

                res.status(400);
                res.end('The uploaded file is not a supported type.');
                return;
            }

            if (settings['log']) {

                if (settings['is_server']) {
                    console.log('Uploaded file to server {target:' + fields.target + ', ip: ' + pIP + ', name: ' + files.model.name + ', renamed: ' + filename + ', type: ' + typeCheck + '}');
                }
                else {
                    console.log('Uploaded file to printer {target: '+ fields.target + ', name: ' + files.model.name + ', renamed: ' + filename + ', type: ' + typeCheck + '}')
                }
            }

            // Give the file its original extension, if we've determined it's safe
            fs.renameSync(files.model.path, tmpdir + filename + filext);
            filepath = tmpdir + filename + filext;

            // TODO: This process is not necessarilly fast. It may take longer
            // than the timeout period for the http response. Current idea: open
            // a websocket with the client here, register a callback for when the slicing
            // process finishes to send the result (success/failure) to the client

            // If the file is an unsliced 3D model, try to slice it
            if (typeCheck == 1) {

                if (!settings['is_server']) {

                    // If this is a printer and a non-sliced model was uploaded, and a slicing_server has been defined, use
                    // the slicing server to slice this model. Otherwise, we can't really do anything, so return an error.
                    if (settings['slicing_server'] != undefined && settings['printer_name'] != undefined) {
                        forwardModel(filepath, settings['slicing_server'], 3, {target: settings['printer_name'], type: 0});
                        return;
                    }
                    else {
                        res.status(400);
                        res.end('Non-sliced 3D models are only supported on a server.');
                        return;
                    }
                }

                if (settings['log']) {
                    console.log('Slicing model {target:' + fields.target + ', ip: ' + pIP + ', name: ' + files.model.name + ', renamed: ' + filename + '}');
                }


                getPrinterConfig(pIP, function(configfile) {

                    // The config should always be defined, but it may be empty
                    if (configfile != undefined) {

                        setStatus(1);

                        exec(settings['slicer_path'] + ' --load ' + configfile + ' ' + tmpdir + filename + filext,
                        function(error, stdout, stderr) {

                            if (error != null) {
                                if (settings['log']) {
                                    console.log('Error slicing uploaded model {target:' + fields.target + ', ip: ' + pIP + ', name: ' + files.model.name + ', renamed: ' + filename + '}');
                                    console.log('Slicing output: \nstdout: ' + stdout + '\nstderr: ' + stderr);
                                }

                                setStatus(101);
                                fs.unlinkSync(filepath);

                                return;
                            }

                            if (settings['log'] && settings['is_server']) {
                                console.log('Successfully sliced model {target:' + fields.target + ', ip: ' + pIP + ', name: ' + files.model.name + ', renamed: ' + filename + '}');
                            }

                            fs.unlinkSync(filepath);

                            filepath = tmpdir + filename + '.gcode';
                            fs.chmodSync(filepath, 0755);
                            forwardModel(filepath, pIP, 3);
                        });

                    }

                });

                res.end('Your model is uploaded and being sliced.');
                return;
            }
            // The uploaded file is a .gcode file
            else if (typeCheck == 2) {

                if (settings['is_server']) {
                    res.end('Your g-code is being forwarded to ' + fields.target + '.');
                    forwardModel(filepath, pIP, 3);
                    return;
                }
                else {

                    if (currentlyPrinting) {

                        if (settings['log']) {
                            console.log('Another print job is currently executing. Please wait.');
                        }

                        res.status(400);
                        res.end('Another print job is currently executing. Please wait.');
                        return;
                    }

                    res.end('Your print should begin shortly.');
                    kickoffPrint(filepath);
                    return;
                }
            }
            else {

                res.status(400);
                res.end('Error: typeCheck == ' + typeCheck + '. Do not know how to handle.');
                return;
            }

            res.end();
            return;
        });


        // if (settings["is_server"]) {
        //     socket = new ws(clientip);
        //     socket.on('open', function(){
        //         socket.send("I AM MESSAGE");
        //     });
        // }

        // res.redirect('back');
        // return();
    });

// var server = http.createServer(app);
// server.listen(8080);
setInterval(updateAllStatus, 1000);
app.listen(process.env.PORT || settings['port']);

if (settings['log']) {
    console.log('Listening on port ' + settings['port']);
}

// var wss = new ws.Server({server: server});
// wss.on('connection', function(ws) {
//     ws.on('message', function(message) {
//         console.log(message);
//     });
// });





