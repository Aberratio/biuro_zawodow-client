# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [calendar versioning](https://calver.org/)
(`YYYY.MM.PATCH`). See [RELEASING.md](RELEASING.md) for how a version is cut
and deployed.

## [Unreleased]

### Added

- Platform integration settings in event details, including generating the
  connection token.
- Importing participants from the ZmierzymyCzas platform from event details.
- Participants withdrawn on the platform are flagged, and pending platform
  updates are listed in event settings.

### Fixed

- Null-handling bugs in the CSV import summary and event details, found by
  `strictNullChecks`.
- Encoding of a section title in event details.

## [2026.09.0] - 2026-09-20

First tagged release. It marks the code running in production on 2026-09-20;
earlier production deploys were not versioned.

### Added

- Login, session restore and password reset.
- Role-aware interface for `superadmin`, `admin`, `editor` and `scanner`.
- Panel with open, upcoming and recently finished events.
- Organizations view with card-based navigation.
- Event details: edit, delete, export participants and logs to CSV, send QR
  codes by e-mail.
- Participant management: manual add, package reassignment, QR preview,
  single QR e-mail, delete.
- CSV import: analyse the file, map columns, run the import.
- QR scanner for assigned and currently open events.
- Archive of operational warnings.

[Unreleased]: https://github.com/Aberratio/biuro_zawodow-client/compare/v2026.09.0...HEAD
[2026.09.0]: https://github.com/Aberratio/biuro_zawodow-client/releases/tag/v2026.09.0
