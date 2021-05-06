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
const { Schema } = require('node-schematron');

var options  = yargs
	.version('1.0.5')
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
		
		// XML Schema file
		's' : {
			alias: 'schema',
			describe : 'URL or Path to the XML schema document (XSD) to use for structural checking of files.',
			type: 'string'
		},
		
		// XML Schematron file
		't' : {
			alias: 'schematron',
			describe : 'URL or Path to the XML schematron document (SCH) to use for content checking of files.',
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
options.service = 'https://spase-group.org/data/schema';

// Functions

// Retrieve xpath to an element
var xpath = function(element, path) {
  if( ! element) { return path; } // Done
  
  if(element.tagName) {
    return(xpath(element.parentNode, "/" + element.tagName + path));
  }
  
  return path;

}

// Get an XML schema document corresponding to a information model version.
async function getSchema(version) {
	// version = version.replace(/\./g, '_');
	var url = options.service + "/spase-" + version + ".xsd"; 
	try {
		return await request(url);
	} catch(e) {
		console.log("Unable to retrieve schema from: " + url);
		return e;
	}
}

// Get an XML schematron document corresponding to a information model version.
async function getSchematron(version) {
	// version = version.replace(/\./g, '_');
	var url = options.service + "/spase-" + version + ".sch"; 
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
  var rules = null;
	var result = fastXmlParser.parse(xmlDoc);	// Check syntax
	var valid = true;
  
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
	
	// Get Schematron
	var schDoc = "";
	if(options.schematron != null) {	// Read from file
		if(options.schematron.startsWith("http")) {
			schDoc = await request(options.schematron);
		} else {	// Local file
			schDoc = fs.readFileSync(options.schematron, 'utf8');
		}
	} else {	// Load from server
		schDoc = await getSchematron("1.0.0");  // Fixed version number - might chnage in future
	}
  rules = Schema.fromString(schDoc);
	
	var xsd = libxml.parseXml(xsdDoc);	
	if( ! xml.validate(xsd)) {
		// if ( ! options.errors) { console.log('      OK: ' + pathname); }
	  // } else {
		console.log(' INVALID: ' + pathname);
		failureCnt++;
    valid = false;
		xml.validationErrors.forEach(function(item) {
			console.log('   Line: ' + item.line + "; " + item.message.trim());
		});
	}
    
  // Replace <Spase ....> tag with <Spase>.
  // For some reason if the default namespace attribute ("xmls=") is present then schematron processing does not work.
  const regex = /<Spase [^>]+>/i;
  xmlDoc = xmlDoc.replace(regex, "<Spase>")
  var results = rules.validateString(xmlDoc, { debug: false });

  if(results.length > 0) {
    console.log(' INVALID: ' + pathname);
    failureCnt++;
    valid = false;

    results.forEach(function(element) {
      console.log("   XPath: " + xpath(element.context, ""));
      console.log("   ERROR: " + element.message.trim().replace(/\\n/g, "\n          "));
    });
  }
  
	if ( valid && ! options.errors) { console.log('      OK: ' + pathname); }
  
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