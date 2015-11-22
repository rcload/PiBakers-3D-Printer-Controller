var fs = require('./server/node_modules/fs-extra');

// Directories which must be created (in the order they must be created in)
var dirs = ['server/tmp', 'server/data'];

// Filenames -> Content to write
var files = {
	'server/data/config' : 'is_server false\nlocked false\nlog true\nslicer_path /bin/slic3r/bin/slic3r\nport 8080'
}

var clean = false;

for (var i in dirs) {

	// If the directory exists
	if (fs.existsSync(dirs[i])) {

		var stat = fs.statSync(dirs[i]);

		// And if clean is set, delete it
		if (clean) {

			if (stat.isDirectory()) {
				fs.rmdirSync(dir[i]);
			}
			else {
				fs.unlinkSync(dirs[i]);
			}

		}
		else {

			// If there is a file with the name of the directory we're trying to make, delete it
			if (!stat.isDirectory()) {
				fs.unlinkSync(dirs[i]);
				fs.mkdirSync(dirs[i]);
			}
			else {
				continue;
			}

			// Otherwise, it's directory already, and we don't need to do anything
		}
	}
	
	fs.mkdirSync(dirs[i]);
}

for (var i in files) {

	if (fs.existsSync(i)) {

		var stat = fs.statSync(i);

		if (clean) {

			if (stat.isDirectory()) {
				fs.rmdirSync(i);
			}
			else {
				fs.unlinkSync(i);
			}

		}
		else {

			// Only delete it if it's a directory, and can't be valid
			if (!stat.isFile()) {
				fs.rmdirSync(i);
			}
			else {
				continue;
			}

		}

	}
	
	fs.writeFile(i, files[i]);
}