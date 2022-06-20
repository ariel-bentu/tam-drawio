# How to seamlessly run draw.io desktop version on Mac with command-line argument

- Close all instances of the draw.io application
- (Optional) Depending on how you installed the desktop application, you may be not the owner of it's files (in my case it was owned by root user). To make the process of application modification easier and not use sudo with every command, it would be convenient to change ownership of the application files.
 
`chown -R `whoami`:staff /Applications/draw.io.app`
 
You are going to modify contents of signed application, so you need to make it not signed (kind of switching it to a development mode). For this purpose delete (or rename) the folder with code resources checksums
 
`rm -rf /Applications/draw.io.app/Contents/_CodeSignature`
 
Next, you need to add a shell script that will run the original binary with an additional command line argument.
 
`echo '#!/usr/bin/env bash\nexec /Applications/draw.io.app/Contents/MacOS/draw.io --enable-plugins' > /Applications/draw.io.app/Contents/MacOS/draw.io.sh`

The, make the script executable
 
`chmod +x /Applications/draw.io.app/Contents/MacOS/draw.io.sh`
 
Now you need to make the application-descriptor editable, delete the extended macOS attributes from it
 
`xattr -c /Applications/draw.io.app/Contents/Info.plist`
 
Fortunately, draw.io uses the plain-text XML version of plist, so you don't need to decode binary and encode it back with Xcode . Now set a different executable as a starting point of application
 
`sed -i -e 's/\<key\>CFBundleExecutable\<\/key\>\<string\>draw.io\<\/string\>/\<key\>CFBundleExecutable\<\/key\>\<string\>draw.io.sh\<\/string\>/g' /Applications/draw.io.app/Contents/Info.plist`
 
The last, but important step, is to re-register the application in the Launchpad service of macOS (otherwise, the cached application descriptor will drive you crazy trying to figure out what was wrong with the previous steps)
 
`/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/draw.io.app`



Thanks to [micellius](https://github.com/micellius) for assemblying this option