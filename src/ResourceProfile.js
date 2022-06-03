/**
 * Resource profile class. 
 * Data and methods to manage resource information.
 *
 * Development funded by NASA's VMO project at UCLA.
 *
 * @author Todd King
 * @version 1.00 2022-03-22
 */

const axios = require('axios');
const fastXmlParser = require('fast-xml-parser');

function ResourceProfile(lookup) {
  this.lookup = lookup;
  this.version = "1.0.0";
  this.registryID = "";
  this.resourceType = "";
  this.resourceID = "";
  this.resourceName = "";
  this.releaseDate = "";
  this.startDate = "";
  this.stopDate = "";
  this.cadence = "";
  this.measurementType = new Array();
  this.phenomenonType = new Array();
  this.observedRegion = new Array();
  this.observatoryName = "";
  this.observatoryID = "";
  this.observatoryGroup = new Array();
  this.observatoryType = "";
  this.observatoryLocation = "";
  this.instrumentID = "";
  this.instrumentName = "";
  this.instrumentType = "";
  this.description = "";
  this.authority = "";
  this.latitude = "";
  this.longitude = "";
  this.association = new Array();
  this.words = new Array();
}

/** 
 * Write to output file if defined, otherwise to console.log()
 **/
ResourceProfile.prototype.outputWrite = function(outputFile, str) {
	if(outputFile == null) {
		var prefix = "";
		console.log(str);
	} else {
		outputFile.write(str);
	}
}

/**
 * Print an XML document suitable for loading into a solr search engine.
 *
 * @param out		the @link{PrintStream} to emit the XML document.
 *
 * @since           1.0
 **/
ResourceProfile.prototype.printSolrProfile = function(outputFile) {
  this.outputWrite(outputFile, "<doc>");
  this.outputWrite(outputFile, "   <field name=\"registryid\">" + this.registryID + "</field>");
  this.outputWrite(outputFile, "   <field name=\"resourcetype\">" + this.resourceType + "</field>");
  this.outputWrite(outputFile, "   <field name=\"resourceid\">" + this.resourceID + "</field>");
  this.outputWrite(outputFile, "   <field name=\"resourcename\">" + this.resourceName + "</field>");
  this.measurementType.forEach(item => this.outputWrite(outputFile, "   <field name=\"measurementtype\">" + item + "</field>") );
  this.phenomenonType.forEach(item => this.outputWrite(outputFile, "   <field name=\"phenomenontype\">" + item + "</field>") );
  this.observedRegion.forEach(item => this.outputWrite(outputFile, "   <field name=\"observedregion\">" + item + "</field>") );
  this.observatoryGroup.forEach(item => this.outputWrite(outputFile, "   <field name=\"observatorygroup\">" + item + "</field>") );
  this.outputWrite(outputFile, "   <field name=\"observatoryid\">" + this.observatoryID + "</field>");
  this.outputWrite(outputFile, "   <field name=\"observatoryname\">" + this.observatoryName + "</field>");
  this.outputWrite(outputFile, "   <field name=\"observatorytype\">" + this.observatoryType + "</field>");
  this.outputWrite(outputFile, "   <field name=\"observatorylocation\">" + this.observatoryLocation + "</field>");
  this.outputWrite(outputFile, "   <field name=\"instrumentid\">" + this.instrumentID + "</field>");
  this.outputWrite(outputFile, "   <field name=\"instrumentname\">" + this.instrumentName + "</field>");
  this.outputWrite(outputFile, "   <field name=\"instrumenttype\">" + this.instrumentType + "</field>");
  this.outputWrite(outputFile, "   <field name=\"releasedate\">" + this.releaseDate + "</field>");
  this.outputWrite(outputFile, "   <field name=\"startdate\">" + this.startDate + "</field>");
  this.outputWrite(outputFile, "   <field name=\"stopdate\">" + this.stopDate + "</field>");
  this.outputWrite(outputFile, "   <field name=\"cadence\">" + this.cadence + "</field>");
  this.outputWrite(outputFile, "   <field name=\"latitude\">" + this.latitude + "</field>");
  this.outputWrite(outputFile, "   <field name=\"longitude\">" + this.longitude + "</field>");
  this.outputWrite(outputFile, "   <field name=\"description\">" + this.description + "</field>");
  this.outputWrite(outputFile, "   <field name=\"authority\">" + this.authority + "</field>");

  this.association.forEach(item => this.outputWrite(outputFile, "   <field name=\"association\">" + item + "</field>") );
  this.words.forEach(item => this.outputWrite(outputFile, "   <field name=\"word\">" + item + "</field>") );

  this.outputWrite(outputFile, "</doc>");
}

/**
 * String Extenstion to format string for xml content.
 * Replces xml escape chracters to their equivalent html notation.
 **/
