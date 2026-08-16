# Journal des modifications

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le versionnement
[semver](https://semver.org/lang/fr/). Tant que la version majeure est `0`, une rupture de contrat
incrémente la version mineure.

## [0.3.0] — 2026-08-16

### Rupture de compatibilité

- `apiVersion` n'accepte plus la valeur littérale `"1.0"` : c'est maintenant une version exacte
  (`"1.0.0"`) ou une plage caret (`"^1.0.0"`), avec la même grammaire que le nouveau champ `sdk`.
  Un manifeste existant doit mettre à jour son `apiVersion`.
- `DatabaseApi.query()` prend désormais un paramètre `never`, comme `RouteApi.register()` — un
  appel ne compile plus, plutôt que de compiler et échouer seulement au runtime.

### Ajouté

- `SDK_API_VERSION` passe à un semver complet (`1.0.0`, contre `1.0` auparavant). Il est bumpé à la
  main uniquement quand le contrat plugin (`PluginContext`, schéma du manifeste, permissions)
  change réellement de forme — indépendamment de la version npm du paquet. Voir la section
  « Versioning » du README.
- `isApiVersionCompatible(range, actual)`, exporté par le SDK : compare la plage `apiVersion` d'un
  plugin à un `SDK_API_VERSION` réel. Sémantique caret standard (npm/`engines`), sans dépendance à
  `semver`.
- Champ manifeste optionnel `sdk` — indicatif, non vérifié, pour distinguer « version npm du SDK
  utilisée pour écrire ce plugin » de la plage `apiVersion` réellement appliquée.
- `ManifestResult` gagne `issues: readonly { path: string; message: string }[]` sur l'échec, en
  plus du `error: string` joint déjà existant — un appelant peut réagir à un champ précis (par
  exemple distinguer un `apiVersion` incompatible d'un manifeste par ailleurs invalide) sans parser
  la chaîne d'erreur.
- README : nouvelle section « Modèle de sécurité », explicite sur le fait que les plugins
  s'exécutent dans le process du bot sans sandbox — les permissions du SDK gouvernent
  `PluginContext`, pas l'accès à Node lui-même.

## [0.2.0] — 2026-08-14

### Rupture de compatibilité

- La permission `discord` est remplacée par `discord:read`, `discord:send`, `discord:roles` et
  `discord:moderate`. Un seul drapeau couvrait aussi bien l'envoi d'un message de bienvenue que le
  bannissement d'un membre : c'était du moindre privilège de nom seulement. **Tout manifeste
  déclarant `discord` doit être mis à jour.**
- `DiscordApi` devient quatre sous-API à espaces de noms (`context.discord.send.sendMessage(...)`
  au lieu de `context.discord.sendMessage(...)`). Seuls les espaces correspondant aux permissions
  déclarées existent à l'exécution ; lire les autres lève une erreur.
- `manifestSchema` est désormais `strict` : une clé inconnue — une faute de frappe comme
  `permision` — fait échouer la validation au lieu d'être ignorée silencieusement.
- `main` n'accepte plus qu'un chemin relatif restant dans le dossier du plugin et pointant vers un
  fichier JS/TS. Les segments `..`, les chemins absolus (POSIX et Windows), les antislashs, les URL
  de tout schéma et les octets nuls sont refusés.
- Les noms de plugin réservés (`admin`, `bot`, `core`, `internal`, `node-modules`, `plugin`,
  `plugins`, `sdk`, `system`) sont refusés.

### Ajouté

- `version` accepte les préversions semver (`1.0.0-beta.1`).

### Sécurité

- Chaque champ texte du manifeste est borné en longueur, la liste des permissions est plafonnée et
  dédupliquée, et les messages d'erreur sont tronqués et débarrassés de leurs retours à la ligne :
  une valeur de manifeste ne peut plus forger de fausses lignes de log.

## [0.1.1] — 2026-08-12

### Corrigé

- Extensions `.js` ajoutées aux exports relatifs, sans quoi la résolution ESM réelle de Node
  échouait sur le paquet publié.
- Publication sous le périmètre `@la_minute_code`.

## [0.1.0] — 2026-08-12

- Première extraction du contrat public depuis le dépôt du bot : `Plugin`, `PluginContext`, les
  types et le manifeste.
