# Third Party Licenses

This project uses several third-party dependencies. Below are the licenses and attributions for dependencies that require specific attribution.

## Dual-Licensed Dependencies

Several dependencies are dual-licensed (e.g., "Apache-2.0 AND MIT"), which means you can choose to comply with either license. This provides more flexibility, not restrictions:

- **@pkgjs/parseargs@0.11.0**: Apache-2.0 AND MIT
- **confbox@0.1.8**: BSD-3-Clause AND MIT  
- **esprima@4.0.1**: BSD-2-Clause AND BSD-3-Clause
- **rollup@4.44.2**: 0BSD AND ISC AND MIT
- **vite@6.3.5**: Apache-2.0 AND BSD-2-Clause AND CC0-1.0 AND ISC AND MIT

All of these licenses are permissive and compatible with MIT projects.

## Security Notice

This project contains one moderate security vulnerability in development dependencies:
- **esbuild vulnerability (GHSA-67mh-4wv8-2f99)**: Dev server request handling issue
- **Impact**: Development-only, requires user interaction with malicious websites
- **Mitigation**: Not exploitable in production builds, allowlisted in CI

## CC-BY-4.0 Licensed Dependencies

### caniuse-lite
- **Package**: caniuse-lite
- **License**: CC-BY-4.0
- **Copyright**: Can I Use data (caniuse.com)
- **Usage**: Browser compatibility data used in build tools
- **Attribution**: This product includes data from caniuse.com, which is made available under the Creative Commons Attribution 4.0 International License.

## Development Dependencies

The following licenses apply to development dependencies that are not distributed with the final product:

- **MIT**: Most development and build dependencies
- **Apache-2.0**: Some build tools and utilities  
- **BSD-2-Clause, BSD-3-Clause**: Various utilities and parsers
- **ISC**: Some Node.js ecosystem packages
- **BlueOak-1.0.0**: Modern permissive license for some tools
- **CC0-1.0**: Public domain dedication for some utilities
- **0BSD**: Zero-clause BSD license for some packages
- **Python-2.0**: Legacy Python license for argparse (dev dependency only)

All development dependencies are used only during the build process and are not included in the distributed package.