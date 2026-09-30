# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Schedules can target a process definition in addition to an agent interaction.
- `@vertesia/ui` exports the `MarkdownRenderer` stylesheet as `@vertesia/ui/css/markdown.css`, so
  plugins rendered in a shadow root can load it themselves.

### Fixed

- `MarkdownRenderer` no longer renders prose between two dollar amounts as a formula when the amounts
  sit in parentheses or bold, as in `($49,137,431.65) equals … ($49,137,431.65)`.
