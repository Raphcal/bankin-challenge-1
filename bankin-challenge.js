const rootUrl = 'https://web.bankin.com/challenge/index.html';
const allResults = [];

const https = require('https');
const { URL } = require('url');
const { JSDOM } = require('jsdom');

const mainHtml = await download(url);
const scripts = await extractScripts(mainHtml);

let pageResults;
do {
    pageResults = [];

    const dom = new JSDOM(mainHtml, {
        runScripts: "outside-only",
        beforeParse: (window) => {
            const document = window.document;
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
    });

    allResults = allResults.concat(pageResults);
} while (pageResults.length > 0);

/**
 * Télécharge le contenu à l'URL donné.
 * @param {string} url URL à télécharger.
 * @returns {string} Le contenu correspondant à l'URL donné.
 */
const download = async (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (responseData) => data += responseData.toString());
            response.on('end', () => resolve(data));
        });
    });
};

const extractScripts = async (html) => {
    // TODO: À finir
};

/**
 * Écoute les appels à la fonction `functionName` sur l'objet `object`.
 * @param {*} object Objet à écouter.
 * @param {string} functionName Nom de la fonction à écouter.
 * @param {Function?} callback Code à exécuter quand la fonction `functionName` est appelée sur l'objet donné.
 */
const spyOn = (object, functionName, callback) => {
    const originalFunction = object[functionName];
    if (originalFunction) {
        object[functionName] = function() {
            const args = toArray(arguments);
            const result = originalFunction.apply(this, args);
            callback && callback(result, ...args);
            return result;
        };
    }
};

/**
 * Analyse le contenu du code HTML donné et en extrait les transactions.
 * @param {string} html HTML de la page.
 * @returns {Array<{Account: string; Transaction: string; Amount: number; Currency: string}>} Un tableau contenant les transactions.
 */
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
