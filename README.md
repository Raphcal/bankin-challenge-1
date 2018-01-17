# Participation au challenge WebScrapping de Bankin'

## Technologies utilisées
- NodeJS 8+
- [JSDOM 11](https://github.com/tmpvar/jsdom)

## Démarrer le script
~~~bash
npm install
node bankin-challenge.js
~~~
Les transactions sont affichées sur la ligne de commande. Pour obtenir un fichier json, vous pouvez rediriger la sortie standard :
~~~
node bankin-challenge.js > transactions.json
~~~

## Principe du script
Le script télécharge une première fois [la page à analyser](https://web.bankin.com/challenge/index.html) et ses scripts.

Ensuite :
1. À l'aide de JSDOM, le DOM de la page est chargé en mémoire.
2. Les scripts sont exécutés dans le contexte de JSDOM.
3. Lorsque `load.js` ajoute une action sur le bouton "Reload transaction", le script fait un clic sur le bouton.
4. Lorsque les balises `th` du tableau de transactions est créé, le script lit son contenu (depuis body ou depuis l'iframe) à l'aide d'expressions régulières.

Les étapes de 1 à 4 sont exécutées une première fois pour déterminer le nombre de transactions par page. Les pages suivantes sont analysées en parallèle.

Le script s'arrête lorsqu'une page contient un tableau vide.

## Résultat
Le script affiche les transactions en JSON sur la ligne de commande au format suivant :
~~~json
[
  {
    "Account": "Checking",
    "Transaction": "Transaction 1",
    "Amount": 73,
    "Currency": "€"
  },
  {
    "Account": "Checking",
    "Transaction": "Transaction 2",
    "Amount": 54,
    "Currency": "€"
  }
]
~~~

## Liens externes
[Page du challenge](https://blog.bankin.com/challenge-engineering-web-scrapping-dc5839543117)
