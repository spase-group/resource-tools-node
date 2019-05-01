#!/usr/bin/env node
"use strict";
/** 
    Change the control authority in the ResourceID, add a PriorID and update ReleaseDate.
    Author: Todd King
**/

const fs = require('fs');
const yargs = require('yargs');
const fastXmlParser  = require('fast-xml-parser');
const XmlGenerater = require('fast-xml-parser').j2xParser;
const path = require('path');
const walk = require('./walk-tree');   // Formerly walk-folder-tree

// Configure the app
var options  = yargs
	.version('1.0.1')
	.usage('Change the control authority in the ResourceID, add a PriorID and update ReleaseDate.')
	.usage('$0 [args] <files...>')
	.example('$0 -a VSPO example.xml', 'change the authority in the ResourceID to "VSPO"')
	.epilog("Development funded by NASA's VMO project at UCLA.")
	.showHelpOnFail(false, "Specify --help for available options")
	.help('h')
	
	// version
	.options({
		// Authority name
		'a' : {
			alias: 'authority',
			describe : 'The name of the new authority to use in the ResourceID',
			type: 'string',
			// default: null
		},

		// help text
		'h' : {
			alias : 'help',
			description: 'Show information about the app.'
		},
		
		// Recursively scan for files
		'r' : {
			alias: 'recurse',
			describe : 'Recursively process all files starting at path.',
			type: 'boolean',
			default: false
		},

		// Verbose flag
		'v' : {
			alias: 'verbose',
			describe : 'Show information while processing request.',
			type: 'boolean',
			default: false
		},

		// Write converted file into original file
		'w' : {
			alias: 'write',
			describe : 'Write converted file into original file.',
			type: 'boolean',
			default: false
		},

		// File name extensions
		'x' : {
			alias: 'ext',
			describe : 'File name extension for filtering files when processing folders.',
			type: 'string',
			default: '.xml'
		},
	})
	.demandOption(['authority'], 'Please provide the name of the new authority.')
	.argv
	;

var args = options._;	// None option command line arguments

// Global variables
var releaseDate = "0000-00-00T00:00:000";
var fileCnt = 0;

// Functions
var errHandler = function(err) {
    console.log(err);
}

var addPrior = function(resourceHeader, resourceID) {
	if ( resourceHeader.PriorID ) {
		if( typeof resourceHeader.PriorID === 'string' ) {	// Make Array
			resourceHeader.PriorID = new Array(resourceHeader.PriorID)
		}
		resourceHeader.PriorID.push(resourceID);
	} else {
		resourceHeader.PriorID = resourceID;
	}
};

var updateID = function(resourceID, authority) {
	var buffer = "";
	
	buffer = resourceID.replace(/spase:\/\//, "");
	
	var n = buffer.indexOf('/');
	if(n > 0) buffer = buffer.substring(n);
	
	return "spase://" + authority + buffer;
};

var getReleaseDate = function() {
	var stamp = new Date();
	
	return stamp.toISOString().substring(0, 23);	// Drop trailing "Z"
}

var readXML = function(file) {
	return new Promise(function(resolve, reject) {
		fs.readFile(file, 'utf8', function(err, data) {
			if(err) { reject(err); }
			else { resolve(fastXmlParser.parse(data, { ignoreAttributes : false, parseAttributeValue : true } ) ); }
		})
	});
}

var writeXML = function(file, content) {
	
	//default options need not to set
	var defaultOptions = {
		ignoreAttributes: false,
		format: true, 
		indentBy: "  ",
		supressEmptyNode: false
	};
	var generator = new XmlGenerater(defaultOptions);
	var xml = generator.parse(content);	
	
	if(options.write) {	// Write to original file
		fs.writeFileSync( file, xml, 'utf8' );
	} else {	// Write to screen
		console.log( xml );
	}
}

async function updateXML(file) {
	if(options.verbose) { console.log('Updating file: ' + file); }
	
	var content = await readXML(file).catch(e => {
		console.log('Error on readXML');
     // error caught
	});

	fileCnt++;
	
	var needPrior = true;
	var root = null;
	
	if(content.Spase.NumericalData) { root = content.Spase.NumericalData; }
	if(content.Spase.DisplayData) { root = content.Spase.DisplayData; }
	if(content.Spase.Catalog) { root = content.Spase.Catalog; }
	if(content.Spase.Document) { root = content.Spase.Document; }
	if(content.Spase.Instrument) { root = content.Spase.Instrument; }
	if(content.Spase.Observatory) { root = content.Spase.Observatory; }
	if(content.Spase.Registry) { root = content.Spase.Registry; }
	if(content.Spase.Service) { root = content.Spase.Service; }
	if(content.Spase.Repository) { root = content.Spase.Repository; }
	if(content.Spase.Annotation) { root = content.Spase.Annotation; }
	
	if(content.Spase.Person) { root = content.Spase.Person; needPrior = false; }
	if(content.Spase.Granule) { root = content.Spase.Granule; needPrior = false; }

	// Simulation Extensions
	if(content.Spase.SimulationRun) { root = content.Spase.SimulationRun; }
	if(content.Spase.SimulationModel) { root = content.Spase.SimulationModel; }
	if(content.Spase.DisplayOutput) { root = content.Spase.DisplayOutput; }
	if(content.Spase.NumericalOutput) { root = content.Spase.NumericalOutput; }
	
	if(root == null) {
		console.log("Unknown resource type.");
		return;
	}
	
	if(needPrior) {
		addPrior(root.ResourceHeader, root.ResourceID);
	}
	
	// console.log( JSON.stringify(root[0].ResourceHeader[0], null, 3) );
	// console.log( "new ID: " + updateID(root[0].ResourceID[0], authority) );
	root.ResourceID = updateID(root.ResourceID, options.authority);
	root.ResourceHeader.ReleaseDate = releaseDate;
	writeXML(file, content);
}

/*
function migrateFile(root, file, recurse) {
	if(file.startsWith(".")) return;	// No hidden items
	
	var pathname = path.join(root, file);
	if( ! fs.existsSync(pathname)) {
		console.log("No such file or directory: " + file);
		return;
	}
	if(fs.statSync(pathname).isDirectory()) {
		if(recurse) {	// Check all files
			if(options.verbose) console.log("Scanning directory: " + pathname);
			fs.readdir(pathname, function(err, items) {
				for (var i  =0; i < items.length; i++) {
					migrateFile(pathname, items[i], recurse);
				}
			});
		}
	}
	// Else - its a file
	if(pathname.endsWith(options.ext)) {
		updateXML(pathname);		
	}
}

var main = function(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	// Check each file/folder
	for(let i = 0; i < args.length; i++) {
		var file = args[i];
		migrateFile(path.dirname(file), path.basename(file), options.recurse);
	};
}
*/

var main = function(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	// Initialize global
	releaseDate = getReleaseDate();

	var includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)
	
	var root = args[0];
	if(fs.statSync(root).isDirectory()) {	// Walk the tree
		walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
			if( ! params.directory ) {
				var pathname = path.join(root, params.path);
				
				updateXML(pathname);		
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: processed: " + fileCnt + " files(s); ");
		});
	} else {	// Single file
		updateXML(root);
	}	
}

main(args);