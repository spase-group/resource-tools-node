/**
 * walk-tree module
 *
 * Derived from obsolete walk-folder-tree
 *
 * Simplified interface, removed some dependencies, made more Node 8+ compatible.
 **/

// modules
const fs = require('fs');
const pathModule = require('path');
const Promise = require('bluebird');
const util = require('util');

// exports
module.exports = function(path, options, fn) {
    // conform arguments

    // allow (path, fn) with default options
    if (typeof options == 'function') {
        fn = options;
		options = {};
    }

    if (!path) {
        throw new Error('`path` must be provided');
    }
    if (!options) options = {};
    if (!fn) {
        throw new Error('`fn` callback must be provided');
    }

    // conform options
    var _options = {
		recurse: true,
		filterFiles: /^.*$/,	// Everything
		filterFolders: /(^[.]$|^[^.])/, //  ignore folders starting with ., except for '.' (current directory)
		return: false
        //sort: undefined
	};
	if( ! options.recurse) options.recurse = _options.recurse;
	if( ! options.filterFiles) options.filterFiles = _options.recurse;
	if( ! options.return) options.return = _options.return;
    if( ! options.filterFolders) options.filterFolders = _options.filterFolders;

    // convert fn to promise-returning function
    if (fn) fn = Promise.promisify(fn);

	fs.readdirAsync = Promise.promisify(fs.readdir);
	fs.statAsync = Promise.promisify(fs.stat);

    // process directory's contents
    var files;
    if (options.return) files = [];

    return processFiles('')
    .then(function() {
        return files;
    });

    function processFiles(folderPath) {
        var folders = [];

        // iterate through directory contents
        return fs.readdirAsync(pathModule.join(path, folderPath))
        .then(function(files) {
            return files.sort(options.sort);
        })
        .each(function(filename) {
            var filePath = pathModule.join(folderPath, filename),
                fullPath = pathModule.join(path, filePath);

            return fs.statAsync(fullPath)
            .then(function(stat) {
                // process file/folder
                var isDir = stat.isDirectory(),
                    filter = isDir ? options.filterFolders : options.filterFiles;

                if (!filename.match(filter)) return;

                if (isDir && options.recurse) folders.push(filePath);

                var params = {
                    path: filePath,
                    fullPath: fullPath,
                    name: filename,
                    directory: isDir,
                    stat: stat
                };

                if (options.return) files.push(params);

                if (fn) return fn(params);
            });
        })
        .then(function() {
            // process folders
            return Promise.each(folders, processFiles);
        });
    }
};