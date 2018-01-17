const https = require('https');
const { URL } = require('url');
const { JSDOM } = require('jsdom');
const { Script } = require('vm');

const rootUrl = 'https://web.bankin.com/challenge/index.html';

main();

/**
 * Fonction principale.
 */
async function main() {
    const html = await download(rootUrl);
    const scripts = await extractScripts(html);
    
    let allResults = [];
    let pageResults;
    do {
        pageResults = await transactionsStartingAt(allResults.length, html, scripts);
        allResults = allResults.concat(pageResults);
    } while (pageResults.length > 0);

    console.log(JSON.stringify(allResults, null, 2));
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
 * @param {number} startIndex Indice de départ.
 * @param {string} mainHtml Code HTML de la page à analyser.
 * @param {Script[]} scripts Scripts contenus dans la page.
 * @returns {Promise<Array<{Account: string; Transaction: string; Amount: number; Currency: string}[]>>} Transactions de la page.
 */
function transactionsStartingAt(startIndex, mainHtml, scripts) {
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
                        setTimeout(() => element.click(), 100);
                    }
                });
                let lastTag = '';
                let tableCellWasCreated = false;
                spyOn(document, 'createElement', (element, tag) => {
                    if (!tableCellWasCreated && tag === 'th') {
                        tableCellWasCreated = true;
                        setTimeout(() => {
                            /** @type {{Account: string; Transaction: string; Amount: number; Currency: string}[]} */
                            let transactions;

                            /** @type {HTMLFrameElement} */
                            const frame = document.getElementById('fm');
                            if (frame) {
                                transactions = parseTransactions(frame.contentDocument.body.innerHTML);
                            } else {
                                transactions = parseTransactions(dom.serialize());
                            }
                            resolve(transactions);
                        }, 100);
                    }
                    lastTag = tag;
                });
        
                window.alert = (message) => {};
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
 * Extrait la valeur de la chaîne donnée.
 * @param {string} value Chaîne à analyser.
 * @returns La valeur.
 */
function amountOf(value) {
    return parseInt(value.match(/[0-9]+/)[0]);
}

/**
 * Extrait le symbol monétaire de la chaîne donnée.
 * @param {string} value Chaîne à analyser.
 * @returns Le symbol monétaire.
 */
function currencyOf(value) {
    return value.match(/[^0-9]+/)[0];
}

/**
 * Analyse le contenu du code HTML donné et en extrait les transactions.
 * @param {string} html HTML de la page.
 * @returns {{Account: string; Transaction: string; Amount: number; Currency: string}[]} Un tableau contenant les transactions.
 */
function parseTransactions(html) {
    /** @type {{Account: string; Transaction: string; Amount: number; Currency: string}[]} */
    const transactions = [];
    
    const regex = /<td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td>/g;
    while ((values = regex.exec(html)) !== null) {
        transactions.push({
            Account: values[1],
            Transaction: values[2],
            Amount: amountOf(values[3]),
            Currency: currencyOf(values[3])
        });
    }

    return transactions;
};
