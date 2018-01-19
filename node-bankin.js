const rootUrl = 'https://web.bankin.com/challenge/index.html';

const https = require('https');
const { URL } = require('url');
const vm = require('vm');

/** @type {Document} */
const document = {
    createElement: function(tag) {
        console.log(tag);
        return {
            tagName: tag,
            innerHTML: '',
            childNodes: [],
            setAttribute: function(attr, value) {
                console.log(`${attr} = ${value}`);
            },
            getElementsByTagName: function(tag) {
                return [];
            },
            getElementById: function(id) {
                return null;
            }
        };
    },
    getElementsByTagName: function(tag) {
        return [];
    }
}
/** @type {Window} */
const window = {
    alert: (message) => console.log(message),
    document: document,
    location: {
        href: "https://web.bankin.com/challenge/index.html",
        protocol: "https:",
        host: "web.bankin.com",
        hostname: "web.bankin.com", 
        port: "",
        pathname: "/challenge/index.html",
        search: "",
        hash: "",
        origin: "https://web.bankin.com",
        ancestorOrigins: {}
    }
};

https.get(rootUrl, (response) => {
    response.on('data', (data) => {
        const html = data.toString();
        console.log(html);
        
        const scriptRegex = /<script(?:[^>]+)src="([^"]+)"/g;

        /** @type {string[]} */
        let order = [];
        /** @type {{[key: string]: string}} */
        let scripts = {};

        for (let match = scriptRegex.exec(html); match != null; match = scriptRegex.exec(html)) {
            const scriptPath = match[1];
            const scriptUrl = new URL(scriptPath, rootUrl);
            console.log(scriptUrl.toString());
            
            order.push(scriptPath);
            scripts[scriptPath] = null;

            https.get(scriptUrl.toString(), (response) => {
                let scriptData = '';
                response.on('data', (data) => {
                    scriptData += data.toString();
                });
                response.on('end', () => {
                    console.log(`${scriptPath} téléchargé`);
                    scripts[scriptPath] = scriptData;

                    const count = order.map((name) => scripts[name] !== null ? 1 : 0)
                        .reduce((prev, curr) => prev + curr);

                    if (count == 4) {
                        for (let index = 0; index < order.length; index++) {
                            let name = order[index];
                            let script = scripts[name];
                            console.log(`Chargement de ${name}`);
                            eval(script);
                        }
                    }
                });
            });
        }
    });
});
