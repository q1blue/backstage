## CLI Report file for "@backstage/repo-tools"

> Do not edit this file. It is a report generated by `yarn build:api-reports`

### `backstage-repo-tools`

```
Usage: backstage-repo-tools [options] [command]

Options:
  -V, --version
  -h, --help

Commands:
  api-reports [options] [paths...]
  type-deps
  schema [command]
  help [command]
```

### `backstage-repo-tools api-reports`

```
Usage: backstage-repo-tools api-reports [options] [paths...]

Options:
  --ci
  --tsc
  --docs
  --include <pattern>
  --exclude <pattern>
  -a, --allow-warnings <allowWarningsPaths>
  --allow-all-warnings
  -o, --omit-messages <messageCodes>
  --validate-release-tags
  -h, --help
```

### `backstage-repo-tools schema`

```
Usage: backstage-repo-tools schema [options] [command] [command]

Options:
  -h, --help

Commands:
  openapi [command]
  help [command]
```

### `backstage-repo-tools schema openapi`

```
Usage: backstage-repo-tools schema openapi [options] [command] [command]

Options:
  -h, --help

Commands:
  verify [paths...]
  generate [paths...]
  lint [options] [paths...]
  help [command]
```

### `backstage-repo-tools schema openapi generate`

```
Usage: backstage-repo-tools schema openapi generate [options] [paths...]

Options:
  -h, --help
```

### `backstage-repo-tools schema openapi lint`

```
Usage: backstage-repo-tools schema openapi lint [options] [paths...]

Options:
  --strict
  -h, --help
```

### `backstage-repo-tools schema openapi verify`

```
Usage: backstage-repo-tools schema openapi verify [options] [paths...]

Options:
  -h, --help
```

### `backstage-repo-tools type-deps`

```
Usage: backstage-repo-tools type-deps [options]

Options:
  -h, --help
```