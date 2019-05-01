#!/usr/bin/env node
"use strict";
/**
 * List the file tree.
 * 
 * To run the tool be sure you have installed:
 * npm install yargs
 *
 * @author Todd King
 **/
const fs = require('fs');
const yargs = require('yargs');
const path = require('path');
const walk = require('./walk-tree');   // Formerly walk-folder-tree
 
// Configure the app
var options  = yargs
	.version('1.0.2')
	.usage('List the file tree. Optionally list only files with a given extension.')
	.usage('$0 [args] <files...>')
	.example('$0 -r .', 'list the file tree starting at the current folder.')
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

		// File name extensions
		'x' : {
			alias: 'ext',
			describe : 'File name extension for filtering files when processing folders.',
			type: 'string',
			default: ''
		},
		

	})
	.argv
	;

var args = options._;

// Global variables
var fileCnt = 0;

var main = function(args)
{
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}
	// var regex = new RegExp('/' + options.ext + '$/');	// Ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)

	var includeFiles = /^.*$/;	// Everything
	if(options.ext.length > 0) {
		includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
		console.log("ext: " + options.ext);
		console.log("ext: " + includeFiles.toString());
	}
	
	var root = args[0];

	if(fs.statSync(root).isDirectory()) {	// Walk the tree		
		walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
			if(params.path.match(includeFiles)) {	// Filter out directories
				console.log(path.join(root, params.path));
				fileCnt++;
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: " + fileCnt + " files(s); ");
		});
	} else {	// Single file
		fileCnt++;
		console.log(root);
		console.log(" SUMMARY: " + fileCnt + " files(s); ");
	}
	
}

main(args);