#!/usr/bin/env node
"use strict";
/*eslint-disable no-console*/
/** 
    Extract reference information from a DOI request XML
    Author: Todd King
**/
const fs = require('fs');
const yargs = require('yargs');
const fastXmlParser = require('fast-xml-parser');

// Configure the app
var options  = yargs
	.version('1.0.1')
	.usage('Extract information from a SPASE resource description and generate a DataCite formated DOI request that can be submitted through EZID web service API.\n\nUsage:\n\n$0 [args] <files...>')
	.example('$0 example.xml', 'generate a DOI request')
	.epilog("Development funded by NASA's HPDE project at UCLA.")
	.showHelpOnFail(false, "Specify --help for available options")
	.help('h')
	
	// version
	.options({
		// help text
		'h' : {
			alias : 'help',
			description: 'Show information about the app.'
		},		

		// Author list (creators)
		'a' : {
			alias : 'author',
			description: 'Author list. Separate names with semi-colon. Names are first, last[, middle]',
			type: 'string',
			default: null

		},

		// Assigned DOI 
		'x' : {
			alias : 'doi',
			description: 'The DOI assigned to or reserved for the resource.',
			type: 'string',
			default: '(:tba)'

		},

		// Contributor list 
		'c' : {
			alias : 'contributor',
			description: 'Contributor list. Separate names with semi-colon. Names are first, last[, middle]',
			type: 'string',
			default: null

		},

		// Publisher
		'p' : {
			alias : 'publisher',
			description: 'Name of the publisher.',
			type: 'string',
			default: null

		},

		// Identifier
		'i' : {
			alias : 'id',
			description: 'Resource identifier.',
			type: 'string',
			default: null

		},

		// Landing page URL
		'l' : {
			alias : 'landing',
			description: 'The landing page URL.',
			type: 'string',
			default: "http://spase.info/registry/render?id=%s"

		},
		
		// Publication date 
		'd' : {
			alias : 'date',
			description: 'Publication date (YYYY-MM-DD).',
			type: 'string',
			default: ""

		},
		
		// Title
		't' : {
			alias : 'title',
			description: 'Publication title.',
			type: 'string',
			default: ""

		},
		
		// Output
		'o' : {
			alias : 'output',
			description: 'Output file. Written in format suitable for an API submission.',
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
		outputFile.write(str);
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
 * Convert a SPASE Role to a DataCite Contributor type.
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
 * Convert a SPASE Resource Type to a DataCite Content type.
 *
 **/
var convertResourceType = function(resourceType) {
	if(resourceType == 'DisplayData') return 'Collection';
	if(resourceType == 'NumericalData') return 'Dataset';
	if(resourceType == 'Catalog') return 'Dataset';
	
	return null;	// doesn't map
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
 * Retrieve the publisher from a resource description 
 * or return the default value from options.
 **/
var getPublisher = function(resource, options) {
	var pub = getAuthority(getResourceID(resource, options));
	
	if(options.publisher) pub = options.publisher;
		
	if( resource.ResourceHeader.PublicationInfo) {
		pub = resource.ResourceHeader.PublicationInfo.PublishedBy;
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
 * Retrieve the author list from a resource description 
 * or return the default value from options.
 * 
 * If PublicationInfo is present use the declared authorlist,
 * otherwise build up an author list based on contacts.
 * Contacts with a Role of PrincipalInvestigator, CoInvestigator
 * or Contributor are included in the author list.
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
	if( ! resource.ResourceHeader.Contact) return list;
	
	// Start with Principal Investigator
	var contacts = getList(resource.ResourceHeader.Contact)
	for(var k = 0; k < contacts.length; k++) {
		var item = contacts[k];
		var role = getList(item.Role);
		for(var n = 0; n < role.length; n++) {
			if(role[n] == "PrincipalInvestigator") {
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

	return list;
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
  Write DOI request for a SPASE resource description.
**/  
var writeRequest = function(pathname) {
	// XML Document
	if(options.verbose) { console.log('Parsing: ' + pathname); }
		
	var xmlDoc = fs.readFileSync(pathname, 'utf8');
	var content = fastXmlParser.parse(xmlDoc);	// Check syntax
	
	var resource = getResource(content);
	if( ! resource) {
		console.log('File is not a SPASE resource description: ' + pathname);
		return;
	}
	var resourceType = getResourceType(content);
	
	outputWrite(0, '<resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xsi:schemaLocation="http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4/metadata.xsd">');

	outputWrite(1, '<identifier identifierType="DOI">' + getDOI(resource, options) + '</identifier>');

	outputWrite(1, '<creators>');
	
	var list = getAuthorList(resource, options);
	for(var i = 0; i < list.length; i++) {
		outputWrite(2, '<creator>');
		outputWrite(3, '<creatorName>' + list[i] + '</creatorName>');
		outputWrite(2, '</creator>');
	}
	outputWrite(1, '</creators>');
	outputWrite(1, '<titles>');
	outputWrite(2, '<title>' + getTitle(resource, options)  + '</title>');
	outputWrite(1, '</titles>');
	outputWrite(1, '<publisher>' + getPublisher(resource, options) + '</publisher>');
	outputWrite(1, '<publicationYear>' + getPubYear(resource, options) + '</publicationYear>');
	var keywords = getKeywords(resource);
	if(keywords.length > 0) {
		outputWrite(1, '<subjects>');
		for(var i = 0; i < keywords.length; i++) {
			if( keywords[i] ) {
				outputWrite(2, '<subject xml:lang="en">' + keywords[i] + '</subject>');
			}
		}
		outputWrite(1, '</subjects>');
	}
	var contrib = getContributorList(resource, options);
	if(contrib.length > 0) {
		outputWrite(1, '<contributors>');
		for(var i = 0; i < contrib.length; i++) {
			outputWrite(2, '<contributor contributorType="' + contrib[i].role + '">');
			outputWrite(3, '<contributorName>' + contrib[i].name + '</contributorName>');
			outputWrite(2, '</contributor>');
		}
		outputWrite(1, '</contributors>');		
	}
	outputWrite(1, '<language>en-US</language>');
	outputWrite(1, '<resourceType resourceTypeGeneral="' + convertResourceType(resourceType) + '">' + convertResourceType(resourceType) + '</resourceType>');
	outputWrite(1, '<alternateIdentifiers>');
	outputWrite(2, '<alternateIdentifier alternateIdentifierType="SPASE">' + getResourceID(resource, options) + '</alternateIdentifier>');
	outputWrite(1, '</alternateIdentifiers>');
	outputWrite(1, '<descriptions>');
	outputWrite(2, '<description descriptionType="Abstract">');
	outputWrite(0, getDescription(resource, options));
	outputWrite(2, '</description>');
	outputWrite(1, '</descriptions>');
	var funding = getFunding(resource);
	if(funding.lenght > 0) {
		outputWrite(1, '<fundingReferences>');
		for(var i =0; i < funding.length; i++) {
			outputWrite(2, '<fundingReference>');
			outputWrite(3, '<funderName>' + funding[i].Agency + '</funderName>');
			outputWrite(3, '<awardNumber>' + funding[i].AwardNumber + '</awardNumber>');
			outputWrite(2, '</fundingReference>');
		}
		outputWrite(1, '</fundingReferences>');
	}
	
	outputWrite(0, '</resource>');
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
		outputWrite(0, 'datacite:');
	}
		
	outputWrite(0, '<?xml version="1.0"?>');
	
	// For all passed arguments
	for(var i = 0; i < args.length; i++) {
		walkSync(args[i], writeRequest);
	}

	outputEnd();
}

main(args);
