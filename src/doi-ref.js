#!/usr/bin/env node
"use strict";
/** 
    Extract reference information for a DOI request from a SPASE resource description.
    Author: Todd King
**/
const fs = require('fs');
const yargs = require('yargs');
const fastXmlParser = require('fast-xml-parser');

var options  = yargs
	.version('1.0.2')
	.usage('Extract reference information in CSV format from a SPASE resource description.')
	.usage('$0 [args] <files...>')
	.example('$0 example.xml', 'Extract reference information from "example.xml"')
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
		
		// Only output records where a DOI is present
		'd' : {
			alias: 'doi',
			describe : 'Only output records where a DOI is present.',
			type: 'boolean',
			default: false
		},
		
		// Output
		'o' : {
			alias : 'output',
			description: 'Output file. Write output to a file.',
			type: 'string',
			default: null

		},
	})
	.argv
	;

// Globals
var args = options._;	// Remaining non-hyphenated arguments
var outputFile = null;	// None defined.

/** 
 * Write to output file if defined, otherwise to console.log()
 **/
var outputWrite = function(indent, str) {
	if(outputFile == null) {
		var prefix = "";
		for(var i = 0; i < indent; i++) { prefix += "   "; }
		console.log(prefix + str);
	} else {
		outputFile.write(str + "\n"); // Add new-line to mimic console.log()
	}
}

/**
 * Close an output file if one is assigned.
 **/
var outputEnd = function() {
	if(outputFile) { outputFile.end(); outputFile = null }
}

/**
 * List all files in a directory recursively and in a synchronous fashion
 **/
var walkSync = function(pathname, action) {
	var fs = fs || require('fs');
	if ( fs.statSync(pathname).isDirectory() ) {
		if(pathname.endsWith('.git')) return;	// Skip
		if(pathname.endsWith('.github')) return;	// Skip
		var files = fs.readdirSync(pathname);
		files.forEach(function(file) {
			// console.log('dir: ' + pathname);
			// console.log('file: ' + file);
			if ( fs.statSync(pathname + '/' + file).isDirectory() ) {
				walkSync(pathname + '/' + file, action);
			} else {
				action(pathname + '/' + file);
			}
		});
	} else {
		action(pathname);
	}
	return 
};

/**
 * Split a string on semi-colons.
 **/
var parseList = function(delimited) {
	var list = [];
	
	if(delimited) {	
		list = delimited.split(";");
		for(var i = 0; i < list.length; i++) {
			list[i] = list[i].trim();
		}
	}

	return list;	
}

/**
 * Convert a value to an array is value is singular,
 * other wise return the array.
 **/
var getList = function(value) {
	var list = [];
	if( ! value) return list;	// Empty
	
	if(Array.isArray(value)) list = value;
	else list[0] = value;
	
	return list;
}

/**
 * Convert a camelcase string to multiple space separated words.
 **/
