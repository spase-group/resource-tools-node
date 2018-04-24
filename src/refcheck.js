#!/usr/bin/env node
"use strict";
/**
 * Perform a check of URL or SPASE ID references in a SPASE resource description.
 * 
 * To run the tool be sure you have installed:
 * npm install yargs
 *
 * @author Todd King
 **/
const fs = require('fs');
const yargs = require('yargs');
const path = require('path');
const request = require('request-promise-native');
const ftp = require('ftp-get');
const fastXmlParser = require('fast-xml-parser');
const walk = require('walk-folder-tree');
const util = require('util');
const Entities = require('html-entities').XmlEntities;
 
const entities = new Entities();

const ftpHead = util.promisify(ftp.head);
const ftpGet = util.promisify(ftp.get);

// Configure the app
var options  = yargs
	.version('1.0.1')
	.usage('Perform a check of URL or SPASE ID references in a SPASE resource description.')
	.usage('$0 [args] <files...>')
	.example('$0 -i example.xml', 'check SPASE ID references in the given file')
	.example('$0 -u example.xml', 'check URL references in the given file')
	.example('$0 -i -u example.xml', 'check both SPASE ID and URL references in the given file')
	.epilog("Development funded by NASA's VMO project at UCLA.")
	.showHelpOnFail(false, "Specify --help for available options")
	.help('h')
	
	// version
	.options({
		// File name extensions
		'd' : {
			alias: 'dir',
			describe : 'Directory containing local resource descriptions. Directory is recursively searched for resource descriptions.',
			type: 'string',
			// default: null
		},

		// Only show errors
		'e' : {
			alias: 'errors',
			describe : 'Display information only if errors are found.',
			type: 'boolean',
			default: false
		},

		// help text
		'h' : {
			alias : 'help',
			description: 'Show information about the app.'
		},

		// Check Resource ID references
		'i' : {
			alias: ['identifier', 'id'],
			describe : 'Check each identifier in the resource description.',
			type: 'boolean',
			default: false
		},
		
		// Lists IDs and URLs
		'l' : {
			alias: 'list',
			describe : 'List all identifiers and URLs. Do not perform referential checks.',
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
			alias: 'service',
			describe : 'The URL to the registry service to look-up resource identifiers.',
			type: 'string',
			default: 'http://www.spase-group.org/registry/resolver'
		},
		
		// Check URL references
		'u' : {
			alias: ['url', 'urlcheck'],
			describe : ' Check each URL in the resource description.',
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
var idCnt = 0;
var urlCnt = 0;
var urlFailureCnt = 0;
var idFailureCnt = 0;

var errHandler = function(err) {
    console.log(err);
}

/**
 *  @brief Find all nodes in a DOM that match a pattern.
 *  
 *  @param [in] dom Description for dom
 *  @param [in] pattern Description for pattern
 *  @param [in] list Description for list
 *  @return Return description
 *  
 *  @details More details
 */
function findAll(dom, pattern, exclude, list) {
	if( ! dom ) return list;
	
	var fullList = (list === undefined ? [] : list);
	
	for(var name in dom) {
		// console.log(name);
		if( ! (exclude === undefined) && name.match(exclude) ) continue;	// skip
		if( name.match(pattern) ) { 
			if( Array.isArray(dom[name]) ) {
				fullList.push.apply(dom[name]); 
			} else {
				fullList.push(dom[name]); 				
			}
		}
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

function checkFtp(url) {
	
}

var main = function(args)
{
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}
	// var regex = new RegExp('/' + options.ext + '$/');	// Ends with extension
	var regex = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	
	var root = args[0];
	
	walk(root, { filterFolders: /^.*$/, filterFiles: regex, recurse: options.recurse }, async function(params, cb) {
		// if( ! params.directory ) { validate(params.path); }
		if( ! params.directory ) {
			fileCnt++;
			var pathname = path.join(root, params.path);
			var xmlDoc = fs.readFileSync(pathname, 'utf8');
			var content = fastXmlParser.parse(xmlDoc);	// Check syntax
			
			// Check Identifiers
			if(options.id) {
				var list = findAll(content, /.*ID$/, /^PriorID$/);
				for(let i = 0; i < list.length; i++) {
					idCnt++;
					var id = list[i];

					try {
						// console.log('Checking with: ' + options.service + "?c=yes&i=" + id);

						var response = await request(options.service + "?c=yes&i=" + id);
						try {
							var result = fastXmlParser.parse(response);
							if( ! result.Response ) {
								console.log("    FILE: " + pathname);
								console.log(" INVALID: " + id);
								idFailureCnt++;
							} else {
								if( result.Response.Known ) { if ( ! options.errors) { console.log("      OK: " + id); } }
								else { 	console.log(" INVALID: " + id); console.log("    FILE: " + pathname); idFailureCnt++; }
							}
						} catch(error) {
							console.log(" INVALID: " + id);
							console.log("    FILE: " + pathname);
							console.log("        : " + error.message);
							idFailureCnt++;
						}
					} catch(e) {
						console.log(" INVALID: " + id);
						console.log("    FILE: " + pathname);
						console.log("        : " + error.message);
						idFailureCnt++;
					}
				}
			}
			
			// Check URL
			if(options.url) {
				var list = findAll(content, /^URL$/);
				for(let i = 0; i < list.length; i++) {
					urlCnt++;
					var url = list[i];
					try {
						if(url.startsWith("http:")) {
							var response = await request.head(entities.decode(url));
						}
						if(url.startsWith("ftp:")) {
							// console.log('ftpHead: ' + url);
							try {
								var response = await ftpHead(url);
							} catch(e) {
								// console.log('ftpGet: ' + url);
								var response = await ftpget(url);
							}
						}
						
						console.log("      OK: " + url); 
					} catch(e) {
						console.log(" INVALID: " + url); urlFailureCnt++;
						console.log("        : " + e.message);
					}
				}
			}
		}
		cb();
	}).then(function() {
		console.log(" SUMMARY: scanned: " + fileCnt + " files(s); " + idCnt + " ID(s); " + urlCnt + " URL(s)");
		console.log(" SUMMARY: ID Failures: " + idFailureCnt + "; URL Failures: " + urlFailureCnt);
	});
	
}

main(args);