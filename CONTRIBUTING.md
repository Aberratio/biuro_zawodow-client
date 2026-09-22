# Contributing

Thanks for taking a look at this project. This is the production frontend for
the `biuro_zawodow` race-office system, live at
[biuro.zmierzymyczas.pl](https://biuro.zmierzymyczas.pl/), and contributions
or suggestions are welcome.

## Local setup

See the [README](./README.md#setup) for installing dependencies and running the
dev server against the backend API.

## Branching

Branch off `main` using a short, descriptive name prefixed by type, e.g.:

- `feature/qr-scanner-retry`
- `fix/calendar-dark-mode`
- `chore/update-deps`

## Before opening a PR

Run the project's checks locally and make sure they're all clean:

```powershell
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit-style project check
npm run test        # Vitest
```

Or run all three at once:

```powershell
npm run check
```

## Commit messages

Short, imperative-mood summaries (e.g. "Fix modal rendering issues across
event pages", "Add clickable column sorting to events tables") — that's the
existing style in this repo's history. Conventional Commits prefixes
(`feat:`, `fix:`, …) are welcome but not required.

## Opening a PR

Fill in the PR template (what changed, why, how it was tested). Pull requests
are routed to reviewers via [`CODEOWNERS`](./.github/CODEOWNERS), so no need to
manually pick a reviewer.

## Future considerations

Adopting [Conventional Commits](https://www.conventionalcommits.org/) with a
`commitlint` Husky hook has been discussed as a possible future improvement
(e.g. for automated changelogs). Not implemented yet — the existing commit
history doesn't follow that format, so enforcing it retroactively would need a
deliberate decision first.
