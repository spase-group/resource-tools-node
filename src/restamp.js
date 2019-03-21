#!/usr/bin/env node
"use strict";
/** 
    Update the ReleaseDate in a resource description to the current date and time.
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
	.usage('Update the ReleaseDate in a resource description to the current date and time.')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'change the ReleaseDate in "example.xml" to the current date and time and write output to display.')
	.example('$0 -w example.xml', 'change the ReleaseDate in "example.xml" to the current date and time and write output to original file.')
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
var releaseDate = "0000-00-00T00:00:00.000";
var fileCnt = 0;

// Functions
var errHandler = function(err) {
    console.log(err);
}

var getReleaseDate = function() {
	var stamp = new Date();
	
	return stamp.toISOString().substring(0, 23);	// Drop trailing "Z"
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

async function updateXML(file) {
	if(options.verbose) { console.log('Updating file: ' + file); }
	fileCnt++;
	
	var content = await readXML(file).catch(e => {
		console.log('Error on readXML');
	});

	var header = null;
	
	// Find ResourceHeader
	// Base model
	if(content.Spase.NumericalData) { header = content.Spase.NumericalData.ResourceHeader; }
	if(content.Spase.DisplayData) { header = content.Spase.DisplayData.ResourceHeader; }
	if(content.Spase.Catalog) { header = content.Spase.Catalog.ResourceHeader; }
	if(content.Spase.Document) { header = content.Spase.Document.ResourceHeader; }
	if(content.Spase.Instrument) { header = content.Spase.Instrument.ResourceHeader; }
	if(content.Spase.Observatory) { header = content.Spase.Observatory.ResourceHeader; }
	if(content.Spase.Registry) { header = content.Spase.Registry.ResourceHeader; }
	if(content.Spase.Service) { header = content.Spase.Service.ResourceHeader; }
	if(content.Spase.Repository) { header = content.Spase.Repository.ResourceHeader; }
	if(content.Spase.Annotation) { header = content.Spase.Annotation.ResourceHeader; }
	
	if(content.Spase.Person) { header = content.Spase.Person; }
	if(content.Spase.Granule) { header = content.Spase.Granule; }

	// Simulation Extensions
	if(content.Spase.SimulationRun) { header = content.Spase.SimulationRun.ResourceHeader; }
	if(content.Spase.SimulationModel) { header = content.Spase.SimulationModel.ResourceHeader; }
	if(content.Spase.DisplayOutput) { header = content.Spase.DisplayOutput.ResourceHeader; }
	if(content.Spase.NumericalOutput) { header = content.Spase.NumericalOutput.ResourceHeader; }
	
	if(header == null) {
		console.log("Document does not appear to be SPASE resource description.");
		console.log("File: " + file);
		return;
	}

	header.ReleaseDate = releaseDate;
	
	writeXML(file, content);
}

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