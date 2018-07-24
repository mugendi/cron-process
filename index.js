process.env.DEBUG = 'cron-process*';

var path = require('path'),
    fs = require('fs'),
    CronJob = require('cron').CronJob,
    spawn = require('child_process').spawn,
    debug = require('debug')('cron-process'),
    children = {}



process.on('SIGTERM', function onSigterm() {
    debug('Got SIGTERM. Graceful shutdown start', new Date().toISOString())
    // start graceul shutdown here
    killChildren();
})

process.on('SIGINT', function onSigterm() {
    debug('Got SIGINT. Graceful shutdown start', new Date().toISOString())
    // start graceul shutdown here
    killChildren();
})


function killChildren() {
    debug('Killing Children...');

    // console.log(children);

    for (var name in children) {
        debug(`Killing "${name}"`);
        children[name].kill()
    }

    process.exit();
}



function cronRun(cron) {

    var name = typeof cron.name == 'string' ? cron.name : 'cron-process',
        file = typeof cron.file == 'string' ? cron.file : 'cron-process',
        resetAfter = Number(cron.resetAfter) ? cron.resetAfter : (1000 * 60 * 10); //10 minutes

    var dir = path.join(__dirname, 'processes'),
        processFile = path.join(dir, name + ".running"),
        // pidFile = path.join(dir, name + ".pid"),
        isRunning = fs.existsSync(processFile);


    if (isRunning) {

        debug(`${name} is running...`);

        var t = (fs.existsSync(processFile)) ? fs.readFileSync(processFile, 'utf8') : null,
            d = new Date().getTime() - t;

        if ((d > resetAfter && (fs.existsSync(processFile)))) {
            //delete...
            debug(`Resetting ${name}`);

            fs.unlinkSync(processFile);

            if (children[name]) {
                children[name].kill()
            }

        }

        return;
    } else {

        debug(`Running ${name}...`)


        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        //save process file
        fs.writeFileSync(processFile, new Date().getTime(), 'utf8');

        file = require.resolve(file);

        var options = {
                // cwd: __dirname,
                // checkCWD: true ,
                shell: true
            },
            cmd = `node "${file}"`;

        children[name] = spawn(cmd, options);

        children[name].stdout.setEncoding('utf8');
        children[name].stdout.on('data', console.log);

        children[name].on('error', function (err) {
            console.error(err)
            fs.unlinkSync(processFile);
        })

        children[name].on('exit', function (code) {
            debug('child exit code (spawn)', code);
            fs.unlinkSync(processFile);
        });

    }

}






module.exports = function (crons) {

    if (!Array.isArray(crons)) {
        throw new Error("First Srgument must be an array!");
    }

    new CronJob('* * * * * *', function () {

        crons.forEach(cron => {

            if (cron.name && cron.file) {
                cronRun(cron);
            }

        });

    }, null, true, 'America/Los_Angeles');
    
}