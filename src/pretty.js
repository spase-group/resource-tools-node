#!/usr/bin/env node
"use strict";
/** 
    Do a pretty formatting of an XML file.
    Author: Todd King
**/

const fs = require('fs');
const yargs = require('yargs');
const fastXmlParser  = require('fast-xml-parser');
const XmlGenerater = require('fast-xml-parser').j2xParser;
const path = require('path');
const walk = require('walk-folder-tree');

// Configure the app
var options  = yargs
	.version('1.0.1')
	.usage('Do a pretty formatting of an XML file.')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'format the XML in "example.xml" and write output to display.')
	.example('$0 -w example.xml', 'format the XML in "example.xml" and write output to original file.')
	.epilog("Development funded by NASA's VMO project at UCLA.")
	.showHelpOnFail(false, "Specify --help for available options")
	.help('h')
	
	// version
	.options({
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
	.argv
	;

var args = options._;	// None option command line arguments

// Global variables
var fileCnt = 0;

// Functions
var errHandler = function(err) {
    console.log(err);
}

var readXML = function(file) {
	return new Promise(function(resolve, reject) {
		fs.readFile(file, 'utf8', function(err, data) {
			if(err) { reject(err); }
			else { resolve(fastXmlParser.parse(data, { ignoreAttributes : false, parseAttributeValue : false, parseNodeValue : false } ) ); }
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

async function formatXML(file) {
	if(options.verbose) { console.log('Formatting file: ' + file); }
	fileCnt++;
	
	var content = await readXML(file).catch(e => {
		console.log('Error on readXML');
	});

	writeXML(file, content);
}

var main = function(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	// Check each file/folder
	
	var includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)
	
	var root = args[0];
	if(fs.statSync(root).isDirectory()) {	// Walk the tree
		walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
			if( ! params.directory ) {
				var pathname = path.join(root, params.path);
				
				formatXML(pathname);		
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: processed: " + fileCnt + " files(s); ");
		});
	} else {	// Single file
		formatXML(root);
	}
	
}

main(args);