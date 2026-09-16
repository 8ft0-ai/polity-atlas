# Architecture

Polity Atlas separates the public research interface from its source-ingestion process.

- `app` and `components` contain the static React interface.
- `packages/schemas` is the shared, versioned data contract.
- `packages/data-pipeline` is reserved for build-time source adapters and normalizers.
- `public/data` contains reviewed, citation-bearing JSON safe for public deployment.
- GitHub Actions validates every profile and exports the site to `dist/client` for GitHub Pages.

Private API tokens must remain in GitHub Actions secrets. They must never use a `NEXT_PUBLIC_` or `VITE_` prefix, enter a URL, or be written to generated data.
