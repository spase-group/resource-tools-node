#!/usr/bin/env node
"use strict";
/**
 * Read a resource description and place it in an appriately named file and path
 * based on the ResourceID
 * 
 * @author Todd King
 **/
const fs = require('fs');
const yargs = require('yargs');
const path = require('path');
const fastXmlParser = require('fast-xml-parser');
const walk = require('walk-folder-tree');

var options  = yargs
	.version('1.0.0')
    .usage('Read a resource description and place it in an appropriately named file and path based on the ResourceID.')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'Place "example.xml" in an appropriately named file and path.')
	.epilog('copyright 2018')
	.showHelpOnFail(false, "Specify --help for available options")
	.help('h')
	
	// version
	.options({
		// Verbose flag
		'verbose' : {
			alias: 'v',
			describe : 'show information while processing files',
			type: 'boolean',
			default: false
		},
		
		// help text
		'help' : {
			alias : 'h',
			description: 'show information about the app.'
		},
		
		// Recursively scan for files
		'r' : {
			alias: 'recurse',
			describe : 'Recursively process all files starting at path.',
			type: 'boolean',
			default: false
		},
		
		// Check Resource ID references
		'k' : {
			alias: 'check',
			describe : 'Check files, but do not write collated output.',
			type: 'boolean',
			default: false
		},
		
		// Base path
		'b' : {
			alias: 'base',
			describe : 'Base path for collated output.',
			type: 'string',
			default: '.'
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
var failCnt = 0;


/**
 *  @brief Create a full path to a resource using VxO rules.
 *  
 *  @param [in] base the base path to prepent to the authority/path portion of the resourceID.
 *  @param [in] resourceID The resourceID to parse and munge.
 *  
 *  @return A file pathname.
 *  
 *  @details  Create a full path to a resource using VxO rules. 
 * 		The protocol is striped from the ResourceID and the base path
 * 		is preprended.

 */
function makeResourcePath(base, resourceID)
{
	if(base == null || resourceID == null) return null;
	if(resourceID.indexOf("..") != -1) return null;	// Gaurd against path spoofing
	
	var n = resourceID.indexOf("://");
	if(n != -1) resourceID = resourceID.substring(n+3);
	return base + "/" + resourceID + ".xml";
}

function makePath(pathname)
{
	var path = pathname;
	var n = path.lastIndexOf('/');
	if(n > 0) path = path.substring(0, n);

	if (!fs.existsSync(path)) {
            var dirName = "";
            var pathSplit = path.split('/');
            for (var index = 0; index < pathSplit.length; index++) {
                dirName += pathSplit[index]+'/';
                if (!fs.existsSync(dirName))
                    fs.mkdirSync(dirName);
            }
        }
}

/**
 *  @brief Scan a parsed (XML) document and find matching elements.
 *  
 *  @param [in] dom The document represented as a Javascript object
 *  @param [in] pattern The Regex pattern to search for
 *  @param [in] exclude Elements to exclude from search
 *  @param [in] list List of elements already found.
 *  
 *  @return The list of values for all matching elements
 */
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

/**
 *  @brief Perform task.
 *  
 *  @param [in] args command line arguments after processing options.
 *  @return nothing
 */
function main(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	var regex = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	
	var root = args[0];
	walk(root, { filterFolders: /^.*$/, filterFiles: regex, recurse: options.recurse }, async function(params, cb) {
		// if( ! params.directory ) { validate(params.path); }
		if( ! params.directory ) {	// A file - process
			fileCnt++;
						
			var pathname = path.join(root, params.path);
			pathname = pathname.replace(/\\/g, '/');	// Normalize path

			var xmlDoc = fs.readFileSync(pathname, 'utf8');
			// var xml = libxml.parseXml(xmlDoc);
			var xml = fastXmlParser.parse(xmlDoc);	// Check syntax

			var id = findAll(xml, '^ResourceID$');
			var resourcePath = makeResourcePath(options.base, id[0]);
			
			if(options.verbose) console.log( "Checking: " + pathname );
			
			if(options.check) {	// Check if file is in correct location
				if( resourcePath.startsWith('./') ) {	// Make pathname match relative
					if( ! pathname.startsWith('/') ) { pathname = "./" + pathname; }
				}
				if(resourcePath != pathname) {
					failCnt++;
					console.log("  ERROR: " + pathname + " should be named  " + resourcePath);
				}
			} else {	// Copy/rename path to destination
				makePath(resourcePath);
				fs.writeFileSync(resourcePath, fs.readFileSync(pathname));
			}

		}
		cb();
	}).then(function() {
		console.log(" SUMMARY: scanned: " + fileCnt + " files(s); " + failCnt + " failure(s)");
	});
}

main(options._);