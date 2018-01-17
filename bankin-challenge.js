const https = require('https');
const { URL } = require('url');
const { JSDOM } = require('jsdom');
const { Script } = require('vm');

const rootUrl = 'https://web.bankin.com/challenge/index.html';
let mainHtml;
let scripts;

main();

/**
 * Fonction principale.
 */
async function main() {
    mainHtml = await download(rootUrl);
    scripts = await extractScripts(mainHtml);
    
    let allResults = [];
    let pageResults;
    do {
        pageResults = await transactionsStartingAt(allResults.length);
        allResults = allResults.concat(pageResults);
    } while (pageResults.length > 0);

    console.log('done');
}

/**
 * Télécharge le contenu à l'URL donné.
 * @param {string} url URL à télécharger.
 * @returns {Promise<string>} Le contenu correspondant à l'URL donné.
 */
function download(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (responseData) => data += responseData.toString());
            response.on('end', () => resolve(data));
        });
    });
};

/**
 * Extrait et télécharge les scripts inclus dans le code HTML donné.
 * @param {string} html Code HTML d'où extraire les scripts.
 * @returns {Script[]} Tableau contenant les scripts extraits.
 */
async function extractScripts(html) {
    /** @type {Promise<string>[]} */
    const downloads = [];

    const scriptRegex = /<script(?:[^>]+)src="([^"]+)"/g;
    for (let match = scriptRegex.exec(html); match != null; match = scriptRegex.exec(html)) {
        const url = new URL(match[1], rootUrl);
        downloads.push(download(url));
    }

    const scripts = await Promise.all(downloads);
    return scripts.map((script) => new Script(script));
};

/**
 * Télécharge les transactions à partir en commençant à l'indice donné.
 * @param {Promise<Array<*>>} startIndex Indice de départ.
 */
function transactionsStartingAt(startIndex) {
    return new Promise((resolve, reject) => {
        const url = `${rootUrl}?start=${startIndex}`;

        const dom = new JSDOM(mainHtml, {
            url: url,
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/604.4.7 (KHTML, like Gecko) Version/11.0.2 Safari/604.4.7",
            runScripts: "outside-only",
            beforeParse: (window) => {
                const document = window.document;
                spyOn(document, 'getElementById', (element, id) => {
                    if (id === 'btnGenerate') {
                        console.log('click on generate');
                        setTimeout(() => element.click(), 100);
                    }
                });
                let lastTag = '';
                spyOn(document, 'createElement', (element, tag) => {
                    if (lastTag === 'td' && tag !== 'td') {
                        console.log('tableWillAppear');
                        setTimeout(() => {
                            let results;

                            /** @type {HTMLFrameElement} */
                            const frame = document.getElementById('fm');
                            if (frame) {
                                results = parseResults(frame.contentDocument.body.innerHTML);
                            } else {
                                results = parseResults(dom.serialize());
                            }
                            console.log(results);
                            resolve(results);
                        }, 100);
                    }
                    lastTag = tag;
                });
        
                window.alert = (message) => console.log(message);
            }
        });
        scripts.forEach((script) => dom.runVMScript(script));
    });
}

/**
 * Écoute les appels à la fonction `functionName` sur l'objet `object`.
 * @param {*} object Objet à écouter.
 * @param {string} functionName Nom de la fonction à écouter.
 * @param {Function?} callback Code à exécuter quand la fonction `functionName` est appelée sur l'objet donné.
 */
function spyOn(object, functionName, callback) {
    const originalFunction = object[functionName];
    if (originalFunction) {
        object[functionName] = function() {
            const result = originalFunction.apply(this, arguments);
            callback && callback(result, ...arguments);
            return result;
        };
    }
};

/**
 * Analyse le contenu du code HTML donné et en extrait les transactions.
 * @param {string} html HTML de la page.
 * @returns {{Account: string; Transaction: string; Amount: number; Currency: string}[]} Un tableau contenant les transactions.
 */
function parseResults(html) {
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

    if (result.length === 0) {
        console.log(html);
        console.log('0 !');
    }

    return result;
};
