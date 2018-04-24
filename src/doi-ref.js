#!/usr/bin/env node
"use strict";
/** 
    Extract reference information for a DOI request from a SPASE resource description.
    Author: Todd King
**/
const fs = require('fs');
const fastXmlParser = require('fast-xml-parser');
const yargs = require('yargs');
const path = require('path');

var options  = yargs
	.version('1.0.0')
	.usage('Extract reference information for a DOI request from a SPASE resource description.')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'Extract reference information for a DOI request from "example.xml"')
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

var readXML = function(file) {
	return new Promise(function(resolve, reject) {
		fs.readFile(file, 'utf8', function(err, data) {
			if(err) { reject(err); }
			else { resolve(fastXmlParser.parse(data, { ignoreAttributes : false, parseAttributeValue : true } ) ); }
		})
	});
}

/*
 Build author list from Contact with Role of PrincipalInvestigator.
*/
var authorList = function(contact) {
	var list = "";
	contact.forEach(function(item) {
		if(item.Role[0] == "PrincipalInvestigator") {
			var part = item.PersonID[0].split('/');
			var name = part[part.length - 1].split('.');
			list += name[name.length - 1];
			for(var i = 0; i < name.length - 1; i++) {
				list += ", " + name[i];
			}
		}
	});
	return list;
};

/*
Extract authority portion of resource ID
*/
var authority = function(resourceID) {
	var buffer = "";
	
	buffer = resourceID.replace(/spase:\/\//, "");
	
	var part = buffer.split('/');
	return part[0];
};

async function makeDOI(root, file, recurse) {
	if(file.startsWith(".")) return;	// No hidden items
	
	console.log("root: " + root);
	
	var pathname = path.join(root, file);
	if( ! fs.existsSync(pathname)) {
		console.log("No such file or directory: " + file);
		return;
	}
	if(fs.statSync(pathname).isDirectory()) {
		if(recurse) {	// Check all files
			if(options.verbose) console.log("Scanning directory: " + pathname);
			fs.readdir(pathname, function(err, items) {
				for (var i  =0; i < items.length; i++) {
					makeDOI(pathname, items[i], recurse);
				}
			});
		}
	}
	// Else - its a file
	if(pathname.endsWith(options.ext)) {
		var content = await readXML(pathname).catch(e => {
			console.log('Error on readXML');
		 // error caught
		});

		var root = null;
		if(content.Spase.NumericalData) { root = content.Spase.NumericalData; }
		if(content.Spase.DisplayData) { root = content.Spase.DisplayData; }
		if(root == null) {
			console.log("Unknown resource type.");
		} else {
			console.log( "location: http://spase.info/registry/render?id=" + root.ResourceID );
			console.log( "creator: " + authorList(root.ResourceHeader.Contact) );
			console.log( "title: " + root.ResourceHeader.ResourceName );
			console.log( "publisher: " + authority(root.ResourceID) );
			console.log( "year: " + root.ResourceHeader.ReleaseDate.substring(0,4) );
			console.log( "resource.type: " + "Dataset" );
			console.log( "" );
		};
	}
}

var main = function(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	// Check each file/folder
	for(let i = 0; i < args.length; i++) {
		var file = args[i];
		makeDOI(path.dirname(file), path.basename(file), options.recurse);
	};
}

main(args);