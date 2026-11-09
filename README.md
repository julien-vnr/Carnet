# Carnet d'entraînement

Site perso de suivi sport : programme de la semaine, séances (kg × reps), progrès et objectif bench 100 kg, course (import Strava) et mensurations.

**Lien du site :** https://julien-vnr.github.io/Carnet/

## Les fichiers

| Fichier | Ce qu'il contient |
|---|---|
| `index.html` | La structure de la page : en-tête, onglets, zone d'affichage |
| `style.css` | L'apparence : couleurs (en haut, dans `:root`), polices, mise en page |
| `app.js` | Toute la logique : programme, calculs, graphiques, sauvegarde sur GitHub |

## Où sont mes données ?

Dans le dépôt `carnet-data`, fichier `carnet.json`. Chaque enregistrement fait un commit, donc tout l'historique est gardé.
Le site y accède avec un jeton GitHub (fine-grained token) enregistré **seulement dans le navigateur** de chaque appareil (page Réglages du site). Le jeton ne doit jamais être mis dans ce dépôt.

## Partager le carnet en lecture seule

Si le dépôt `carnet-data` est **public**, toute personne qui ouvre le lien du site sans jeton voit tes données en **lecture seule** (rien de modifiable).
Sur tes appareils où le jeton est enregistré, tu gardes la modification.

## Modifier le site avec VS Code

1. Récupérer le projet : `git clone https://github.com/julien-vnr/Carnet.git`
2. Ouvrir le dossier `carnet` dans VS Code et modifier les fichiers.
3. Tester : ouvrir `index.html` dans le navigateur (ou utiliser l'extension *Live Server*).
4. Envoyer : onglet *Source Control* → écrire un message → *Commit* → *Sync Changes*.
   Le site en ligne se met à jour en une minute environ.

## Changer mon programme

Dans `app.js` :
- `const TEMPLATES` : la liste des séances et de leurs exercices (nom, type, nombre de séries) ;
- `const PLAN` : quel jour correspond à quelle séance (0 = dimanche, 1 = lundi…).
