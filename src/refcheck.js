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
const ftp = require("basic-ftp")
const fastXmlParser = require('fast-xml-parser');
const walk = require('./walk-tree');	// Formerly walk-folder-tree
const util = require('util');
const Entities = require('html-entities').XmlEntities;
const urlUtil = require('url');

const entities = new Entities();

// Configure the app
var options  = yargs
	.version('1.0.8')
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
			default: 'https://hpde.io/'
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
 * Check an FTP "URL". 
 * 
 * The FTP URL is parsed, an FPT connection is established to the host 
 * and a search is done for the referenced file (path).
 *
 * Returns a Promise.
 *
**/
var ftpCheck = function(url) {
	return new Promise(async function(resolve, reject) {
    const client = new ftp.Client();
    client.ftp.verbose = false;
		var urlParts = urlUtil.parse(url);
    var doSecure = true;
    if(url.startsWith("ftp:")) doSecure = false;
    try {
        await client.access({
            host: urlParts.host,
            secure: doSecure
        });
				var filename = path.basename(urlParts.path)
        await client.cd(path.dirname(urlParts.path));
        var list = await client.list()
				for(let i = 0; i < list.length; i++) {
					var item = list[i];
					if(item.name == filename) { client.close(); resolve(item); return; }
				}
				// Not found if we reach here
				reject('File not found: ' + filename);
    }
    catch(err) {
				reject(err);
    }
    client.close();
  });
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
			findAll(dom[name], pattern, exclude, fullList);
		}
	}

	return fullList;
}

/** 
 * Perform a referential check on a file.
 *
 * File is parsed as XML and content with tags that end with "ID" are
 * checked. Tags with the name "PriorID" and "ResourceID" are not checked.
 *
**/
async function refcheckFile(pathname) {
	fileCnt++;

  var needPathname = true;

	var xmlDoc = fs.readFileSync(pathname, 'utf8');
	var content = fastXmlParser.parse(xmlDoc);	// Check syntax
	
	// Check Identifiers
	if(options.id) {
		var list = findAll(content, /.*ID$/, /^PriorID$|^ResourceID$/);
		for(let i = 0; i < list.length; i++) {
			idCnt++;
			var id = list[i];
			var path = id.replace("spase://", "");

			try {
				if(options.verbose) { console.log('Checking with: ' + options.service + path + ".xml"); }

				var response = await request.head(options.service + path + ".xml");
				if ( ! options.errors) { console.log(pathname); needPathName = false; console.log("      OK: " + id); }
			} catch(e) {
        if(needPathname) { console.log(pathname); needPathname = false; }
				console.log(" INVALID: " + id);
				console.log("    FILE: " + pathname);
				console.log("        : " + e.message);
				idFailureCnt++;
			}
		}
	}
	
	// Check URL
	if(options.url) {
		var client = null;
		var list = findAll(content, /^URL$/);
    
    request.defaults({jar: true});
    
		for(let i = 0; i < list.length; i++) {
			client = null;
			urlCnt++;
			var scanned = true;
			var url = entities.decode(list[i].trim());
			try {
				if(url.startsWith("http:") || url.startsWith("https:")) {
					var requestOptions = {
						url : "",
						headers: {
							'User-Agent': 'request'
						}
					};
					requestOptions.url = url;
          // Some sites might be rate limited so
          // If link fails, we wait a little while then try a second time.
          try {
            var response = await request.head(requestOptions);
          } catch(e) {
            if(e.statusCode == 403) { // 403: Unauthorized - likely requires cookies, could require login
              // Treat as a success - otherwise throw original error
            } else {
              throw(e);
            }
          }
				}
				else if(url.startsWith("ftp:") || url.startsWith("ftps:")) {				
					if(await ftpCheck(url) == null) throw("File not found.");
				}
				else {	// Unsupported protocol
          if(needPathname) { console.log(pathname); needPathname = false; }
					console.log(" INVALID: " + url); urlFailureCnt++;
					console.log("    FILE: " + pathname);
					console.log("        : Unsupported protocol");	
					scanned = false;					
				}
				
				if ( (! options.errors) && scanned) {
          if(needPathname) { console.log(pathname); needPathname = false; }
          console.log("      OK: " + url); 
        }
			} catch(e) {
        if(needPathname) { console.log(pathname); needPathname = false; }
				console.log(" INVALID: " + url); urlFailureCnt++;
				console.log("    FILE: " + pathname);
				console.log("        : " + e.message);
				console.log("RESPONSE: " + JSON.stringify(response, 3, null));
			}
			if(client != null) client.close();
		}
	}	
}

/**
 * Program entry point
**/
var main = function(args)
{
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	var includeFiles = new RegExp(options.ext.replace(/\./g, '\\.') + '$');	// literal dot (.) and ends with extension
	var includeFolders = /(^[.]$|^[^.])/; //  ignore folders starting with ., except for '.' (current directory)
	
	var root = args[0];

	if(fs.statSync(root).isDirectory()) {	// Walk the tree
		try {
			walk(root, { filterFolders: includeFolders, filterFiles: includeFiles, recurse: options.recurse }, async function(params, cb) {
				if( ! params.directory ) {
					var pathname = path.join(root, params.path);
					if(options.verbose) console.log(pathname);
					await refcheckFile(pathname);
				}
				cb();
			}).then(function() {
				console.log(" SUMMARY: scanned : " + fileCnt + " files(s); " + idCnt + " ID(s); " + urlCnt + " URL(s)");
				console.log(" SUMMARY: failures:             " + idFailureCnt + " ID(s); " + urlFailureCnt + " URL(s)");
			});
		} catch(e) {
			console.log("Reason: " + e.message);
		}
	} else {	// Single file
		console.log(root);
		refcheckFile(root);
	}
	
}

main(args);