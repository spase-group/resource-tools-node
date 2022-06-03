#!/usr/bin/env node
"use strict";
/*eslint-disable no-console*/
/** 
  Scans SPASE descriptions and generates profiles
  which can be submitted to a solr search engine.
 
  Development funded by NASA.
 
 author: Todd King
 version: 1.00 2022-03-22
**/
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const fastXmlParser = require('fast-xml-parser');
const ResourceProfile = require('./ResourceProfile.js');
const duration = require("tinyduration")

// Configure the app
var options  = yargs
	.version('1.0.0')
	.usage('Scans SPASE descriptions and generates profiles which can be submitted to a solr search engine.\n\nUsage:\n\n$0 [args] <files...>')
	.example('$0 example.xml', 'generate a profile for example.xml')
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
    
		'v' : {
			alias: 'verbose',
			describe : 'show information while processing files',
			type: 'boolean',
			default: false
		},

		// File list
		'f' : {
			alias: 'file',
			describe : 'File containing a list of file names to scan.',
			type: 'string',
			default: null
		},

		// Registry ID
		'i' : {
			alias: 'id',
			describe : 'The registry ID to set for each resource.',
			type: 'string',
			default: ""
		},

		// Lookup service
		'l' : {
			alias: 'lookup',
			describe : 'The URL to the resource lookup service to resolve resource IDs.',
			type: 'string',
			default: "https://hpde.io/"
		},

		// Output
		'o' : {
			alias: 'output',
			describe : 'Output generated profiles to {file}. Default: console.log.',
			type: 'string',
			default: null
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

// Globals
var args = options._;	// Remaining non-hyphenated arguments
var outputFile = null;	// None defined.

/**
 * Close an output file if one is assigned.
 **/
var outputEnd = function() {
	if(outputFile) { outputFile.end(); outputFile = null }
}

/**
 * Convert a camelcase string to multiple space separated words.
 **/
var multiWord = function(value) {
	return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Get Convert a camelcase string to multiple space separated words.
 **/
var getResourceDoc = function(xmlDoc) {
	var header = null;
	
	// Find ResourceHeader
	// Base model
	if(content.Spase.NumericalData) { header = content.Spase.NumericalData.ResourceHeader; }
	if(content.Spase.DisplayData) { header = content.Spase.DisplayData.ResourceHeader; }
	if(content.Spase.Catalog) { header = content.Spase.Catalog.ResourceHeader; }
	if(content.Spase.Document) { header = content.Spase.Document.ResourceHeader; }
	if(content.Spase.Instrument) { header = content.Spase.Instrument.ResourceHeader; }
	if(content.Spase.Observatory) { header = content.Spase.Observatory.ResourceHeader; }
	if(content.Spase.Registry) { header = content.Spase.Registry.ResourceHeader; }
	if(content.Spase.Service) { header = content.Spase.Service.ResourceHeader; }
	if(content.Spase.Repository) { header = content.Spase.Repository.ResourceHeader; }
	if(content.Spase.Annotation) { header = content.Spase.Annotation.ResourceHeader; }
	
	if(content.Spase.Person) { header = content.Spase.Person; }
	if(content.Spase.Granule) { header = content.Spase.Granule; }

	// Simulation Extensions
	if(content.Spase.SimulationRun) { header = content.Spase.SimulationRun.ResourceHeader; }
	if(content.Spase.SimulationModel) { header = content.Spase.SimulationModel.ResourceHeader; }
	if(content.Spase.DisplayOutput) { header = content.Spase.DisplayOutput.ResourceHeader; }
	if(content.Spase.NumericalOutput) { header = content.Spase.NumericalOutput.ResourceHeader; }
	
  return header;
}

/** 
 * Read a list of file names from a file and load each one.
 * Lines beginning with a "#" are considered comments and ignored
  **/
var makeProfileFromFile = function(path)
{
  if(path == null) return;

  const lineReader = require('line-reader');

  lineReader.eachLine('file.txt', (line, last) => {
    if(line.startsWith("#")) return;	// Comment
    makeProfile(line);
  });  
}

/** 
 * Read all SPASE resource descriptions at the given path.
 * Resource descriptions are files that have a defined extension.
 * The path to the resources can be recusively searched.
 *
 * @param path		the pathname of the file to parse.
 **/
var makeProfile = function(pathname)
{
  if(pathname == null) return;
      
  var list = [];
  
	if(options.verbose) { console.log('Profiling: ' + pathname); }

  // Generate list of files. 
  var fstat = fs.lstatSync(pathname);
  
  // If 'path' is a folder get list of files with required extension
  if(fstat.isDirectory()) {
    list = fs.readdirSync(pathname, { withFileTypes: true })
      .filter(dirent => {
        if ( ! dirent.isFile()) { return false; }
        if(options.verbose) console.log("File: " + dirent.name);
        return path.extname(dirent.name) == options.ext;
      })
      .map(dirent => dirent.name);
  } else if(fstat.isFile()) {
    list.push(pathname);
  } else {
    return; // Not a file or directory
  }

  // Process each file
  list.forEach(async function(filename) {
    var fullpath = path.join(pathname, filename);
    var xmlDoc = fs.readFileSync(fullpath, 'utf8');
    var content = fastXmlParser.parse(xmlDoc);	// Check syntax
    var profile = new ResourceProfile(options.lookup);
    
    profile.version = content.Spase.Version;
    var resourceType = Object.keys(content.Spase)[1]  // Version is first, then resource description
    var resource = content.Spase[resourceType];

    profile.setResourceType(resourceType);
    profile.setResourceID(resource.ResourceID);
    profile.setAuthorityFromResourceID(resource.ResourceID);
    profile.setRegistryID(options.registryID);
    
		profile.setResourceName(resource.ResourceHeader.ResourceName);
		profile.setReleaseDate(resource.ResourceHeader.ReleaseDate);
		
		profile.setCadence(resource.TemporalDescription.Cadence);
		
		profile.addObservedRegion(resource.ObservedRegion);
		profile.addPhenomenonType(resource.PhenomenonType);
		profile.addMeasurementType(resource.MeasurementType);
		
		profile.setDescription(resource.ResourceHeader.Description);
		
		// Note: Catalog use "TimeSpan", others use "TemporalDescription"
    if(resource.TimeSpan) {
      profile.setStartDate(resource.TimeSpan.StartDate);
			if(resource.TimeSpan.RelativeEndDate) { // Version 1.2.* and prior used "RelativeEndDate"
        var d = duration.parse(resource.TimeSpan.RelativeEndDate);
        var now = new Date.now();
        
        now.setFullYear(now.getFullYear() - d.years);
        now.setMonth(now.getMonth() - d.months);
        now.setDay(now.getDay() - d.days);
        now.setHours(now.getHours() - d.hours);
        now.setMinutes(now.getMinutes() - d.minutes);
        now.setSeconds(now.getSeconds() - d.seconds);
        
        profile.setStopDate(now.toISOString())
			} else {
				profile.setStopDate(resource.TimeSpan.EndDate);
			}
    } else {  // After 1.2.* it was "RelativeStopDate"
      if(resource.TemporalDescription.TimeSpan.RelativeStopDate) {
        var d = duration.parse(resource.TemporalDescription.TimeSpan.RelativeStopDate);
        var now = new Date.now();
        
        now.setFullYear(now.getFullYear() - d.years);
        now.setMonth(now.getMonth() - d.months);
        now.setDay(now.getDay() - d.days);
        now.setHours(now.getHours() - d.hours);
        now.setMinutes(now.getMinutes() - d.minutes);
        now.setSeconds(now.getSeconds() - d.seconds);
        
        profile.setStopDate(now.toISOString())
      } else {
        profile.setStopDate(resource.TemporalDescription.TimeSpan.StopDate);
      }
    }
    
    // Add all words
    profile.addWords(profile.getWords(resource));

    // These tasks acquire outside information and will be done in parallel
    await (async() => {
      const response = await Promise.all([
          profile.setInstrumentID(resource.InstrumentID)
        ]);

      return;
    })();
    
    await profile.setObservatoryInfo(profile.observatoryID);
    
    // Normalize and print
    profile.normalize();
    profile.printSolrProfile(outputFile);
    
  });
  
  // Now recurse if asked to
  if(options.recurse) {
    list = fs.readdirSync(pathname, { withFileTypes: true })
      .filter( dirent => {
        if ( ! dirent.isDirectory()) { return false; }
        return true;
      })
      .map( dirent => path.join(pathname, dirent.name) );
    list.forEach(pathname => { makeProfile(pathname) } );
  }
}

/**
 * Application entry point.
 **/
var main = async function(args)
{

	if (process.argv.length == 0) {
	  yargs.showHelp();
	  return;
	}
	
	// Output
	if(options.output) {
		outputFile = fs.createWriteStream(options.output);
		// outputWrite(0, 'datacite:');
	}

	var pathname = args[0];
	
	await makeProfile(pathname);
	
	/* No longer process all args, just first
	// For all passed arguments
	for(var i = 0; i < args.length; i++) {
		walkSync(args[i], writeRequest);
	}
	*/
	
	outputEnd();
}

main(args);