var multiWord = function(value) {
	if( ! value.replace) return value;	// Not a string
	return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Make a name from a PersionID in author format (last, first[, middle])
 **/
var makeAuthorName = function(personID) {
	var part = personID.split('/');
	var name = part[part.length - 1].split('.');
	var author = name[name.length - 1];
	for(var i = 0; i < name.length - 1; i++) {
		author += ", " + name[i];
	}
	return author;
}

/** 
 * Convert a SPASE Role to an DataCite Contributor type.
 *
 **/
var convertRole = function(role) {
	if(role == 'Contributor') return 'Other';
	if(role == 'DataProducer') return 'Producer';
	if(role == 'GeneralContact') return 'ContactPerson';
	if(role == 'MetadataContact') return 'ContactPerson';
	if(role == 'Scientist') return 'Researcher';
	if(role == 'TeamLeader') return 'ProjectLeader';
	if(role == 'TeamMember') return 'ProjectMember';
	if(role == 'TechnicalContact') return 'ContactPerson';
	
	return null;	// Role doesn't map
}

/**
 * Get the resource description.
 **/
var getResource = function(content) {
	if( ! content.Spase ) return null;	// Not a SPASE description
	
	var resourceType = Object.keys(content.Spase)[1];	// 0 = "Version", 1 = Resource
	
	return content.Spase[resourceType];
}

/**
 * Get the resource type.
 **/
var getResourceType = function(content) {
	if( ! content.Spase ) return null;	// Not a SPASE description
	
	var resourceType = Object.keys(content.Spase)[1];	// 0 = "Version", 1 = Resource
	
	return resourceType;
}

/**
 * Retrieve the publisher from a resource description 
 * or return the default value from options.
 **/
var getResourceID = function(resource, options) {
	var id = options.id;
	
	if(resource) {
		id = resource.ResourceID;
	}
	
	return id;
}

/**
 * Retrieve the repository list from a resource description 
 * or return the default value from options.
 * 
 * If PublicationInfo is present use the declared authorlist,
 * otherwise build up an author list based on contacts.
 * Contacts with a Role of PrincipalInvestigator, CoPI, CoInvestigator,
 * TeamLeader, TeamMember, DataProducer or Contributor are included in the author list.
 **/
var getAuthorList = function(resource, options) {
	var list = parseList(options.author);

	// If publicationInfo - use given author list
	if(resource.ResourceHeader.PublicationInfo) {
		if(resource.ResourceHeader.PublicationInfo.Authors) {
			list = parseList(resource.ResourceHeader.PublicationInfo.Authors)

			return list;
		}
	}

	// If contacts - use them
	if( ! resource.ResourceHeader.Contact) { return list; }
	
	// Start with Principal Investigator
	var contacts = getList(resource.ResourceHeader.Contact);
	
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "PrincipalInvestigator") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	// Add CoPI
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "CoPI") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	// Add InstrumentLead
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "InstrumentLead") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};
	
	// Add Co-Investigators
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "CoInvestigator") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	// Add TeamLeader
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "TeamLeader") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	// Add TeamMember
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "TeamMember") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	// Add DataProducer
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "DataProducer") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	// Add Contributor
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "Contributor") {
				list.push(makeAuthorName(item.PersonID));
			}
		}
	};

	return list;
};

/**
 * Retrieve the publisher from a resource description 
 * or return the default value from options.
 **/
var getPublisher = function(resource, options) {
	var pub = "";
	
	if(options.publisher) {	pub = options.publisher; }
	
	if( resource.ResourceHeader.PublicationInfo) {
		pub = resource.ResourceHeader.PublicationInfo.PublishedBy;
	}
	
	if(pub.length == 0) {	// Build from AccessInformation.RepositoryID
		var delim = "";
		var access = getList(resource.AccessInformation)
		for(var k = 0; k < access.length; k++) {
			var item = access[k];
			var repo = item.RepositoryID;
			if(repo) {
				repo = repo.replace(/.*\//, "");
				pub += delim + repo;
				delim = ",";
			}
		};
	}	
	
	return pub;
}

/**
 * Retrieve the publication year from a resource description 
 * or return the default value from options.
 **/
var getPubYear = function(resource, options) {
	var year = options.date;	// Should be current year
	
	if( resource.ResourceHeader.PublicationInfo) {
		year = resource.ResourceHeader.PublicationInfo.PublicationDate.substring(0,4);
	} else {
		year = resource.ResourceHeader.ReleaseDate.substring(0,4)
	}
	
	return year;
}

/**
 * Retrieve the title (ResourceName) from a resource description 
 * or return the default value from options.
 **/
var getTitle = function(resource, options) {
	var name = options.title;
	
	if(resource.ResourceHeader.ResourceName) {
		name = resource.ResourceHeader.ResourceName;
	}
	
	return name;
}

/**
 * Retrieve the funding information from a resource description.
 **/
var getFunding = function(resource) {
	return getList(resource.ResourceHeader.funding);
}

/**
 * Retrieve the funding information from a resource description
 * or return the default value from options.
 **/
var getDOI = function(resource, options) {
	var doi = options.doi;
	if(resource.ResourceHeader.DOI) { doi = resource.ResourceHeader.DOI; }
	
	if( ! doi) doi = " ";
	
	return doi;
}

/**
 * Retrieve the description from a resource description 
 * or return the default value from options.
 **/
var getDescription = function(resource, options) {
	var desc = options.description;	// Should be current year
	
	desc = resource.ResourceHeader.Description;
	
	if(options.output) {	// Remove new lines in text
		desc = desc.replace(/[\r\n]+/g, " ");
	}
	
	return desc;
}

/**
 * Parse a ResourceID and extract the naming authority.
 **/
var getAuthority = function(resourceID) {
	var buffer = "";
	
	if( ! resourceID) return buffer;
	
	buffer = resourceID.replace(/spase:\/\//, "");
	
	var part = buffer.split('/');
	return part[0];
};

/**
 * Build up a list of keywords.
 *
 * List is a combinartion of ProcessingLevel, MeasurementType and values in Keyword
 **/
var getKeywords = function(resource) {
	var keywords = getList(resource.Keyword);
	
	if(resource.ProcessingLevel) keywords.push(resource.ProcessingLevel);
	if(resource.MeasurementType) keywords.push(multiWord(resource.MeasurementType));
	
	return keywords;
};

/**
 * Retrieve the contributor list from a resource description 
 * or return the default value from options.
 * 
 * Contacts with a Role of Contributor are included in the author list.
 **/
var getContributorList = function(resource, options) {
	var list = [];
	
	var names = parseList(options.contributor);
	if(names) {
		for(var i = 0; i < names.length; i++) {
			list.push({name: names[i], role: 'ContactPerson'});
		}
	}

	// If contacts - use them
	if( ! resource.ResourceHeader.Contact) return list;
		
	// Add Contributors
	var contacts = getList(resource.ResourceHeader.Contact)
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			var contribType = convertRole(role[n]);
			if(contribType) {
				list.push({ name: makeAuthorName(item.PersonID), role: contribType} );
			}
		}
	};
	
	return list;
}

