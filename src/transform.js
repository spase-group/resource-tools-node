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
const walk = require('walk-folder-tree');
const xsltproc = require('xsltproc');
const replaceExt = require('replace-ext');

var indent = 3;

var options  = yargs
	.version('1.0.4')
	.usage('Transform a SPASE description in XML using an XML Stylesheet.\nRequires an XSLT process to be installed.\n\nSee: http://www.sagehill.net/docbookxsl/InstallingAProcessor.html\n')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'transform the contents of "example.xml" using an XSLT stylesheet.')
	.example('$0 -s spase.xsl example.xml', 'transform the contents of "example.xml" using the the XSLT stylesheet "space.xsl".')
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
		
		// Output file name
		'o' : {
			alias: 'output',
			describe : 'Output file name.',
			type: 'string',
			default: null
		},
				
		// Output path
		'p' : {
			alias: 'path',
			describe : 'Output path for transformed file results. Used when doing a recursive transform.',
			type: 'string',
			default: null
		},
				
		// Output file extension
		'y' : {
			alias: 'outext',
			describe : 'Output file name extension to use when doing a recurse transform. Use -o to specifiy the output file name for single file output transforms.',
			type: 'string',
			default: '.html'
		},
				
		// XML Stylesheet
		's' : {
			alias: 'stylesheet',
			describe : 'URL or Path to the XML stylesheet to use for transforming files.',
			type: 'string',
      default: '+/xsl/spase.xsl'
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

async function transformFile(stylesheet, pathname, output) {
	var stream = null;
	
	if( output == null) {	// Write to display
	} else {
		stream = fs.createWriteStream(output);
	}
  
  if(stylesheet.startsWith("+/")) { // Relative to path to script
    stylesheet = __dirname + "/.." + stylesheet.substring(1);
  }
	
	var xslt = xsltproc.transform(stylesheet, pathname);

	xslt.stdout.on('data', function (data) {
		if(stream == null) { console.log("" + data); }
		else { stream.write(data, function() { } ); }
	});

	xslt.stderr.on('data', function (data) {
	  console.log('Error: ' + data);
	});
	
	xslt.on('exit', function (code) {
		if(stream != null) { stream.end(); }
	});
}

function main(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	// Fix up options
	if(options.outext != null) {
		if( ! options.outext.startsWith(".")) { // Add preceeding dot
			options.outext = "." + options.outext;
		}
	}

	var includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)
	
	var root = args[0];
	var fileCnt = 0;
	
	if(fs.statSync(root).isDirectory()) {	// Walk the tree
		walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
			// if( ! params.directory ) { validate(params.path); }
			if( ! params.directory ) {
				fileCnt++;
				var pathname = path.join(root, params.path);
				if(options.verbose) { console.log('Reading: ' + pathname); }
				var outname = replaceExt(pathname, ".html");
				if(options.path != null) { 
					outname = replaceExt(path.join(options.path, params.path), options.outext); 
					fs.mkdirSync(path.dirname(outname), { recursive: true });
				}
				if(options.verbose) { console.log('Writing: ' + outname); }
				await transformFile(options.stylesheet, pathname, outname);
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: processed: " + fileCnt + " files(s); ");
		});
	} else {	// Single file
		if(options.output != null) {	// Make path if needed
			fs.mkdirSync(path.dirname(options.output), { recursive: true });			
		}
		transformFile(options.stylesheet, root, options.output);
	}
}

main(options._);