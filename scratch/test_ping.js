const util = require('minecraft-server-util');

util.statusBedrock('play.nethergames.org', 19132)
    .then((result) => {
        console.log(result);
    })
    .catch((error) => {
        console.error(error);
    });
