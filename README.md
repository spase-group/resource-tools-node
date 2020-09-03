# SPASE resource-tools

A collection of command line tools for working with SPASE resource descriptions.

## Installation

`npm install spase-resource-tools -g`

## Tools

**spase-collate** : Separate each SPASE resource description in a file into a separate file stored in a folder tree according to the Resource ID.

**spase-refcheck** : Check resource identifiers and URLs for referential integrity.

**spase-validate** : Validate a SPASE resource description using a specified version of the data dictionary (XML schema).

**spase-tree** : List the file tree. Optionally list only files with a given extension.

**spase-update-authority** : Change the control authority in the ResourceID, add a PriorID and update ReleaseDate.

**spase-doi-ref** : Extract reference information in CSV format from a SPASE resource description.

**spase-doi-request** : Extract information from a SPASE resource description and generate a DataCite formated DOI request that can be submitted through EZID web service API.

**spase-list-elem** : List an element value in an XML document.

**spase-restamp** : Update the <ReleaseDate> to the current data and time. 

**spase-pretty** : Make a pretty XML file by formating the XML file with indentation and wrapping. 

**spase-transform** : Transform a SPASE description in XML using an XML Stylesheet. 

