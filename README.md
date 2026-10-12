# MPlayer

Lecteur de musique Android (Expo / React Native) pour les fichiers audio du téléphone.

## Fonctions

- Bibliothèque : pistes, albums, artistes, dossiers, favoris, listes de lecture, recherche, défilement alphabétique.
- Lecture en arrière-plan avec contrôles dans la notification, sur l'écran de verrouillage, au casque et en Bluetooth.
- File d'attente modifiable, lecture aléatoire, répétition, reprise à la dernière position.
- Mise en veille, vitesse de lecture, fondu entre les morceaux, saut du silence.
- Égaliseur, renforcement des basses, virtualiseur.
- Thème clair ou sombre.

## Compilation

Chaque envoi sur `main` lance le workflow **Build Android APK** (GitHub Actions). L'APK signé est publié dans
l'onglet **Releases** du dépôt.

La lecture native (ExoPlayer / Media3) se trouve dans `modules/mplayer-core`.
