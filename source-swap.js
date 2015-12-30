#! /usr/bin/env node

var fs = require('fs');
var readline = require('readline');

function loadSources(sourcesPath){
    var sources = [];
    var files = fs.readdirSync(sourcesPath);

    files.forEach(function eachFileCallback(file){
        var content = fs.readFileSync(sourcesPath + '/' + file + '/source.properties', 'utf-8');
        if (!content){
            console.warn(file + ' does not contain proper source.properties file');
            return;
        }
        content.split('\n').every(function eachLineCallback(line){
            if (line.slice(0, 24) === 'AndroidVersion.ApiLevel='){
                var sdk = {version: parseInt(line.slice(24)), path: sourcesPath, file: file};
                sources.push(sdk);
                return false;
            }
            return true;
        });
    });
    return sources;
}

function printSources(sources, output){
    output('===== Installed Android SDK Version Sources =====');
    sources.forEach(function eachSourceCallback(source){
        output('- Android SDK Version ' + source.version + ' (in folder ' + source.file + ')');
    });
    output('=================================================');
}

function getSourceObject(sources, sdkInt){
    return sources.find(function search(source){
        return source.version === sdkInt;
    });
}

function cleanUp(sources){
    var myTmpSources = [];
    var timestamp = Date.now();
    // First step: append current timestamp to each folder, this minimizes changes of renaming collisions
    sources.forEach(function eachSourceCallback(source){
        fs.renameSync(source.path + '/' + source.file, source.path + '/' + source.file + '_' + timestamp);
    });
    // Second step: rename all folders with their correct sdk version
    sources.forEach(function eachSourceCallback(source){
        fs.renameSync(source.path + '/' + source.file + '_' + timestamp, source.path + '/android-' + source.version);
    });
};

function isVersionInstalled(sources, sdkInt){
    return getSourceObject(source, sdkInt) !== undefined;
}

function renameForUsage(projectSDKSource, deviceSDKSource){
    fs.renameSync(projectSDKSource.path + '/' + projectSDKSource.file, projectSDKSource.path + '/' + projectSDKSource.file + '_' + Date.now());
    fs.renameSync(deviceSDKSource.path + '/' + deviceSDKSource.file, deviceSDKSource.path + '/android-' + projectSDKSource.version);
}

function askUser(question, callback){
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question + ' ', function(answer) {
        rl.close();
        callback(answer);
    });
}

(function(){
    process.stdout.write('Checking for ANDROID_HOME variable');
    var androidHome = process.env.ANDROID_HOME;
    if (!androidHome){
        console.warn('ANDROID_HOME environment variable not set');
        return;
    }
    console.log(', found: ' + androidHome);
    var sourcesPath = androidHome + '/sources';
    fs.access(sourcesPath, fs.R_OK | fs.W_OK, function callback(err){
        if (err){
            console.error(err);
            return;
        }
            var sources = loadSources(sourcesPath);

            if (process.argv.length > 2){
                if (process.argv[2] === '-r'){
                    cleanUp(sources);
                    console.log('Cleaned up and reverted all folder renames');
                } else if (process.argv[2] === '-i' || process.argv[2] === '-ls'){
                    printSources(sources, console.log);
                    return;
                } else if (process.argv[2] === '-c'){
                    var versionInt = parseInt(process.argv[3], 10);
                    var source = getSourceObject(sources, versionInt);
                    var installed = source !== undefined;
                    console.log('Sources for Android SDK Version ' + versionInt + ' are ' + (installed ? '' : 'NOT ') + 'installed');
                    if (installed){
                        console.log('SDK Source path: ' + source.path + '/' + source.file);
                    }
                } else if (process.argv.length === 4){
                    var projectSDKSource = getSourceObject(sources, parseInt(process.argv[2]));
                    var deviceSDKSource = getSourceObject(sources, parseInt(process.argv[3]));
                    if (projectSDKSource && deviceSDKSource){ 
                        askUser('Rename Android SDK Source folders to Android Studio uses ' + deviceSDKSource.version + ' instead of ' + projectSDKSource.version + '? (y/n)', function(answer){
                            if (answer === 'n' || answer === 'no'){
                                return;
                            }
                            renameForUsage(projectSDKSource, deviceSDKSource);
                            console.log('Folders renamed. Call again with flag -r to revert and restore proper folder naming');
                        });
                    } else {
                        console.warn('Given Android SDK Version Sources where not found');
                    }
                }
            } else {
                printSources(sources, console.log);
                askUser('Against which Android SDK Version is your app build? (the one Android Studio is using)', function(answer) {
                    var sdkInt = parseInt(answer, 10);
                    var projectSDKSource = getSourceObject(sources, sdkInt);
                    if (projectSDKSource === undefined){
                        console.warn('No Android SDK Version Sources found for the entered SDK Version number');
                        return;
                    }
                    // We've got the version the user specified
                    askUser('Which version is running on the device to debug?', function(answer) {
                        var deviceSDK = parseInt(answer, 10);
                        var deviceSDKSource = getSourceObject(sources, deviceSDK);
                        if (deviceSDKSource === undefined){
                            console.log('No Android SDK Version Sources found for the entered SDK Version number');
                            return;
                        }
                        // We've got all we need, now rename the folder
                        renameForUsage(projectSDKSource, deviceSDKSource);
                        console.log('Folders renamed. Call again with flag -r to revert and restore proper folder naming');
                    });
                });
            }
    });
})();