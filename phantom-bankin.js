console.log('Loading a web page');

var webpage = require('webpage');
var startUrl = 'https://web.bankin.com/challenge/index.html';

var pages = {},
    pageOrder = [],

    parseResults = function(page, url) {
        var regex = /<td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td>/g,
            result = [],
            amount, currency, json;

        while ((values = regex.exec(page.content)) !== null) {
            amount = parseInt(values[3].match(/[0-9]+/)[0]);
            currency = values[3].match(/[^0-9]+/)[0];
            json = {
                account: values[1],
                transaction: values[2],
                amount: amount,
                currency: currency
            };
            result.push(json);
        }

        if (result.length === 0) {
            console.log(url + ' is last ?');
            console.log(page.content);
        }

        pages[url] = result;
    },

    pollForResults = function(page, url) {
        var count = 0;
        var interval = setInterval(function() {
            count++;
            if (page.content.indexOf('Account') >= 0) {
                clearInterval(interval);
                parseResults(page, url);
                displayResultsAndQuit();
            } else if (count > 30) {
                // console.log(page.content);
                parsePageAtURL(url);
                count = 0;
            }
        }, 100);
    },

    pollForGenerateButton = function(page) {
        var interval = setInterval(function() {
            if (page.content.indexOf('btnGenerate') >= 0) {
                clearInterval(interval);
                page.evaluate(function() {
                    document.getElementById('btnGenerate').click();
                });
            }
        }, 100);
    },
    
    doNextPage = function(page) {
        var nextUrl = page.evaluate(function() {
            return document.getElementsByTagName('a')[0].href;
        });
        if (pages[nextUrl] === undefined) {
            parsePageAtURL(nextUrl);
        }
    },

    doPageStartingAt = function(start) {
        var nextUrl = 'https://web.bankin.com/challenge/index.html?start=' + start;
        if (pages[nextUrl] === undefined) {
            parsePageAtURL(nextUrl, start);
        }
    },
    
    displayResultsAndQuit = function() {
        var allDone = true;
        var result = [];
        for (var i = 0; allDone && i < pageOrder.length; i++) {
            var url = pageOrder[i];
            if (pages[url] !== null) {
                result = result.concat(pages[url]);
                if (pages[url].length === 0) {
                    break;
                }
            } else {
                allDone = false;
            }
        }
        if (allDone) {
            console.log(JSON.stringify(result));
            phantom.exit();
        }
    };


var parsePageAtURL = function(url, start) {
    if (pages[url] === undefined) {
        pages[url] = null;
        pageOrder.push(url);
        console.log(pageOrder.length + ' page(s)');
    }

    page = webpage.create();
    page.onConsoleMessage = function(message) {
        console.log('console: ' + message);
    };
    page.onAlert = function(alert) {
        console.log('alert: ' + alert);
    };
    page.open(url, function (status) {
        console.log('status: ' + status);
        // doNextPage(page);
        doPageStartingAt(start + 50);
        if (status === 'success') {
          pollForGenerateButton(page);
          pollForResults(page, url);
        } else {
          console.log('Not a success? ' + status);
          phantom.exit();
        }
    });
};

parsePageAtURL(startUrl, 0);
