# Security notes

The application runs locally. Its browser bundle and committed data must contain no private credentials. Source API tokens belong in ignored local environment files or an approved credential store and must be used only in explicit ingestion commands.

The pinned site scaffold has reported upstream advisories in its development/build toolchain and React server packages. Automatic non-breaking remediation did not resolve them; the available npm remediation would replace pinned framework versions. Assess fixed versions against the local development server and full verification suite before upgrading. Do not assume a development-server vulnerability is irrelevant to a local installation.
