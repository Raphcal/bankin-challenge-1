const https = require('https');
const { URL } = require('url');
const { JSDOM } = require('jsdom');
const { Script } = require('vm');

const profilerData = {};

/**
 * URL de la page à analyser.
 */
const rootUrl = 'https://web.bankin.com/challenge/index.html';

/**
 * Transactions des pages analysées.
 * @type {Transaction[][]}
 */
let pages = [];

/**
 * Numéro de la dernière page.
 */
let lastPage = Number.MAX_SAFE_INTEGER;

/**
 * Nombre de transactions par page.
 * @type {number}
 */
let transactionCountByPage;

// Exécution du script.
startProfiling();

async function startProfiling() {
    for (let index = 0; index < 10; index++) {
        await main();
    }
    for (let key in profilerData) {
        console.log(`${key}: run ${profilerData[key].count}, total time ${profilerData[key].time / 1000}s, avg ${profilerData[key].time / profilerData[key].count}ms`);
    }
}

function newStopwatch(name) {
    const startTime = new Date().getTime();
    return {
        stop: () => {
            if (!profilerData[name]) {
                profilerData[name] = {
                    count: 0,
                    time: 0
                }
            }
            profilerData[name].time += new Date().getTime() - startTime;
            profilerData[name].count++;
        }
    }
}

/**
 * Fonction principale.
 */
async function main() {
    pages = [];
    lastPage = Number.MAX_SAFE_INTEGER;
    const stopwatch = newStopwatch('main');

    const html = await downloadResourceAtURL(rootUrl);
    const scripts = await downloadScriptsOfHTML(html);

    // Récupération de la première page et calcul du nombre de transactions par page.
    const firstPageStopwatch = newStopwatch('firstPage');
    const firstPage = await Promise.race([1,2,3,4,5].map(() => transactionsStartingAt(0, html, scripts)));
    transactionCountByPage = firstPage.length;
    pages.push(firstPage);
    firstPageStopwatch.stop();

    // Analyse des pages suivantes.
    await runAllPageParsers(html, scripts);

    // Affiche les transactions.
    displayTransactions();
    stopwatch.stop();
}

/**
 * Créé et démarre plusieurs analyseurs pour lire les transactions.
 * @param {string} html Code HTML de la page à analyser.
 * @param {Script[]} scripts Tableau des scripts de la page.
 */
async function runAllPageParsers(html, scripts) {
    const numberOfParser = 50;

    const parsers = [];
    for (let index = 0; index < numberOfParser; index++) {
        parsers.push(createPageParser(html, scripts));
    }

    return Promise.all(parsers);
}

/**
 * Créé un analyseur de page. Un analyseur peut traiter plusieurs pages.
 * @param {string} html Code HTML de la page à analyser.
 * @param {Script[]} scripts Tableau des scripts de la page.
 */
async function createPageParser(html, scripts) {
    const stopwatch = newStopwatch('createPageParser');
    let currentPage;
    do {
        currentPage = pages.length;
        pages.push([]);

        const pageResults = await transactionsStartingAt(currentPage * transactionCountByPage, html, scripts);
        if (pageResults.length > 0) {
            pages[currentPage] = pageResults;
        }
        else if (currentPage < lastPage) {
            lastPage = currentPage;
        }
    } while(pages.length < lastPage);
    stopwatch.stop();
}

/**
 * Affiche les transactions en JSON sur la ligne de commande.
 */
function displayTransactions() {
    const stopwatch = newStopwatch('displayTransactions');
    /** @type {Transaction[]} */
    let allResults = [];
    for (let page of pages) {
        allResults = allResults.concat(page);
    }
    // console.log(JSON.stringify(allResults, null, 2));
    console.log(`${allResults.length} results`);
    stopwatch.stop();
}

/**
 * Télécharge le contenu à l'URL donné.
 * @param {string} url URL à télécharger.
 * @returns {Promise<string>} Le contenu correspondant à l'URL donné.
 */
function downloadResourceAtURL(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (responseData) => data += responseData.toString());
            response.on('end', () => resolve(data));
        });
    });
}

/**
 * Extrait et télécharge les scripts inclus dans le code HTML donné.
 * @param {string} html Code HTML d'où extraire les scripts.
 * @returns {Script[]} Tableau contenant les scripts extraits.
 */
async function downloadScriptsOfHTML(html) {
    /** @type {Promise<string>[]} */
    const downloads = [];

    const scriptRegex = /<script(?:[^>]+)src="([^"]+)"/g;
    for (let match = scriptRegex.exec(html); match != null; match = scriptRegex.exec(html)) {
        const url = new URL(match[1], rootUrl);
        downloads.push(downloadResourceAtURL(url));
    }

    const scripts = await Promise.all(downloads);
    return scripts.map((script) => new Script(script));
}

