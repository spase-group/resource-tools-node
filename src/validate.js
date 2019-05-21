#!/usr/bin/env node
"use strict";
/**
 * Validate the contents of a SPASE resource description.
 * 
 * To run the tool be sure you have installed:
 * npm install node-fs
 * npm install yargs
 *
 * @author Todd King
 **/
const fs = require('fs');
const yargs = require('yargs');
const path = require('path');
const fastXmlParser = require('fast-xml-parser');
const request = require('request-promise-native');
const walk = require('./walk-tree');   // Formerly walk-folder-tree
const libxml = require('libxmljs');

var options  = yargs
	.version('1.0.4')
	.usage('Validate a SPASE resource description using a specified version of the data dictionary (XML schema).')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'validate the contents of "example.xml" using the version declared in the file.')
	.example('$0 -s scheam.xsd example.xml', 'validate the contents of "example.xml" using the the schema "schema.xsd".')
	.epilog('copyright 2018')
	.showHelpOnFail(false, "Specify --help for available options")
	.help('h')
	
	// version
	.options({
		// Verbose flag
		'v' : {
			alias: 'verbose',
			describe : 'show information while processing files',
			type: 'boolean',
			default: false
		},
		
		// help text
		'h' : {
			alias : 'help',
			description: 'show information about the app.'
		},
		
		// Only show errors
		'e' : {
			alias: 'errors',
			describe : 'Display information only if errors are found.',
			type: 'boolean',
			default: false
		},

		// Recursively scan for files
		'r' : {
			alias: 'recurse',
			describe : 'Recursively process all files starting at path.',
			type: 'boolean',
			default: false
		},
		
		// Check Resource ID references
		's' : {
			alias: 'schema',
			describe : 'URL or Path to the XML schema document (XSD) to use for checking files.',
			type: 'string'
		},
		
		// File name extensions
		'x' : {
			alias: 'ext',
			describe : 'File name extension for filtering files when processing folders.',
			type: 'string',
			default: '.xml'
		},
	})
	.argv
	;

var args = options._;	// Unprocessed command line arguments

// Global variables
var fileCnt = 0;
var failureCnt = 0;
options.service = 'http://spase-group.org/data/schema';

// Functions
async function getSchema(version) {
	version = version.replace(/\./g, '_');
	var url = options.service + "/spase-" + version + ".xsd"; 
	try {
		return await request(url);
	} catch(e) {
		console.log("Unable to retrieve schema from: " + url);
		return e;
	}
}

async function validateFile(pathname) {
	fileCnt++;
	var xmlDoc = fs.readFileSync(pathname, 'utf8');
	var xml = libxml.parseXml(xmlDoc);
	var result = fastXmlParser.parse(xmlDoc);	// Check syntax
	
	// Get Schema
	var xsdDoc = "";
	if(options.schema != null) {	// Read from file
		if(options.schema.startsWith("http")) {
			xsdDoc = await request(options.schema);
		} else {	// Local file
			xsdDoc = fs.readFileSync(options.schema, 'utf8');
		}
	} else {	// Load from server
		xsdDoc = await getSchema(result.Spase.Version);
	}
	
	var xsd = libxml.parseXml(xsdDoc);	
	if(xml.validate(xsd)) {
		if ( ! options.errors) { console.log('      OK: ' + pathname); }
	} else {
		console.log(' INVALID: ' + pathname);
		failureCnt++;
		xml.validationErrors.forEach(function(item) {
			console.log('   Line: ' + item.line + "; " + item.message.trim());
		});
	}
}

function main(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	var includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)
	
	var root = args[0];

	if(fs.statSync(root).isDirectory()) {	// Walk the tree
		walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
			// if( ! params.directory ) { validate(params.path); }
			if( ! params.directory ) {
				var pathname = path.join(root, params.path);
				try {
					await validateFile(pathname);
				} catch(e) {
					console.log(' INVALID: ' + pathname);
					console.log('  REASON: ' + e.message);
				}
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: scanned: " + fileCnt + " files(s); " + failureCnt + " failure(s)");
		}).catch(function(e) {
			console.log(e);
		});
	} else {	// Single file
		validateFile(root);
	}
}

main(options._);