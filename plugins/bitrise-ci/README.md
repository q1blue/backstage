# bitrise-ci

Welcome to the bitrise-ci plugin!

- View recent Bitrise Builds for a Bitrise application
- Download build artifacts

## Annotation

Your plugin can be added to a catalog item by using the following annotation:

```yaml
metadata:
  annotations:
    bitrise.io/app: '<THE NAME OF THE BITRISE APP>'
```

## Bitrise Auth

The plugin requires the env. variable `BITRISE_AUTH_TOKEN` to authenticate with Bitrise API.

Learn on https://devcenter.bitrise.io/api/authentication how to create a new token.

## Bitrise Proxy API

The plugin requires to configure a proxy to the Bitrise API.

```yaml
proxy:
  '/bitrise':
    target: 'https://api.bitrise.io/v0.1'
    allowedMethods: ['GET']
    headers:
      Authorization:
        $env: BITRISE_AUTH_TOKEN
```
