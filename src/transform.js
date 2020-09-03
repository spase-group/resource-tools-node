#!/usr/bin/env node
"use strict";
/**
 * Transform a SPASE description in XML using an XML Stylesheet.
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
const walk = require('walk-folder-tree');
const XSLT = require('xsltjs');

static indent = 3;

var options  = yargs
	.version('1.0.3')
	.usage('Transform a SPASE description in XML using an XML Stylesheet.')
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
		
		// Recursively scan for files
		'r' : {
			alias: 'recurse',
			describe : 'Recursively process all files starting at path.',
			type: 'boolean',
			default: false
		},
		
		// Path to XML stylesheets
		'p' : {
			alias: 'path',
			describe : 'Path to the location for XML stylesheets to use for transforming files.',
			type: 'string'
		},
		
		// XML Stylesheet
		's' : {
			alias: 'stylesheet',
			describe : 'URL or Path to the XML stylesheet to use for transforming files.',
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

async function transformFile(pathname, stylesheet) {
  XSLT
    .process(inputDoc, transformDoc, params, {
      inputURL: pathname,
      transformURL: stylesheet,
      debug: debug
    })
    .then(
      (resultXML) => {
		console.log('stdout:', stdout);
        return;
      },
      (exception) => {
	    console.error('stderr:', exception);
        return;
      }
    );
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
				await transformFile(pathname, options.stylesheet);
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: scanned: " + fileCnt + " files(s); " + failureCnt + " failure(s)");
		});
	} else {	// Single file
		validateFile(root);
	}
}

main(options._);