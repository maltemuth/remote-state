# Publish a release

This guide is for maintainers releasing `@malte.muth/remote-state` to npm. Only the library package is published. The example server and the repository root aren't.

The library hasn't been published yet. Until the "Before the first release" items in [BACKLOG.md](../../BACKLOG.md) are done, step 3 fails.

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
```

The listed files must be exactly:

- `package.json`
- `README.md`
- `LICENSE`
- the contents of `dist/`

No sources, tests or config files.

## 4. Test the packed package as a user would

Pack the library and install it in an empty project outside the repository:

```sh
npm pack -w packages/remote-state --pack-destination /tmp
mkdir /tmp/remote-state-check && cd /tmp/remote-state-check
npm init -y && npm install /tmp/malte.muth-remote-state-*.tgz
node --input-type=module -e "import { createRemoteStateServer } from '@malte.muth/remote-state'; console.log(typeof createRemoteStateServer)"
node -e "console.log(typeof require('@malte.muth/remote-state').createRemoteStateServer)"
```

Both commands must print `function`: the first loads the library as ESM, the second through `require()` from CommonJS.

## 5. Update the changelog and version

1. In `CHANGELOG.md`, rename `## Unreleased` to `## <version> - <date>`, and add a new empty `## Unreleased` section above it.
2. Set the new version in the root, library and example `package.json` files. Before 1.0, breaking changes raise the minor version.
3. Run `npm install` to update the lockfile.
4. Commit, and tag the commit:

```sh
git commit -am "Release <version>"
git tag -a v<version> -m "<version>"
```

## 6. Publish

```sh
npm publish -w packages/remote-state
git push && git push --tags
```

Check that the new version appears on the package's npm page, and that its README renders.
