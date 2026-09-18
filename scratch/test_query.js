const util = require('minecraft-server-util');

util.queryFull('zeqa.net', 19132, { timeout: 3000 })
    .then((result) => {
        console.log("Query réussi !");
        console.log(result);
    })
    .catch((error) => {
        console.error("Query a échoué (probablement désactivé) :");
        console.error(error.message);
    });