ResourceProfile.prototype.escapeXML = function (value) {
  if( ! value) return value;
  
  var result = value;
  if (result.trim() != "") {
    result = result.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    result = result.replace(/&(?!(amp;)|(lt;)|(gt;)|(quot;)|(#39;)|(apos;))/g, "&amp;");
    result = result.replace(/([^\\])((\\\\)*)\\(?![\\/{])/g, "$1\\\\$2");  //replaces odd backslash(\\) with even.
  } else {
    result = "";
  }
  return result;
}

/** 
 * Set undefined values to normalized states.
 *
 * @since           1.0
 **/
ResourceProfile.prototype.normalize = function () {
  if( ! this.startDate ) this.startDate = "0000-00-00T00:00:00Z";
  if( ! this.stopDate ) this.stopDate = "9999-12-31T24:00:00Z";
  if( ! this.releaseDate ) this.releaseDate = new Date().toISOString();

  this.startDate = this.fixTime(this.startDate);	
  this.stopDate = this.fixTime(this.stopDate);
  this.releaseDate = this.fixTime(this.releaseDate);
  
  // A cludge of a fix. Sometimes text has XML entities which are not properly coded. "&" is the only one handled
  this.resourceName = this.escapeXML(this.resourceName);
  this.observatoryName = this.escapeXML(this.observatoryName);
  this.instrumentName = this.escapeXML(this.instrumentName);
  this.description = this.escapeXML(this.description);
  
  // Deal with arrays, add empty element if array is empty
  if( ! this.measurementType) this.measurementType = [""];
  if( ! this.phenomenonType) this.phenomenonType = [""];
  if( ! this.observedRegion) this.observedRegion = [""];
  if( ! this.observatoryGroup) this.observatoryGroup = [""];
  if( ! this.association) this.association = [""];
  if( ! this.words) this.words = [""];
  // this.words = Array.from(new Set(this.words)); // Create a unique list of words
}
   
/** 
 * Modify a time string to be ISO 8601 compliant.
 * The string is assumed to be nearly ISO 8601 compliant and
 * to have the nominal format of "YYYY-MM-DD HH:MM:SS.sss"
 * This will replace all spaces with a "T" and ensure
 * that the string ends with a "Z".
 *
 * @since           1.0
  **/
ResourceProfile.prototype.fixTime = function(time) {
  time = time.trim();
  time = time.replace(" ", "T");
  if( ! time.endsWith("Z")) time += "Z";
  
  return time;
}

/**
 * Convert a value to a single value. 
 * If the passed value is a string return the string.
 * If the passed value is an array return the first element.
 **/
ResourceProfile.prototype.singleValue = function(value) {
  if(Array.isArray(value)) {
    if(value.length > 0) return value[0]; 
  }
  
  return value;
}

/**
 * Convert a value to an array. 
 * If the passed value is a string return an array with one element containing the string.
 * If the passed value is an array return the passed value.
 **/
ResourceProfile.prototype.multiValue = function(value) {
  if(Array.isArray(value)) { return(value); } // Return it
  
  // Otherwise create an array with one value.
  var result = [];
  result.push(value);
  
  return result;
}

/**
 * Get all the words in a structured document (object)
 **/
ResourceProfile.prototype.getWords = function(doc) {
  var words = Array();
  
  var strings = Object.values(doc);

  strings.forEach(item => {
    // Replace . in enumerations with space
    if(typeof item === 'string' ) { // Parse 
      var str = item.replace(/\w\.\w/g, ' ');
      // remove common punctuation, then split on space
      words = words.concat( item.replace(/\w\.\w/g, ' ').replace(/[:\/]+/g, ' ').replace(/[.,;()\[\]]+/g, '').split(' ') );
    } else { // Recursive build
      words = words.concat(this.getWords(item));
    }
  });
  
  return words;
}

ResourceProfile.prototype.setInstrumentID = async function(instrumentID) {
  var doc = null;
  
  this.instrumentID = this.singleValue(instrumentID);
  this.instrumentName = "Unknown";

  if( ! this.instrumentID ) return;
  
  var url = this.lookup + this.instrumentID.replace(/^spase:\/\//, "") + ".xml";
  
  try {
    const response = await axios.get(url);
    var doc = fastXmlParser.parse(response.data);	// Check syntax
  } catch (error) {
    console.error(error);
  }

  if(doc) {
    this.setInstrumentName(doc.Spase.Instrument.ResourceHeader.ResourceName);
    this.setInstrumentType(doc.Spase.Instrument.InstrumentType);
    this.setObservatoryID(doc.Spase.Instrument.ObservatoryID);
  }
}
/**
 * Set the observatory information from the observatory ID
  *
  * @param profile		the {ResourceProfile} to update.
  *
 * @since           1.0
  **/
ResourceProfile.prototype.setObservatoryInfo = async function(observatoryID)
{
  var doc = null;
  
  this.observatoryID = this.singleValue(observatoryID);
  if( ! this.observatoryID ) return;
  
  var url = this.lookup + this.observatoryID.replace(/^spase:\/\//, "") + ".xml";
  
  try {
    const response = await axios.get(url);
    var doc = fastXmlParser.parse(response.data);	// Check syntax
  } catch (error) {
    console.error(error);
  }

  if(doc) {
    this.addObservatoryGroup(doc.Spase.Observatory.ObservatoryGroup);
    this.setObservatoryName(doc.Spase.Observatory.ResourceHeader.ResourceName);
    
    this.setObservatoryType("Spacecraft");	// If Region is not specified assume to be spacecraft

    this.setObservatoryLocation(doc.Spase.Observatory.Location.ObservatoryRegion);
    
    var region = this.singleValue(doc.Spase.Observatory.Location.ObservatoryRegion);
    if(region != null) {	// Region specified
      if(region == "Earth.Surface") { // Groundbased
        this.setObservatoryType("Groundbased");
        this.setLatitude(doc.Spase.Observatory.Location.Latitude);
        this.setLongitude(doc.Spase.Observatory.Location.Longitude);
      } else {	// Spacecraft
        this.setObservatoryType("Spacecraft");
      }
    }
    // this.addWords(org.spase.tools.XMLGrep.getWords(segment));
  }
}
  
// Functions to set values. Constrains value to appropriate data type 
ResourceProfile.prototype.setRegistryID = function(value) { this.registryID = this.singleValue(value); }
ResourceProfile.prototype.setResourceType = function(value) { this.resourceType = this.singleValue(value); }
ResourceProfile.prototype.setResourceID = function(value) { this.resourceID = this.singleValue(value); }
ResourceProfile.prototype.setResourceID = function(value) { this.resourceID = this.singleValue(value); }
ResourceProfile.prototype.setResourceName = function(value) { this.resourceName = this.singleValue(value); }
ResourceProfile.prototype.setReleaseDate = function(value) { this.releaseDate = this.singleValue(value); }
ResourceProfile.prototype.setStartDate = function(value) { this.startDate = this.singleValue(value); }
ResourceProfile.prototype.setStopDate = function(value) { this.stopDate = this.singleValue(value); }
ResourceProfile.prototype.setCadence = function(value) { this.cadence = this.singleValue(value); }
ResourceProfile.prototype.addMeasurementType = function(value) { this.measurementType = this.measurementType.concat(this.multiValue(value)); }
ResourceProfile.prototype.addPhenomenonType = function(value) { this.phenomenonType = this.phenomenonType.concat(this.multiValue(value)); }
ResourceProfile.prototype.addObservedRegion = function(value) { this.observedRegion = this.observedRegion.concat(this.multiValue(value)); }
ResourceProfile.prototype.setObservatoryName = function(value) { this.observatoryName = this.singleValue(value); }
ResourceProfile.prototype.setObservatoryID = function(value) { this.observatoryID = this.singleValue(value); }
ResourceProfile.prototype.addObservatoryGroup = function(value) { this.observatoryGroup = this.observatoryGroup.concat(this.multiValue(value)); }
ResourceProfile.prototype.setObservatoryType = function(value) { this.observatoryType = this.singleValue(value); }
ResourceProfile.prototype.setObservatoryLocation = function(value) { this.observatoryLocation = this.singleValue(value); }
ResourceProfile.prototype.setInstrumentType = function(value) { this.instrumentType = this.singleValue(value); }
ResourceProfile.prototype.setInstrumentName = function(value) { this.instrumentName = this.singleValue(value); }
ResourceProfile.prototype.setLatitude = function(value) { this.latitude = this.singleValue(value); }
ResourceProfile.prototype.setLongitude = function(value) { this.longitude = this.singleValue(value); }
ResourceProfile.prototype.setDescription = function(value) { this.description = this.singleValue(value); }
ResourceProfile.prototype.setAuthority = function(value) { this.authority = this.singleValue(value); }
ResourceProfile.prototype.setAuthorityFromResourceID = function() { setAuthorityFromResourceID(mResourceID); }
ResourceProfile.prototype.addAssociation = function(value) { this.association = this.association.concat(this.multiValue(value)); }
ResourceProfile.prototype.addWords = function(value) { this.words = this.words.concat(this.multiValue(value)); /* Make unique list */ this.words = Array.from(new Set(this.words)); }

ResourceProfile.prototype.setAuthorityFromResourceID = function(resourceID) 	{ 
  if( ! resourceID.startsWith("spase:")) return; // Not a SPASE ResourceID
    
  this.authority = resourceID.replace(/^spase:\/\//, "").replace(/\/.*/, "");
}

// Make global
module.exports = ResourceProfile;
