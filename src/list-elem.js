#!/usr/bin/env node
"use strict";
/**
 * List an element value in an XML document.
 * 
 * To run the tool be sure you have installed:
 * npm install yargs
 *
 * @author Todd King
 **/
const fs = require('fs');
const yargs = require('yargs');
const path = require('path');
const fastXmlParser = require('fast-xml-parser');
const walk = require('walk-folder-tree');
 
// Configure the app
var options  = yargs
	.version('1.0.2')
	.usage('List an element value in an XML document.')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'list values for all ResourceID tags in "example.xml"')
	.example('$0 -l URL example.xml', 'list values for all URL tags in "example.xml"')
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

		// ID tag to scan for
		'i' : {
			alias: 'id',
			describe : 'The name of ID tag to scan for.',
			type: 'string',
			default: 'ResourceID'
		},

		// List file name with ID tag
		'l' : {
			alias: 'list',
			describe : 'List file name with ID tag.',
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

var args = options._;

// Global variables
var fileCnt = 0;
var tagRegex = /^ResourceID$/;

var errHandler = function(err) {
    console.log(err);
}

function findAll(dom, pattern, exclude, list) {
	if( ! dom ) return list;
	
	var fullList = (list === undefined ? [] : list);
	
	for(var name in dom) {
		// console.log(name);
		if( ! (exclude === undefined) && name.match(exclude) ) continue;	// skip
		if( name.match(pattern) ) { fullList.push(dom[name]); }
		if( Array.isArray(dom[name]) ) {	// Check each element of an array
			var item = dom[name];
			for(var i = 0; i < item.length; i++) { findAll(item[i], pattern, exclude, fullList); }
		}
		if( typeof dom[name] === 'object') {	// An item with children
			// console.log((typeof dom[name]) + " => " + name + ":" + Object.keys(dom[name]).length);
			findAll(dom[name], pattern, exclude, fullList);
		}
	}

	return fullList;
}

async function getElement(pathname) {
	fileCnt++;
	
	var xmlDoc = fs.readFileSync(pathname, 'utf8');
	var content = fastXmlParser.parse(xmlDoc);	// Check syntax
	
	// Check Identifiers
	var list = findAll(content, tagRegex);
	for(let i = 0; i < list.length; i++) {
		if(options.list) { console.log(list[i] + "," + pathname); }
		else { console.log(list[i]); }
	}	
}

var main = function(args)
{
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	tagRegex = new RegExp('^' + options.id + '$');	// literal dot (.) and ends with extension

	var includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)
	
	var root = args[0];
	
	console.log('Scanning for: ' + options.id);
	
	if(fs.statSync(root).isDirectory()) {	// Walk the tree	
		walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
			// if( ! params.directory ) { validate(params.path); }
			if( ! params.directory ) {
				var pathname = path.join(root, params.path);
				await getElement(pathname);
			}
			cb();
		}).then(function() {
			console.log(" SUMMARY: scanned: " + fileCnt + " files(s); ");
		});
	} else {	// Single file
		getElement(root);
	}
	
}

main(args);