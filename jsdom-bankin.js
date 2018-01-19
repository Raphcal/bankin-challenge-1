const { JSDOM } = require('jsdom');

const rootUrl = 'https://web.bankin.com/challenge/index.html';

/**
 * TODO LIST
 * 1. Télécharger la page.
 * 2. Extraire les URLs des scripts.
 * 3. Faire une boucle (while ?).
 * 3.1. Créer un contexte JsDom à partir du source de la page.
 * 3.2. Écouter les créations de nœuds.
 * 3.3. Si getElementById de btnGenerate -> cliquer
 * 3.4. Si
 */

const toArray = (args) => {
    const result = [];
    for (let index = 0; index < args.length; index++) {
        result.push(args[index]);
    }
    return result;
};

const spyOn = (object, functionName, callback) => {
    const originalFunction = object[functionName];
    if (originalFunction) {
        object[functionName] = function() {
            const args = toArray(arguments);
            console.log(`spy on ${functionName} ${JSON.stringify(args)}`);
            const result = originalFunction.apply(this, args);
            callback && callback(result, ...args);
            return result;
        };
    }
};
const spyOnProperty = (object, propertyName) => {
    let currentValue = object[propertyName];
    Object.defineProperty(object, propertyName, {
        get: function() {
            return currentValue;
        },
        set: function(value) {
            console.log(`spy on property ${propertyName} ${value}`);
            currentValue = value;
        },
        enumerable: true,
        configurable: true
    });
};

const parseResults = function(html) {
    const regex = /<td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td>/g;
    const result = [];

    let amount, currency, json;
    while ((values = regex.exec(html)) !== null) {
        amount = parseInt(values[3].match(/[0-9]+/)[0]);
        currency = values[3].match(/[^0-9]+/)[0];
        json = {
            Account: values[1],
            Transaction: values[2],
            Amount: amount,
            Currency: currency
        };
        result.push(json);
    }

    return result;
};

const wrap = (element, createElement) => {
    /** @type {HTMLElement} */
    const wrapper = createElement.apply(this, [tag]);
    Object.defineProperty(wrapper, 'innerHTML', {
        get: function() {
            return element.innerHTML;
        },
        set: function(value) {
            element.innerHTML = value;
        }
    });
    Object.defineProperty(wrapper, 'childNodes', {
        get: function() {
            return element.childNodes;
        } 
    });
    wrapper.setAttribute = function(name, value) {
        element.setAttribute(name, value);
    };
    wrapper.getElementsByTagName = function(tag) {
        return element.getElementsByTagName(tag);
    };
    return wrapper;
};

JSDOM.fromURL(rootUrl, {
    runScripts: "outside-only",
    beforeParse: (window) => {
        const document = window.document;
        // spyOn(document, 'getElementsByTagName');
        spyOn(document, 'getElementById', (element, id) => {
            if (id === 'btnGenerate') {
                setTimeout(() => {
                    console.log('click on btnGenerate');
                    element.click();
                }, 100);
            }
        });
        let tableWillAppear = false;
        spyOn(document, 'createElement', (element, tag) => {
            if (!tableWillAppear && tag === 'td') {
                tableWillAppear = true;
                setTimeout(() => {
                    console.log('parse td');
                    const values = parseResults(document.body.innerHTML);
                    console.log(JSON.stringify(values, null, 2));
                    if (values.length < 50) {
                        console.log(`${values.length} is not 50`);
                    }
                }, 100);
            }
        });

        window.alert = (message) => console.log(message);
    }
}).then(
    dom => {
        let divs = dom.window.document.getElementsByTagName('div');
        console.log(divs && divs.length ? divs.length : 0);

        const html = dom.serialize();

        const https = require('https');
        const { URL } = require('url');

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
                response.on('data', (data) => scriptData += data.toString());
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
                            dom.window.eval(script);
                        }
                    }
                });
            });
        }
    },
    error => console.log(error));