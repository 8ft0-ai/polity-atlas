# Security notes

The production application is a static export and contains no server functions or private credentials. Source API tokens must be stored only as GitHub Actions secrets.

The pinned site scaffold currently reports upstream advisories in its development/build toolchain and React server packages. Automatic non-breaking remediation does not resolve them; the available npm remediation would replace pinned framework versions. Upgrade those packages only after the pinned Sites release supports the fixed versions and the static export passes its full verification suite. The affected server-function path is not deployed by the GitHub Pages export.