/**
 * Télécharge les transactions à partir en commençant à l'indice donné.
 * @param {number} startIndex Indice de départ.
 * @param {string} mainHtml Code HTML de la page à analyser.
 * @param {Script[]} scripts Scripts contenus dans la page.
 * @returns {Promise<Transaction[]>} Transactions de la page.
 */
function transactionsStartingAt(startIndex, mainHtml, scripts) {
    return new Promise((resolve, reject) => {
        const stopwatch = newStopwatch('transactionsStartingAt');
        const dom = new JSDOM(mainHtml, {
            url: `${rootUrl}?start=${startIndex}`,
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/604.4.7 (KHTML, like Gecko) Version/11.0.2 Safari/604.4.7",
            runScripts: "outside-only",
            beforeParse: (window) => {
                // Écoute les recherches et les créations d'éléments HTML.
                const document = window.document;
                listenTo(document, 'getElementById', autoClickOnGenerateButton);
                listenTo(document, 'createElement', autoParseTransactionsWhenTableIsCreated(document, resolve));

                // Remplace `alert` par une fonction vide pour ne pas être gêné pendant l'exécution.
                window.alert = (message) => {};
            }
        });

        // Démarre l'exécution des scripts de la page.
        scripts.forEach((script) => dom.runVMScript(script));
        stopwatch.stop();
    });
}

/**
 * Automatise le clic sur le bouton "Reload Transactions".
 * @param {HTMLElement} element Élément récupéré par id.
 * @param {string} id Identifiant de l'élément.
 */
function autoClickOnGenerateButton(element, id) {
    const stopwatch = newStopwatch('autoClickOnGenerateButton');
    if (id === 'btnGenerate') {
        setTimeout(() => element.click(), 10);
    }
    stopwatch.stop();
}

/**
 * Automatise la lecture des transactions quand le tableau est en cours de création.
 * @param {Document} document Document de la page en cours de traitement.
 * @param {Function} callback Fonction à appeler lorsque les transactions sont lues.
 */
function autoParseTransactionsWhenTableIsCreated(document, callback) {
    const aStopwatch = newStopwatch('callback(transactions)');
    let tableHasBeenCreated = false;
    return (element, tag) => {
        const stopwatch = newStopwatch('autoParseTransactionsWhenTableIsCreated');
        if (!tableHasBeenCreated && tag === 'th') {
            tableHasBeenCreated = true;

            setTimeout(() => {
                const html = htmlContainingTransactions(document);
                const transactions = parseTransactions(html);
                callback(transactions);
                aStopwatch.stop();
            }, 10);
        }
        stopwatch.stop();
    };
}

/**
 * Écoute les appels à la fonction `functionName` sur l'objet `object`.
 *
 * Lorsqu'un appel est détecté, le callback donné est appelé avec le résultat de la fonction
 * en premier argument. Les arguments suivants sont les arguments passés à la fonction écoutée.
 * @param {*} object Objet à écouter.
 * @param {string} functionName Nom de la fonction à écouter.
 * @param {?Function} callback Code à exécuter quand la fonction `functionName` est appelée sur l'objet donné.
 */
function listenTo(object, functionName, callback) {
    const originalFunction = object[functionName];
    if (originalFunction) {
        object[functionName] = function() {
            const result = originalFunction.apply(this, arguments);
            callback && callback(result, ...arguments);
            return result;
        };
    }
}

/**
 * Récupère le code HTML contenant le tableau des transactions.
 * @param {Document} document Document à analyser.
 * @returns {string} Le code HTML contenant le tableau des transactions.
 */
function htmlContainingTransactions(document) {
    /** @type {HTMLFrameElement} */
    const frame = document.getElementById('fm');
    if (frame) {
        return frame.contentDocument.body.innerHTML;
    } else {
        return document.body.innerHTML;
    }
}

/**
 * Extrait la valeur de la chaîne donnée.
 * @param {string} value Chaîne à analyser.
 * @returns {number} La valeur.
 */
function amountOf(value) {
    return parseInt(value.match(/[0-9]+/)[0]);
}

/**
 * Extrait le symbol monétaire de la chaîne donnée.
 * @param {string} value Chaîne à analyser.
 * @returns {string} Le symbol monétaire.
 */
function currencyOf(value) {
    return value.match(/[^0-9]+/)[0];
}

/**
 * Analyse le contenu du code HTML donné et en extrait les transactions.
 * @param {string} html HTML de la page.
 * @returns {Transaction[]} Un tableau contenant les transactions.
 */
function parseTransactions(html) {
    const stopwatch = newStopwatch('parseTransactions');
    /** @type {Transaction[]} */
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

    stopwatch.stop();
    return transactions;
}

/**
 * Détail d'une transaction.
 * @typedef {Object} Transaction
 * @property {string} Account - Nom du compte.
 * @property {string} Transaction - Type de transaction.
 * @property {number} Amount - Montant de la transaction.
 * @property {string} Currency - Monnaie utilisée.
 */