/**
  Write reference record for a SPASE resource description.
**/  
var writeReference = function(pathname) {
	if( options.ext.length > 0 && ! pathname.endsWith(options.ext)) return;	// Skip - only process files with matching extension

	// XML Document
	if(options.verbose) { console.log('Parsing: ' + pathname); }
		
	var xmlDoc = fs.readFileSync(pathname, 'utf8');
	var content = fastXmlParser.parse(xmlDoc);	// Check syntax
	
	var resource = getResource(content);
	if( ! resource) {
		console.log('File is not a SPASE resource description: ' + pathname);
		return;
	}
	
	if( ! resource.ResourceHeader) {
		console.log('File is not a SPASE data resource description: ' + pathname);
		return;
	}
	
	if( options.doi ) {
		if(getDOI(resource, options).length == 0) return;
	}
	
	var record = "";
	var delim = "";
	
	// SPASEID, DOI, Creator, Title, Publisher, PubYear, Keywords, Contrib, ResourceType, Abstract, Funding

	record += '"' + getResourceID(resource, options) + '"';
	record += ',"' + getDOI(resource, options) + '"';

	var delim = ',"';
	var list = getAuthorList(resource, options);
	if(list.length > 0) {
		for(var i = 0; i < list.length; i++) {
			record += delim + list[i];
			delim = ";";
		}
	} else {	//Empty
		record += delim; 
	}
	record += '"';
	
	record += ',"' + getTitle(resource, options) + '"';
	record += ',"' + getPublisher(resource, options) + '"';
	record += ',"' + getPubYear(resource, options) + '"';
	
	delim = ',"';
	var keywords = getKeywords(resource);
	if(keywords.length > 0) {
		record += delim;
		if( keywords[i] ) { record += keywords[i]; }
		delim = ";";
	} else { //Empty
		record += delim;
	}
	record += '"';
	
	delim = ',"';
	var contrib = getContributorList(resource, options);
	if(contrib.length > 0) {
		for(var i = 0; i < contrib.length; i++) {
			record += delim + contrib[i].name + ' [' + contrib[i].role + ']';
			delim = ";";
		}
	} else { //Empty
		record += delim;
	}
	record += '"';

	record += ',"' + getResourceType(content) + '"';
	
	record += ',"' + getDescription(resource, options).replace(/"/g, '""') + '"';
	
	delim = ','
	var funding = getFunding(resource);
	if(funding.length > 0) {
		record += '"';
		for(var i =0; i < funding.length; i++) {
			record += delim + funding[i].Agency + '[' + funding[i].AwardNumber + ']';
			delim = ";";
		}
		record += '"';
	} else { //Empty
		record += delim + '" "';
	}
	
	outputWrite(0, record);
}
/**
 * Application entry point.
 **/
var main = function(args)
{

	if (process.argv.length == 0) {
	  yargs.showHelp();
	  return;
	}
	
	// Output
	if(options.output) {
		outputFile = fs.createWriteStream(options.output);
	}
	
	outputWrite(0, 'SPASEID, DOI, Creator, Title, Publisher, PubYear, Keywords, Contrib, ResourceType, Abstract, Funding');
	
	// For all passed arguments
	for(var i = 0; i < args.length; i++) {
		walkSync(args[i], writeReference);
	}
	
	outputEnd();
}

main(args);
