# Publish a release

This guide is for maintainers releasing `@malte.muth/remote-state` and `@malte.muth/remote-state-client` to npm, with the same version. The example server and the repository root aren't published.

Neither package has been published yet. Before the first release, the remaining items under "Before the first release" in [BACKLOG.md](../../BACKLOG.md) must be done.

## 1. Start from a clean state

```sh
git switch master && git pull
nvm use
npm ci
```

`npm ci` installs exactly what `package-lock.json` specifies. Any change to the lockfile belongs in a normal commit, not in the release.

## 2. Run every check

```sh
npm run build
npm test
npm run lint
npm audit
```

All four must pass, and `npm audit` must report `found 0 vulnerabilities` ([0003](../explanation/decisions/0003-no-known-vulnerabilities.md)).

## 3. Check the package contents

```sh
npm pack --dry-run -w packages/remote-state
npm pack --dry-run -w packages/remote-state-client
```

For each package, the listed files must be exactly:

- `package.json`
- `README.md`
- `LICENSE`
- the contents of `dist/`

No sources, tests or config files. Packing runs the `prepack` script, which rebuilds `dist/` from scratch, so files from older builds can't slip in.

## 4. Test the packed package as a user would

Pack the library and the client, and install them in an empty project outside the repository:

```sh
npm pack -w packages/remote-state -w packages/remote-state-client --pack-destination /tmp
mkdir /tmp/remote-state-check && cd /tmp/remote-state-check
npm init -y && npm install /tmp/malte.muth-remote-state-*.tgz
node --input-type=module -e "import { createRemoteStateServer } from '@malte.muth/remote-state'; console.log(typeof createRemoteStateServer)"
node -e "console.log(typeof require('@malte.muth/remote-state').createRemoteStateServer)"
node --input-type=module -e "import { createClient } from '@malte.muth/remote-state-client'; console.log(typeof createClient)"
```

Each command must print `function`. The first two load the library as ESM and through `require()` from CommonJS; the last loads the client.

## 5. Update the changelog and version

1. If the entities' tables changed since the last release, raise `SCHEMA_VERSION` in `packages/remote-state/src/database/orm.ts`, and say in the changelog that databases have to be deleted.
1. In `CHANGELOG.md`, rename `## Unreleased` to `## <version> - <date>`, and add a new empty `## Unreleased` section above it.
1. Set the new version in the root, library, client and example `package.json` files. Before 1.0, breaking changes raise the minor version.
1. Run `npm install` to update the lockfile.
1. Commit, and tag the commit:

```sh
git commit -am "Release <version>"
git tag -a v<version> -m "<version>"
```

## 6. Publish

```sh
npm publish -w packages/remote-state -w packages/remote-state-client
git push && git push --tags
```

Check that the new version appears on the package's npm page, and that its README renders.
