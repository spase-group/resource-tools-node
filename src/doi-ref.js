#!/usr/bin/env node
"use strict";
/** 
    Extract reference information for a DOI request from a SPASE resource description.
    Author: Todd King
**/
const fs = require('fs');
const xml2js = require('xml2js');
const yargs = require('yargs');

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
	})
	.argv
	;

var args = options._;	// Unprocessed command line arguments

// List all files in a directory in Node.js recursively in a synchronous fashion
var walkSync = function(dir, filelist) {
	varfs = fs || require('fs');
	filelist = filelist || [];
	if ( fs.statSync(dir).isDirectory() ) {
		var files = fs.readdirSync(dir);
		files.forEach(function(file) {
			if ( fs.statSync(dir + '/' + file).isDirectory() ) {
				filelist = walkSync(dir + '/' + file, filelist);
			} else {
				filelist.push(dir + '/' + file);
			}
		});
	} else {
		filelist.push(dir);
	}
	return filelist;
};

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
Extract authroity portion of resource ID
*/
var authority = function(resourceID) {
	var buffer = "";
	
	buffer = resourceID.replace(/spase:\/\//, "");
	
	var part = buffer.split('/');
	return part[0];
};

function main(args) {
	// If no files or options show help
	if (args.length == 0) {
	  yargs.showHelp();
	  return;
	}

	// Perform scan 
	fileList = walkSync(args[2]);

	// List results
	fileList.forEach(function(file) {	
		var parser = new xml2js.Parser();

		fs.readFile(file, function(err, data) {
			parser.parseString(data, function (err, result) {
				console.log( JSON.stringify(result, null, 3) );
				console.log( "location: http://spase.info/registry/render?id=" + result.Spase.NumericalData[0].ResourceID );
				console.log( "creator: " + authorList(result.Spase.NumericalData[0].ResourceHeader[0].Contact) );
				console.log( "title: " + result.Spase.NumericalData[0].ResourceHeader[0].ResourceName );
				console.log( "publisher: " + authority(result.Spase.NumericalData[0].ResourceID[0]) );
				console.log( "year: " + result.Spase.NumericalData[0].ResourceHeader[0].ReleaseDate[0].substring(0,4) );
				console.log( "resource.type: " + "Dataset" );
			});
		});
	})
}

main(args);